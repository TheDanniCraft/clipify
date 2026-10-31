import "server-only";
import { after } from "next/server";
import { db } from "@/db/client";
import { auditEventsTable, creatorIdentityLinksTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordCreatorAnalyticsMetric } from "@/app/lib/plausibleCreatorAnalytics";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

import type { RequestConsentState } from "@c15t/core/server";

type EventData = Record<string, string | number | boolean | null | undefined>;
const baseUrl = () => (process.env.UMAMI_BASE_URL || "https://umami.cloud.thedannicraft.de").replace(/\/$/, "");
export const umamiWebsiteId = () => process.env.UMAMI_WEBSITE_ID || "";

export async function queryUmami<T>(endpoint: string, parameters: Record<string, string | number>) {
	const key = process.env.UMAMI_API_KEY;
	if (!key) throw new Error("UMAMI_API_KEY is not configured");
	if (!umamiWebsiteId()) throw new Error("UMAMI_WEBSITE_ID is not configured");
	const query = new URLSearchParams(Object.entries(parameters).map(([name, value]) => [name, String(value)]));
	const started = Date.now();
	const response = await fetch(`${baseUrl()}/api/websites/${umamiWebsiteId()}${endpoint}?${query}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
	recordCreatorAnalyticsMetric("apiRequests", Date.now() - started);
	if (response.status === 429) recordCreatorAnalyticsMetric("rateLimited");
	if (!response.ok) throw new Error(`Umami ${endpoint} returned ${response.status}`);
	return response.json() as Promise<T>;
}

/** Official native ingestion at the outcome owner, never a frontend event relay. */
export async function sendServerProductEvent(authUserId: string, name: string, data: EventData, requestState?: RequestConsentState) {
	if (process.env.E2E_TEST_MODE === "true" || !umamiWebsiteId()) return;
	try {
		const { readAnalyticsConsent, linkRequestAnalyticsSubject } = await import("./analytics-consent");
		if (requestState && !(await linkRequestAnalyticsSubject(authUserId, requestState))) return;
		if (!(await readAnalyticsConsent(authUserId, requestState))) return;
		await fetch(`${baseUrl()}/api/send`, {
			method: "POST",
			// No browser agent exists for a verified background outcome.
			headers: { "Content-Type": "application/json", "User-Agent": "" },
			body: JSON.stringify({ type: "event", payload: { website: umamiWebsiteId(), hostname: resolveBaseUrl().hostname, url: "/dashboard", id: authUserId, name, tag: "server", data } }),
			signal: AbortSignal.timeout(2000),
		});
	} catch {
		// Optional measurement must not fail a payment, save or playback.
	}
}

export function trackServerProductEvent(authUserId: string, name: string, data: EventData) {
	if (typeof authUserId !== "string" || !authUserId || process.env.E2E_TEST_MODE === "true" || !umamiWebsiteId()) return;
	try {
		after(async () => sendServerProductEvent(authUserId, name, data, await requestState));
		const requestState = import("./analytics-consent").then(({ readRequestAnalyticsState }) => readRequestAnalyticsState()).catch(() => undefined);
	} catch {
		/* No request lifecycle exists in offline tools. */
	}
}

export function trackCommittedCreatorOutcome(creatorId: string, outcomeId: string, name: string, data: EventData) {
	if (process.env.E2E_TEST_MODE === "true" || !umamiWebsiteId()) return;
	try {
		after(async () => {
			try {
				// This single outcome lookup prevents exporting a transaction that rolled back.
				const committed = await db.select({ id: auditEventsTable.id }).from(auditEventsTable).where(eq(auditEventsTable.id, outcomeId)).limit(1);
				if (!committed.length) return;
				const links = await db.select({ authUserId: creatorIdentityLinksTable.authUserId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, creatorId)).limit(1);
				if (links[0]) await sendServerProductEvent(links[0].authUserId, name, data, name === "creator_created" || name === "trial_granted" ? await requestState : undefined);
			} catch {
				/* Analytics has no bearing on the committed business outcome. */
			}
		});
		const requestState = name === "creator_created" || name === "trial_granted" ? import("./analytics-consent").then(({ readRequestAnalyticsState }) => readRequestAnalyticsState()).catch(() => undefined) : undefined;
	} catch {
		/* Offline tools have no Next response lifecycle. */
	}
}

/** Transaction-owned audit IDs prevent optional events for rolled-back work. */
export function trackCommittedProductEvent(authUserId: string, auditId: string, name: string, data: EventData) {
	if (typeof authUserId !== "string" || !authUserId || process.env.E2E_TEST_MODE === "true" || !umamiWebsiteId()) return;
	try {
		after(async () => {
			try {
				const committed = await db.select({ id: auditEventsTable.id }).from(auditEventsTable).where(eq(auditEventsTable.id, auditId)).limit(1);
				if (committed.length) await sendServerProductEvent(authUserId, name, data, await requestState);
			} catch {
				/* Measurement does not affect the committed operation. */
			}
		});
		const requestState = import("./analytics-consent").then(({ readRequestAnalyticsState }) => readRequestAnalyticsState()).catch(() => undefined);
	} catch {
		/* Offline tools have no response lifecycle. */
	}
}
