import "server-only";
import { and, desc, eq, exists, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable as events, usersTable as users, entitlementGrantsTable as grants } from "@/db/schema";
import { Entitlement, EntitlementGrantSource } from "@/app/lib/types";
import { eventPhase } from "@/app/lib/events";
export async function listPublicAwardEvents(now = new Date()) {
	try {
		const rows = await db
			.select({ id: events.id, configuration: events.configuration, publishedAt: events.publishedAt, resultsPublishedAt: events.resultsPublishedAt, reviewReleased: events.reviewReleased, creatorName: users.username })
			.from(events)
			.innerJoin(users, and(eq(users.id, events.ownerId), eq(users.disabled, false)))
			.where(
				and(
					isNotNull(events.publishedAt),
					sql`${events.configuration}->>'visibility' = 'public'`,
					exists(
						db
							.select({ id: grants.id })
							.from(grants)
							.where(and(eq(grants.userId, events.ownerId), eq(grants.entitlement, Entitlement.ProAccess), eq(grants.source, EntitlementGrantSource.Partner), isNull(grants.revokedAt), lte(grants.startsAt, now), or(isNull(grants.endsAt), gt(grants.endsAt, now)))),
					),
				),
			)
			.orderBy(desc(events.publishedAt), desc(events.id))
			.limit(100);
		return { ok: true as const, events: rows.map((event) => ({ id: event.id, title: event.configuration.title, description: event.configuration.description, creatorName: event.creatorName, startsAt: event.configuration.schedule.submissionsStart, phase: eventPhase({ schedule: event.configuration.schedule, published: true, resultsPublished: !!event.resultsPublishedAt, reviewReleased: event.reviewReleased }, now) })) };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" as const };
	}
}
