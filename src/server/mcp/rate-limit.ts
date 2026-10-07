import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import { db, type DatabaseClient } from "@/db/client";

const defaults = { registrationsPerMinute: 10, registrationsPerDay: 100, callsPerMinute: 120, callsPerNetworkMinute: 600 };
type Limits = typeof defaults;
type Input = { kind: "registration" | "call"; network: string; authUserId?: string; clientId?: string; now?: Date; limits?: Partial<Limits> };
type Decision = { allowed: true; remaining: number } | { allowed: false; code: "RATE_LIMITED"; retryAfterSeconds: number };

export function getMcpRateLimits(): Partial<Limits> {
	const settings = { registrationsPerMinute: "MCP_REGISTRATIONS_PER_MINUTE", registrationsPerDay: "MCP_REGISTRATIONS_PER_DAY", callsPerMinute: "MCP_CALLS_PER_MINUTE", callsPerNetworkMinute: "MCP_CALLS_PER_NETWORK_MINUTE" };
	const result: Partial<Limits> = {};
	for (const [key, name] of Object.entries(settings)) {
		const value = process.env[name];
		if (value !== undefined) {
			if (!/^[1-9]\d*$/.test(value)) throw new Error("SERVICE_UNAVAILABLE");
			result[key as keyof Limits] = Number(value);
		}
	}
	return result;
}

/** Only trust a configured proxy header when ingress strips client-supplied copies. */
export function getMcpNetworkSignal(request: Request): string {
	const header = process.env.MCP_TRUSTED_IP_HEADER;
	if (!header) return "unknown-network";
	if (!/^[a-z0-9-]{1,80}$/i.test(header)) throw new Error("SERVICE_UNAVAILABLE");
	const address = request.headers.get(header)?.trim();
	if (!address || !isIP(address)) throw new Error("SERVICE_UNAVAILABLE");
	return address;
}

/** Shared counters serialize callers across replicas; denied calls consume no budget. */
export async function consumeMcpRateLimit(input: Input, client: DatabaseClient = db): Promise<Decision> {
	const secret = process.env.RATE_LIMIT_HASH_SECRET;
	if (!secret || secret.length < 32 || !input.network || input.network.length > 255) throw new Error("SERVICE_UNAVAILABLE");
	const limits = { ...defaults, ...input.limits };
	for (const key of Object.keys(defaults) as (keyof Limits)[]) {
		if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > defaults[key]) throw new Error("SERVICE_UNAVAILABLE");
	}
	if (input.kind === "call" && (!input.authUserId || !input.clientId)) throw new Error("AUTHENTICATION_REQUIRED");
	const now = input.now ?? new Date();
	if (!Number.isFinite(now.getTime())) throw new Error("SERVICE_UNAVAILABLE");
	const buckets =
		input.kind === "registration"
			? [
					{ action: "mcp:registration:day", type: "network", value: input.network, limit: limits.registrationsPerDay, window: 86400000 },
					{ action: "mcp:registration:minute", type: "network", value: input.network, limit: limits.registrationsPerMinute, window: 60000 },
				]
			: [
					{ action: "mcp:call:actor-client", type: "identity", value: JSON.stringify([input.authUserId, input.clientId]), limit: limits.callsPerMinute, window: 60000 },
					{ action: "mcp:call:network", type: "network", value: input.network, limit: limits.callsPerNetworkMinute, window: 60000 },
				];
	return client.transaction(async (tx) => {
		const counters = [];
		// Every caller takes bucket locks in the same action order.
		for (const bucket of buckets) {
			const hash = createHmac("sha256", secret).update(`${bucket.action}:${bucket.type}:`).update(bucket.value).digest("hex");
			const result = await tx.execute(sql`
				INSERT INTO rate_limit_counters (action,signal_type,signal_hash,count,window_started_at,expires_at,updated_at)
				VALUES (${bucket.action},${bucket.type}::rate_limit_signal,${hash},0,${now},${new Date(now.getTime() + bucket.window)},${now})
				ON CONFLICT (action,signal_type,signal_hash) DO UPDATE SET
					count = CASE WHEN rate_limit_counters.expires_at <= EXCLUDED.window_started_at THEN 0 ELSE rate_limit_counters.count END,
					window_started_at = CASE WHEN rate_limit_counters.expires_at <= EXCLUDED.window_started_at THEN EXCLUDED.window_started_at ELSE rate_limit_counters.window_started_at END,
					expires_at = CASE WHEN rate_limit_counters.expires_at <= EXCLUDED.window_started_at THEN EXCLUDED.expires_at ELSE rate_limit_counters.expires_at END,
					updated_at = EXCLUDED.updated_at
				RETURNING id,count,expires_at
			`);
			const row = result.rows[0] as { id: string; count: number; expires_at: Date };
			if (!row) throw new Error("SERVICE_UNAVAILABLE");
			counters.push({ ...bucket, ...row });
		}
		const denied = counters.filter((counter) => counter.count >= counter.limit);
		if (denied.length) return { allowed: false, code: "RATE_LIMITED", retryAfterSeconds: Math.max(...denied.map((counter) => Math.max(1, Math.ceil((new Date(counter.expires_at).getTime() - now.getTime()) / 1000)))) };
		for (const counter of counters) await tx.execute(sql`UPDATE rate_limit_counters SET count=count+1 WHERE id=${counter.id}`);
		return { allowed: true, remaining: Math.min(...counters.map((counter) => counter.limit - counter.count - 1)) };
	});
}
