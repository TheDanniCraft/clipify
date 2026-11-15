import "server-only";
import { sql } from "drizzle-orm";
import type { QueryClient } from "@/db/client";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

// Fixed process counters describe service operations, never individual journeys.
const operations = ["authSessionCreated", "checkoutRequested", "checkoutCreated", "checkoutUnavailable", "checkoutAlreadyOwned", "webhookReceived", "webhookFailed", "webhookProcessed", "analyticsConsentExcluded"] as const;
type Operation = (typeof operations)[number];
declare global {
	var __conversionOperations: Record<Operation, number> | undefined;
}
export function recordConversionOperation(operation: Operation) {
	globalThis.__conversionOperations ??= Object.fromEntries(operations.map((key) => [key, 0])) as Record<Operation, number>;
	globalThis.__conversionOperations[operation] = (globalThis.__conversionOperations[operation] ?? 0) + 1;
}
export function getConversionOperations() {
	return Object.fromEntries(operations.map((key) => [key, globalThis.__conversionOperations?.[key] ?? 0])) as Record<Operation, number>;
}

/** Rolling, database-owned counts; no account identifiers leave this boundary. */
export async function getConversionHealth(db: QueryClient, now: Date) {
	const result = await db.execute(sql`
		WITH events AS (
			SELECT target_id, action, occurred_at FROM audit_events
			WHERE action IN ('product:creator_created','product:first_playback','product:checkout_created','product:payment_verified','product:payment_failed')
			AND metadata->>'deployment' = ${resolveBaseUrl().origin} AND occurred_at >= ${new Date(now.getTime() - 30 * 86400000)} AND occurred_at <= ${now}
		), cohort AS (
			SELECT target_id, min(occurred_at) AS joined FROM events
			WHERE action='product:creator_created' AND occurred_at >= ${new Date(now.getTime() - 30 * 86400000)} GROUP BY target_id
		)
		SELECT count(*) AS signups,
		count(*) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.target_id=c.target_id AND e.action='product:first_playback' AND e.occurred_at>=c.joined)) AS activated,
		count(*) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.target_id=c.target_id AND e.action='product:checkout_created' AND e.occurred_at>=c.joined)) AS checkout,
		count(*) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.target_id=c.target_id AND e.action='product:payment_verified' AND e.occurred_at>=c.joined)) AS paid,
		count(*) FILTER (WHERE c.joined <= ${new Date(now.getTime() - 7 * 86400000)}) AS mature,
		count(*) FILTER (WHERE c.joined <= ${new Date(now.getTime() - 7 * 86400000)} AND EXISTS (SELECT 1 FROM events e WHERE e.target_id=c.target_id AND e.action='product:first_playback' AND e.occurred_at>=c.joined AND e.occurred_at<c.joined+interval '7 days')) AS activated_week_one,
		(SELECT count(*) FROM billing_webhook_events WHERE status='failed') AS webhook_failed,
		(SELECT count(*) FROM billing_webhook_events WHERE status='processing' AND (processing_started_at IS NULL OR processing_started_at < ${new Date(now.getTime() - 5 * 60000)})) AS webhook_stale,
		(SELECT greatest(0,coalesce(extract(epoch FROM (${now}::timestamptz-min(coalesce(processing_started_at,received_at)))),0)) FROM billing_webhook_events WHERE status='processing') AS webhook_age
		FROM cohort c
	`);
	const row = result.rows[0] ?? {};
	return { signups30d: Number(row.signups ?? 0), activated30d: Number(row.activated ?? 0), checkoutCreators30d: Number(row.checkout ?? 0), paidCreators30d: Number(row.paid ?? 0), mature7dCreators: Number(row.mature ?? 0), activatedWithin7d: Number(row.activated_week_one ?? 0), webhooks: { failed: Number(row.webhook_failed ?? 0), staleProcessing: Number(row.webhook_stale ?? 0), oldestProcessingAgeSeconds: Number(row.webhook_age ?? 0) }, operations: getConversionOperations() };
}
