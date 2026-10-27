import "server-only";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { createHash } from "node:crypto";
import { db, type QueryClient } from "@/db/client";
import { auditEventsTable } from "@/db/schema";

type Outcome = "creator_created" | "trial_granted" | "checkout_created" | "first_playback" | "playback_day" | "payment_verified";

export async function recordProductOutcome(input: { outcome: Outcome; creatorId: string; key: string; occurredAt?: Date; metadata?: { amountMinor?: number; currency?: string; billingReason?: string; cycle?: string; source?: string } }, client: QueryClient = db) {
	// A deterministic UUID makes transaction retries and duplicate webhook deliveries one outcome.
	const deployment = resolveBaseUrl().origin;
	const hash = createHash("sha256")
		.update(JSON.stringify([deployment, input.outcome, input.creatorId, input.key]))
		.digest("hex");
	const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
	await client
		.insert(auditEventsTable)
		.values({
			id,
			occurredAt: input.occurredAt ?? new Date(),
			targetType: "creator",
			targetId: input.creatorId,
			action: `product:${input.outcome}`,
			outcome: "success",
			correlationId: id,
			metadata: { ...input.metadata, deployment },
		})
		.onConflictDoNothing({ target: auditEventsTable.id });
}
