import "server-only";
import { isPreviewEnv, resolveBaseUrl } from "@lib/baseUrl";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, or, gt } from "drizzle-orm";
import { db, type DatabaseClient } from "@/db/client";
import type { TransactionClient } from "@/db/client";
import { overlayEffectJobsTable, overlaysTable } from "@/db/schema";
/** Called inside the resource transaction; provider I/O belongs to the worker. */
export async function enqueueOverlayRewardEffect(tx: TransactionClient, input: { overlayId: string; creatorId: string; rewardId: string; configurationRevision: number }) {
	await tx.insert(overlayEffectJobsTable).values(input);
}

/** Claims commit before provider calls; acknowledgements require the same lease. */
export async function runOverlayRewardEffects(input: { client?: DatabaseClient; now?: Date; batchSize?: number; sendReward: (creatorId: string, rewardId: string) => Promise<void> }) {
	const client = input.client ?? db;
	const now = input.now ?? new Date();
	const limit = input.batchSize ?? 20;
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(now.getTime())) throw new Error("INVALID_INPUT");
	const worker = randomUUID();
	const started = performance.now();
	const jobs = await client.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(overlayEffectJobsTable)
			.where(or(and(inArray(overlayEffectJobsTable.status, ["pending", "retry"]), lte(overlayEffectJobsTable.scheduledAt, now)), and(eq(overlayEffectJobsTable.status, "claimed"), lte(overlayEffectJobsTable.claimExpiresAt, now))))
			.orderBy(asc(overlayEffectJobsTable.scheduledAt), asc(overlayEffectJobsTable.id))
			.limit(limit)
			.for("update", { skipLocked: true });
		for (const job of rows)
			await tx
				.update(overlayEffectJobsTable)
				.set({ status: "claimed", claimedBy: worker, claimExpiresAt: new Date(now.getTime() + 30000), attempts: job.attempts + 1, updatedAt: now })
				.where(eq(overlayEffectJobsTable.id, job.id));
		return rows;
	});
	for (const job of jobs) {
		const currentTime = new Date(now.getTime() + Math.max(0, performance.now() - started));
		const [lease] = await client
			.update(overlayEffectJobsTable)
			.set({ claimExpiresAt: new Date(currentTime.getTime() + 30000), updatedAt: currentTime })
			.where(and(eq(overlayEffectJobsTable.id, job.id), eq(overlayEffectJobsTable.status, "claimed"), eq(overlayEffectJobsTable.claimedBy, worker), gt(overlayEffectJobsTable.claimExpiresAt, currentTime)))
			.returning({ id: overlayEffectJobsTable.id });
		if (!lease) continue;

		const [current] = await client.select({ ownerId: overlaysTable.ownerId, rewardId: overlaysTable.rewardId }).from(overlaysTable).where(eq(overlaysTable.id, job.overlayId)).limit(1);
		const desired = current?.ownerId === job.creatorId && current.rewardId === job.rewardId;
		let success = false;
		try {
			if (desired) await input.sendReward(job.creatorId, job.rewardId);
			success = true;
		} catch {
			/* Keep raw provider errors and credentials out of persisted state. */
		}
		await client
			.update(overlayEffectJobsTable)
			.set({
				status: !desired ? "obsolete" : success ? "done" : "retry",
				lastError: success ? null : "provider_unavailable",
				scheduledAt: success ? now : new Date(now.getTime() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7))),
				claimedBy: null,
				claimExpiresAt: null,
				updatedAt: now,
			})
			.where(and(eq(overlayEffectJobsTable.id, job.id), eq(overlayEffectJobsTable.status, "claimed"), eq(overlayEffectJobsTable.claimedBy, worker)));
	}
	return jobs.length;
}

/** Fixed provider endpoints and a single deadline cover credentials, body and subscription. */
export async function subscribeOverlayReward(creatorId: string, rewardId: string) {
	const controller = new AbortController();
	let rejectDeadline!: (error: Error) => void;
	const deadline = new Promise<never>((_, reject) => {
		rejectDeadline = reject;
	});
	const timer = setTimeout(() => {
		rejectDeadline(new Error("provider_unavailable"));
		controller.abort();
	}, 10000);
	try {
		const exchange = async () => {
			const clientId = process.env.TWITCH_CLIENT_ID;
			const clientSecret = process.env.TWITCH_CLIENT_SECRET;
			const secret = process.env.WEBHOOK_SECRET;
			const callback = isPreviewEnv() ? new URL("/eventsub", resolveBaseUrl()).toString() : process.env.TWITCH_EVENTSUB_URL;
			if (!clientId || !clientSecret || !secret || !callback) throw new Error("provider_unavailable");
			const callbackUrl = new URL(callback);
			if (callbackUrl.protocol !== "https:" || (callbackUrl.port && callbackUrl.port !== "443") || callbackUrl.username || callbackUrl.password || !/^[\u0000-\u007f]{10,100}$/.test(secret)) throw new Error("provider_unavailable");
			const response = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }), redirect: "error", signal: controller.signal });
			if (response.status !== 200) {
				void response.body?.cancel().catch(() => {});
				throw new Error("provider_unavailable");
			}
			const token = await readRewardAppToken(response);
			const subscription = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
				method: "POST",
				redirect: "error",
				signal: controller.signal,
				headers: { "Content-Type": "application/json", "Client-Id": clientId, Authorization: `Bearer ${token}` },
				body: JSON.stringify({ type: "channel.channel_points_custom_reward_redemption.add", version: "1", condition: { broadcaster_user_id: creatorId, reward_id: rewardId }, transport: { method: "webhook", callback, secret } }),
			});
			void subscription.body?.cancel().catch(() => {});
			if (subscription.status !== 202 && subscription.status !== 409) throw new Error("provider_unavailable");
		};
		await Promise.race([exchange(), deadline]);
	} catch {
		throw new Error("provider_unavailable");
	} finally {
		clearTimeout(timer);
	}
}

async function readRewardAppToken(response: Response): Promise<string> {
	const maximum = 64 * 1024;
	const declared = response.headers.get("content-length");
	if (!response.body || (declared && /^\d+$/.test(declared) && Number(declared) > maximum)) {
		void response.body?.cancel().catch(() => {});
		throw new Error("provider_unavailable");
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let complete = false;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			size += next.value.byteLength;
			if (size > maximum) throw new Error("provider_unavailable");
			chunks.push(next.value);
		}
		complete = true;
	} finally {
		if (!complete) void reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	const token: unknown = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks, size)));
	if (!token || typeof token !== "object" || Array.isArray(token)) throw new Error("provider_unavailable");
	const values = token as Record<string, unknown>;
	if (typeof values.access_token !== "string" || !values.access_token.length || values.access_token.trim() !== values.access_token || values.token_type !== "bearer" || typeof values.expires_in !== "number" || !Number.isSafeInteger(values.expires_in) || values.expires_in <= 0) throw new Error("provider_unavailable");
	return values.access_token;
}
