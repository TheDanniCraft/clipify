import "server-only";
import { and, eq } from "drizzle-orm";
import { overlaysTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { overlaySubscribers } from "@store/overlaySubscribers";
import { workflowOperation } from "./workflow";
import { getPlayerRuntime } from "./player-runtime";
export function getOverlayRuntime(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_overlay_runtime",
		input,
		async (input, { tx }) => {
			const [overlay] = await tx
				.select({ id: overlaysTable.id })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const connected = [...(overlaySubscribers.get(overlay.id) ?? [])].some((ws) => ws.role === "overlay" && ws.ownerId === input.creatorId && ws.readyState === 1);
			return getPlayerRuntime(overlay.id, connected);
		},
		client,
	);
}

import { asc, gt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { queueTable, modQueueTable } from "@/db/schema";
import { decodePageCursor, encodePageCursor } from "@/server/mcp/pagination";
export function getOverlayQueues(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_overlay_queues",
		input,
		async (input, { tx }) => {
			const [overlay] = await tx
				.select({ id: overlaysTable.id })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const context = `${principal.grantId}:${principal.generation}:remote-queues:${input.creatorId}:${input.overlayId}`;
			let after: [string, string, "moderator" | "viewer"] | undefined;
			if (input.cursor) {
				try {
					after = z.tuple([z.string().regex(/^\d{1,20}$/), z.string().uuid(), z.enum(["moderator", "viewer"])]).parse(JSON.parse(decodePageCursor(input.cursor, context)));
				} catch {
					throw new Error("INVALID_INPUT");
				}
			}
			// Keep the database's microsecond precision in the cursor; JS Date truncates it.
			const viewerTicks = sql<string>`((extract(epoch from ${queueTable.queuedAt}) * 1000000)::bigint)::text`;
			const moderatorTicks = sql<string>`((extract(epoch from ${modQueueTable.queuedAt}) * 1000000)::bigint)::text`;
			const boundary = (table: typeof queueTable | typeof modQueueTable, queue: "viewer" | "moderator") => (after ? or(sql`(extract(epoch from ${table.queuedAt}) * 1000000)::bigint > ${after[0]}::bigint`, and(sql`(extract(epoch from ${table.queuedAt}) * 1000000)::bigint = ${after[0]}::bigint`, or(gt(table.id, after[1]), queue > after[2] ? eq(table.id, after[1]) : undefined))) : undefined);
			const [viewer, moderator] = await Promise.all([
				tx
					.select({ id: queueTable.id, clipId: queueTable.clipId, queuedAt: queueTable.queuedAt, microTicks: viewerTicks })
					.from(queueTable)
					.where(and(eq(queueTable.overlayId, overlay.id), boundary(queueTable, "viewer")))
					.orderBy(asc(queueTable.queuedAt), asc(queueTable.id))
					.limit(input.limit + 1),
				tx
					.select({ id: modQueueTable.id, clipId: modQueueTable.clipId, queuedAt: modQueueTable.queuedAt, microTicks: moderatorTicks })
					.from(modQueueTable)
					.where(and(eq(modQueueTable.broadcasterId, input.creatorId), boundary(modQueueTable, "moderator")))
					.orderBy(asc(modQueueTable.queuedAt), asc(modQueueTable.id))
					.limit(input.limit + 1),
			]);
			const rows = [...viewer.map((row) => ({ ...row, queue: "viewer" })), ...moderator.map((row) => ({ ...row, queue: "moderator" }))].sort((a, b) => (BigInt(a.microTicks) < BigInt(b.microTicks) ? -1 : BigInt(a.microTicks) > BigInt(b.microTicks) ? 1 : a.id.localeCompare(b.id) || a.queue.localeCompare(b.queue)));
			const page = rows.slice(0, input.limit);
			const items = page.map((row) => ({ id: row.id, clipId: row.clipId, queue: row.queue, queuedAt: row.queuedAt.toISOString() }));
			const last = page.at(-1);
			return { overlayId: overlay.id, creatorId: input.creatorId, items, targets: { viewer: "overlay", moderator: "creator" }, nextCursor: rows.length > input.limit && last ? encodePageCursor(JSON.stringify([last.microTicks, last.id, last.queue]), context) : null };
		},
		client,
	);
}

import { sendMessage } from "@actions/websocket";
export function controlOverlay(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"control_overlay",
		input,
		async (input, { tx, assertCurrent }) => {
			const [overlay] = await tx
				.select({ id: overlaysTable.id, status: overlaysTable.status })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const connected = overlay.status === "active" && [...(overlaySubscribers.get(overlay.id) ?? [])].some((ws) => ws.role === "overlay" && ws.ownerId === input.creatorId && ws.readyState === 1);
			const runtime = getPlayerRuntime(overlay.id, connected);
			const response = { overlayId: overlay.id, command: input.command, target: "overlay", applied: false };
			if (runtime.status !== "connected") return { ...response, status: "player_unavailable" };
			assertCurrent();
			await sendMessage("command", { name: input.command, data: input.command === "volume" ? String(input.volume) : null }, undefined, overlay.id);
			return { ...response, status: "sent", observedState: runtime };
		},
		client,
	);
}

import { workflowRetry } from "./workflow";
import { parseClipReference } from "./clip-references";
import { resolveValidatedPlaylistClips } from "./clip-validation";
export function enqueueOverlayClip(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"enqueue_overlay_clip",
		input,
		async (input, context) => {
			const [overlay] = await context.tx
				.select({ id: overlaysTable.id })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const clipId = parseClipReference(input.clip);
			return workflowRetry(context, "enqueue_overlay_clip", { ...input, clip: clipId }, async () => {
				const [clip] = await resolveValidatedPlaylistClips(input.creatorId, [clipId]);
				if (clip.broadcaster_id !== input.creatorId) throw new Error("INVALID_INPUT");
				context.assertCurrent();
				const [row] = await context.tx.insert(modQueueTable).values({ broadcasterId: input.creatorId, clipId }).returning({ id: modQueueTable.id });
				return { id: row.id, creatorId: input.creatorId, overlayId: input.overlayId, target: "creator", queue: "moderator", clipId, title: clip.title };
			});
		},
		client,
	);
}

export function clearOverlayQueue(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"clear_overlay_queue",
		input,
		async (input, { tx }) => {
			const [overlay] = await tx
				.select({ id: overlaysTable.id })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const removed = { viewer: 0, moderator: 0 };
			if (input.queue !== "moderator") removed.viewer = (await tx.delete(queueTable).where(eq(queueTable.overlayId, overlay.id)).returning({ id: queueTable.id })).length;
			if (input.queue !== "viewer") removed.moderator = (await tx.delete(modQueueTable).where(eq(modQueueTable.broadcasterId, input.creatorId)).returning({ id: modQueueTable.id })).length;
			return { overlayId: overlay.id, creatorId: input.creatorId, removed, targets: { viewer: "overlay", moderator: "creator" } };
		},
		client,
	);
}
