import "server-only";
import { and, eq, gt, inArray, isNull, sql, ne, desc } from "drizzle-orm";
import { z } from "zod";
import { db, type DatabaseClient, type QueryClient } from "@/db/client";
import { runnerScheduleEventsTable as events, runnerDestinationsTable as destinations, runnerBroadcastAdmissionsTable as admissions, runnersTable as runners, usersTable as users } from "@/db/schema";
import { streamDetailsSchema, resolveStreamDetails, resultSchema } from "./provider-contract";
import { withStreamingConnection } from "./provider-connections";
import { findYoutubeBroadcast, updateStreamingMetadata, updateYoutubeThumbnail, ProviderRequestError } from "./provider-api";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "./capabilities";
import { readOwnedRunnerBrandingAsset } from "./branding-assets";
const snapshotSchema = z.array(z.object({ destinationId: z.uuid(), connectionId: z.uuid(), provider: z.enum(["twitch", "youtube"]), providerStreamId: z.string().nullable().optional(), title: z.string().min(1).max(100), description: z.string().max(5000).optional(), categoryId: z.string().optional(), thumbnailAssetId: z.uuid().optional() })).max(128);
export async function captureBroadcastDetails(tx: QueryClient, ownerId: string, eventId: string, occurrenceId?: string) {
	const [event] = await tx
		.select()
		.from(events)
		.where(and(eq(events.ownerId, ownerId), eq(events.id, eventId)))
		.limit(1);
	if (occurrenceId) {
		const previous = await tx
			.select({ benefits: admissions.benefitsAtStart })
			.from(admissions)
			.where(and(eq(admissions.ownerId, ownerId), eq(admissions.occurrenceId, occurrenceId)))
			.orderBy(desc(admissions.dispatchedAt))
			.limit(16);
		const retained = previous.find((row) => row.benefits.scheduleEventRevision === event?.configurationRevision && Array.isArray(row.benefits.streamDetailsAtStart));
		const captured = snapshotSchema.safeParse(retained?.benefits.streamDetailsAtStart);
		if (captured.success) return captured.data;
	}
	if (!event?.setStreamDetails) return [];
	const parsed = streamDetailsSchema.safeParse(event.streamDetails);
	if (!parsed.success) return [];
	const rows = parsed.data.length
		? await tx
				.select()
				.from(destinations)
				.where(
					and(
						eq(destinations.ownerId, ownerId),
						inArray(
							destinations.id,
							parsed.data.map((detail) => detail.destinationId),
						),
					),
				)
		: [];
	return parsed.data.flatMap((detail) => {
		const destination = rows.find((row) => row.id === detail.destinationId);
		const resolved = resolveStreamDetails(true, event.title, detail);
		return destination?.connectionId && destination.provider !== "custom" && resolved ? [{ ...resolved, destinationId: destination.id, connectionId: destination.connectionId, provider: destination.provider, providerStreamId: destination.providerStreamId }] : [];
	});
}
/** Cache generation captures details; only a connected Runner at the due window applies them. */
export async function applyRunnerBroadcastDetails(runner: { id: string; ownerId: string; token: string }, client: DatabaseClient = db, clock = Date.now) {
	return client.transaction(async (tx) => {
		const [owner] = await tx.select().from(users).where(eq(users.id, runner.ownerId)).limit(1).for("update");
		const [device] = await tx
			.select()
			.from(runners)
			.where(and(eq(runners.id, runner.id), eq(runners.ownerId, runner.ownerId), eq(runners.token, runner.token)))
			.limit(1);
		if (!owner || owner.disabled || !device || !deriveRunnerCapabilities(await resolveRunnerBenefits(owner, tx, new Date(clock())), new Date(clock())).scheduling) return;
		const rows = await tx
			.select()
			.from(admissions)
			.where(and(eq(admissions.ownerId, owner.id), eq(admissions.runnerId, device.id), isNull(admissions.revokedAt), inArray(admissions.state, ["authorized", "reserved", "starting", "active"]), gt(admissions.scheduledEnd, new Date(clock())), sql`jsonb_typeof(${admissions.benefitsAtStart}->'scheduledStart')='number' AND (${admissions.benefitsAtStart}->>'scheduledStart')::numeric <= ${clock()}`, sql`jsonb_typeof(${admissions.benefitsAtStart}->'streamDetailsAtStart')='array'`))
			.orderBy(sql`coalesce(${admissions.benefitsAtStart}->>'streamDetailsLastAttemptAt','0')`)
			.limit(8)
			.for("update");
		let remaining = 1;
		const deadline = AbortSignal.timeout(10000);
		for (const row of rows) {
			if (row.benefitsAtStart.scheduleSuppressed === true) continue;
			const eventId = row.benefitsAtStart.scheduleEventId;
			if (typeof eventId !== "string" || !z.uuid().safeParse(eventId).success) continue;
			const [event] = await tx
				.select({ revision: events.configurationRevision })
				.from(events)
				.where(and(eq(events.ownerId, owner.id), eq(events.id, eventId)))
				.limit(1);
			if (!event || event.revision !== row.benefitsAtStart.scheduleEventRevision) continue;
			const parsed = snapshotSchema.safeParse(row.benefitsAtStart.streamDetailsAtStart);
			if (!parsed.success) continue;
			const results = resultSchema.safeParse(row.benefitsAtStart.streamDetailsResults).data ?? {};
			if (row.occurrenceId) {
				const previous = await tx
					.select({ benefits: admissions.benefitsAtStart })
					.from(admissions)
					.where(and(eq(admissions.ownerId, owner.id), eq(admissions.occurrenceId, row.occurrenceId), ne(admissions.id, row.id)))
					.limit(32);
				for (const attempt of previous) {
					for (const [id, result] of Object.entries(resultSchema.safeParse(attempt.benefits.streamDetailsResults).data ?? {})) {
						if (result.status === "applied") results[id] = result;
					}
				}
			}
			for (const detail of parsed.data) {
				const previous = results[detail.destinationId];
				if (previous?.status === "applied" || (previous && clock() - previous.attemptedAt < 60000) || remaining <= 0) continue;
				remaining--;
				const outcome = await withStreamingConnection(tx, owner.id, detail.connectionId, async (context) => {
					context.signal = deadline;
					if (context.provider !== detail.provider) throw new ProviderRequestError("RECONNECT_REQUIRED");
					const broadcastId = context.provider === "youtube" && detail.providerStreamId ? await findYoutubeBroadcast(context, detail.providerStreamId) : undefined;
					await updateStreamingMetadata(context, detail, broadcastId);
					if (context.provider === "youtube" && detail.thumbnailAssetId && broadcastId) {
						const image = await readOwnedRunnerBrandingAsset(owner.id, detail.thumbnailAssetId, "background", tx);
						if (!image) throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
						await updateYoutubeThumbnail(context, broadcastId, { bytes: image.bytes, mime: image.normalizedMime });
					}
				});
				results[detail.destinationId] = outcome.success ? { status: "applied", attemptedAt: clock() } : { status: outcome.code === "RECONNECT_REQUIRED" ? "reconnect" : "retry", attemptedAt: clock(), error: outcome.error };
			}
			await tx
				.update(admissions)
				.set({ benefitsAtStart: { ...row.benefitsAtStart, streamDetailsResults: results, streamDetailsLastAttemptAt: clock() } })
				.where(eq(admissions.id, row.id));
		}
	});
}
