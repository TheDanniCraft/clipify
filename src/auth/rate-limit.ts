export interface RateLimitCounter {
	key: string;
	count: number;
	expiresAt: Date;
}

export interface RateLimitState {
	counters: RateLimitCounter[];
}

export interface RateLimitRepository {
	transaction<T>(operation: (state: RateLimitState) => Promise<T>): Promise<T>;
}

export interface RateLimitRequest {
	identityKey: string;
	networkKey: string;
	action: string;
	limit: number;
	windowMs: number;
	now: Date;
}

export type RateLimitDecision = { allowed: true; remaining: number } | { allowed: false; code: "RATE_LIMITED"; retryAfterSeconds: number };

export function normalizeRateLimitSignal(value: string) {
	return value.trim().toLowerCase();
}

export async function consumeRateLimit(repository: RateLimitRepository, request: RateLimitRequest): Promise<RateLimitDecision> {
	return repository.transaction(async (state) => {
		const keys = [`${request.action}:identity:${normalizeRateLimitSignal(request.identityKey)}`, `${request.action}:network:${normalizeRateLimitSignal(request.networkKey)}`];
		const now = request.now.getTime();
		const counters = keys.map((key) => {
			let counter = state.counters.find((candidate) => candidate.key === key);
			if (!counter || now >= counter.expiresAt.getTime()) {
				if (counter) state.counters.splice(state.counters.indexOf(counter), 1);
				counter = { key, count: 0, expiresAt: new Date(now + request.windowMs) };
				state.counters.push(counter);
			}
			return counter;
		});
		const blocked = counters.find((counter) => counter.count >= request.limit);
		if (blocked) {
			return { allowed: false, code: "RATE_LIMITED", retryAfterSeconds: Math.max(1, Math.ceil((blocked.expiresAt.getTime() - now) / 1000)) };
		}
		for (const counter of counters) counter.count += 1;
		return { allowed: true, remaining: Math.max(0, request.limit - Math.max(...counters.map((counter) => counter.count))) };
	});
}

export async function consumeDatabaseRateLimit(request: RateLimitRequest): Promise<RateLimitDecision> {
	const [{ db }, { sql }, { createHmac }] = await Promise.all([import("@/db/client"), import("drizzle-orm"), import("node:crypto")]);
	const secret = process.env.RATE_LIMIT_HASH_SECRET;
	if (!secret) throw new Error("RATE_LIMIT_HASH_SECRET must be injected by Infisical");
	const signals = [
		["identity", request.identityKey],
		["network", request.networkKey],
	] as const;
	return db.transaction(async (transaction) => {
		let highestCount = 0;
		let retryAfterSeconds = 0;
		for (const [signalType, rawSignal] of signals) {
			const signalHash = createHmac("sha256", secret).update(normalizeRateLimitSignal(rawSignal)).digest("hex");
			const result = await transaction.execute(sql`
				INSERT INTO "rate_limit_counters" ("action", "signal_type", "signal_hash", "count", "window_started_at", "expires_at", "updated_at")
				VALUES (${request.action}, ${signalType}::"rate_limit_signal", ${signalHash}, 1, ${request.now}, ${new Date(request.now.getTime() + request.windowMs)}, ${request.now})
				ON CONFLICT ("action", "signal_type", "signal_hash") DO UPDATE SET
					"count" = CASE WHEN "rate_limit_counters"."expires_at" <= EXCLUDED."window_started_at" THEN 1 ELSE "rate_limit_counters"."count" + 1 END,
					"window_started_at" = CASE WHEN "rate_limit_counters"."expires_at" <= EXCLUDED."window_started_at" THEN EXCLUDED."window_started_at" ELSE "rate_limit_counters"."window_started_at" END,
					"expires_at" = CASE WHEN "rate_limit_counters"."expires_at" <= EXCLUDED."window_started_at" THEN EXCLUDED."expires_at" ELSE "rate_limit_counters"."expires_at" END,
					"updated_at" = EXCLUDED."updated_at"
				RETURNING "count", "expires_at"
			`);
			const row = result.rows[0] as { count: number; expires_at: Date };
			highestCount = Math.max(highestCount, Number(row.count));
			if (Number(row.count) > request.limit) retryAfterSeconds = Math.max(retryAfterSeconds, Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - request.now.getTime()) / 1000)));
		}
		return retryAfterSeconds > 0 ? { allowed: false as const, code: "RATE_LIMITED" as const, retryAfterSeconds } : { allowed: true as const, remaining: Math.max(0, request.limit - highestCount) };
	});
}
