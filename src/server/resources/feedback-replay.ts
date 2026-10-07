import "server-only";
import { createHash } from "node:crypto";
import { consumeAppRateLimit, refundAppRateLimit } from "@/server/rate-limit";
type Feedback = { creatorId: string; kind: "bug" | "suggestion"; message: string; retryKey: string };
type Receipt = { keys: string[]; digest: string; receiptId: string; submittedAt: number };
type ReplayState = { expiresAt: number; receipts: Receipt[] };
type Result = { receiptId: string; duplicate: boolean };
/** Feedback-specific replay state only; quota counting/expiry belongs to the shared library. */
export class FeedbackReplayCache {
	private users = new Map<string, ReplayState>();
	private pending = new Map<string, Promise<Result>>();
	constructor(private readonly maxUsers = 10000) {}
	async submit(userId: string, input: Feedback, send: () => string, now = Date.now()): Promise<Result> {
		if (!this.pending.has(userId) && this.pending.size >= this.maxUsers) throw new Error("SERVICE_UNAVAILABLE");
		const task = (this.pending.get(userId) ?? Promise.resolve()).catch(() => undefined).then(() => this.submitSerial(userId, input, send, now));
		this.pending.set(userId, task);
		try {
			return await task;
		} finally {
			if (this.pending.get(userId) === task) this.pending.delete(userId);
		}
	}
	private async submitSerial(userId: string, input: Feedback, send: () => string, now: number): Promise<Result> {
		for (const [user, value] of this.users) if (value.expiresAt <= now) this.users.delete(user);
		const state = this.users.get(userId) ?? { expiresAt: now + 86400000, receipts: [] };
		state.receipts = state.receipts.filter((value) => value.submittedAt > now - 86400000);
		const hash = (value: string) => createHash("sha256").update(value).digest("hex");
		const key = hash(input.retryKey);
		const digest = hash(JSON.stringify([input.creatorId, input.kind, input.message.trim()]));
		const previous = state.receipts.find((value) => value.keys.includes(key));
		if (previous && previous.digest !== digest) throw new Error("RETRY_CONFLICT");
		const duplicate = previous ?? state.receipts.find((value) => value.digest === digest);
		if (duplicate) {
			if (!previous) {
				if (duplicate.keys.length >= 5) throw new Error("RATE_LIMITED");
				duplicate.keys.push(key);
			}
			return { receiptId: duplicate.receiptId, duplicate: true };
		}
		if (!this.users.has(userId) && this.users.size >= this.maxUsers) throw new Error("SERVICE_UNAVAILABLE");
		const policy = { key: "mcp-feedback", points: 5, duration: 86400, identifier: userId };
		if (!(await consumeAppRateLimit(policy)).success) throw new Error("RATE_LIMITED");
		let receiptId: string;
		try {
			receiptId = send();
			if (!/^[a-f0-9]{32}$/.test(receiptId)) throw new Error("SERVICE_UNAVAILABLE");
		} catch (error) {
			await refundAppRateLimit(policy);
			throw error;
		}
		state.receipts.push({ keys: [key], digest, receiptId, submittedAt: now });
		state.expiresAt = now + 86400000;
		this.users.set(userId, state);
		return { receiptId, duplicate: false };
	}
}
