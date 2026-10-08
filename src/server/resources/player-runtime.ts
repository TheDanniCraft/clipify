import "server-only";
import { z } from "zod";
const clipId = z.string().max(255).nullable();
const text = z.string().max(1000).nullable();
const clip = z.object({ clipId, title: text, creatorName: text.default(null), duration: z.number().finite().min(0).max(3600).nullable(), thumbnailUrl: z.string().url().max(2048).nullable().default(null) });
const reports = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("playback_state"), paused: z.boolean(), showPlayer: z.boolean(), volume: z.number().finite().min(0).max(100), muted: z.boolean() }),
	clip.extend({ kind: z.literal("now_playing"), currentTime: z.number().finite().min(0).max(3600) }),
	z.object({ kind: z.literal("queue_preview"), items: z.array(clip).max(100) }),
	z.object({ kind: z.literal("heartbeat"), playerAttached: z.boolean(), paused: z.boolean(), showPlayer: z.boolean(), standby: z.boolean() }),
]);
type Entry = { updatedAt: number; reports: Partial<Record<"playback_state" | "now_playing" | "queue_preview" | "heartbeat", { receivedAt: number; data: Record<string, unknown> }>> };
declare global {
	var __clipifyPlayerReports: Map<string, Entry> | undefined;
}
const entries = globalThis.__clipifyPlayerReports ?? (globalThis.__clipifyPlayerReports = new Map());
/** Only the authenticated websocket overlay ID may identify a report. */
export function recordPlayerRuntime(overlayId: string, payload: unknown, now = Date.now()) {
	const parsed = reports.safeParse(payload);
	if (!parsed.success) return false;
	const { kind, ...data } = parsed.data;
	const current = entries.get(overlayId) ?? { updatedAt: now, reports: {} };
	current.updatedAt = now;
	current.reports[kind] = { receivedAt: now, data };
	entries.delete(overlayId);
	entries.set(overlayId, current);
	for (const [id, value] of entries) if (now - value.updatedAt > 60_000) entries.delete(id);
	while (entries.size > 1000) entries.delete(entries.keys().next().value!);
	return true;
}
export function getPlayerRuntime(overlayId: string, connected: boolean, now = Date.now()) {
	const entry = entries.get(overlayId);
	const heartbeat = entry?.reports.heartbeat;
	const age = entry ? now - entry.updatedAt : null;
	const status = !connected ? "disconnected" : !entry ? "unavailable" : age! > 5000 || !heartbeat || now - heartbeat.receivedAt > 5000 ? "stale" : heartbeat.data.playerAttached ? "connected" : "player_missing";
	const project = (kind: keyof Entry["reports"]) => {
		const report = entry?.reports[kind];
		return report ? { ...report.data, reportedAt: new Date(report.receivedAt).toISOString(), stale: now - report.receivedAt > 5000 } : null;
	};
	return { overlayId, status, source: "current_server_instance", observedAt: new Date(now).toISOString(), reportedAt: entry ? new Date(entry.updatedAt).toISOString() : null, ageMs: age, playback: project("playback_state"), nowPlaying: project("now_playing"), queuePreview: project("queue_preview"), heartbeat: project("heartbeat") };
}
