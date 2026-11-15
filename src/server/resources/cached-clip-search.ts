import "server-only";
import { z } from "zod";
import { fetchClipDiscovery, publicClip } from "./clip-discovery";
import { encodePageCursor, decodePageCursor } from "@/server/mcp/pagination";
import { workflowInputSchemas } from "@/server/mcp/workflows/schemas";
const position = z.object({ snapshot: z.string().length(64).optional(), offset: z.number().int().min(0).max(2_147_483_647), until: z.iso.datetime() }).strict();
export async function searchCachedClips(input: z.infer<typeof workflowInputSchemas.search_clips>, identity: string) {
	const context = `${identity}:cached-clips:${input.creatorId}:${JSON.stringify(input.filters)}`;
	const current = input.cursor ? position.parse(JSON.parse(decodePageCursor(input.cursor, context))) : { offset: 0, until: input.filters.endedAt ? new Date(input.filters.endedAt).toISOString() : new Date().toISOString() };
	const batch = await fetchClipDiscovery(input.creatorId, { ...input.filters, endedAt: current.until });
	if (current.snapshot && current.snapshot !== batch.snapshot) throw new Error("CONFLICT");
	const items = batch.clips.slice(current.offset, current.offset + input.limit).map(publicClip);
	const offset = current.offset + items.length;
	const next = offset < batch.clips.length ? { ...current, snapshot: batch.snapshot, offset } : null;
	return { creatorId: input.creatorId, items, complete: batch.complete, sortScope: "cached_collection", scanned: batch.scanned, timezone: input.filters.timezone, window: { startedAt: input.filters.startedAt ?? null, endedAt: current.until }, nextCursor: next ? encodePageCursor(JSON.stringify(next), context) : null };
}
