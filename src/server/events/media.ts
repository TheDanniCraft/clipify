import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { awardAssetsTable as assets, awardEventsTable as events, eventConnectionsTable as connections, awardCandidatesTable as candidates, usersTable } from "@/db/schema";
import { readAwardUpload } from "./upload-provider";
import { awardPhase } from "./submissions";
export async function serveAwardAsset(eventId: string, assetId: string, range: string | null, signal: AbortSignal, participantId?: string, teamAuthorized = false) {
	const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Referrer-Policy": "no-referrer" });
	const fail = (status: number) => new Response(null, { status, headers });
	if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(assetId)) return fail(404);
	try {
		const [row] = await db
			.select({ asset: assets, event: events, connection: connections, disabled: usersTable.disabled })
			.from(assets)
			.innerJoin(events, eq(events.id, assets.eventId))
			.innerJoin(connections, eq(connections.id, assets.connectionId))
			.innerJoin(usersTable, eq(usersTable.id, events.ownerId))
			.where(and(eq(assets.id, assetId), eq(assets.eventId, eventId), eq(assets.state, "completed")))
			.limit(1);
		if (!row || row.disabled || !row.event.publishedAt || row.connection.ownerId !== row.event.ownerId || !row.asset.providerKey) return fail(404);
		const own = participantId !== undefined && row.asset.authUserId === participantId;
		if (!own && !teamAuthorized) {
			const phase = awardPhase(row.event, new Date());
			if (phase === "announcement" || phase === "submissions") return fail(404);
			const visible = await db
				.select()
				.from(candidates)
				.where(and(eq(candidates.eventId, eventId), eq(candidates.categoryId, row.asset.categoryId), eq(candidates.nominated, true)));
			if (!visible.some((c) => !c.parentId && c.content.storageAssetId === assetId)) return fail(404);
			const category = row.event.configuration.categories.find((c) => c.id === row.asset.categoryId);
			if (!category || (category.selection === "data" && !row.event.resultsPublishedAt)) return fail(404);
		}
		const response = await readAwardUpload(row.connection, row.asset.providerKey, range, signal);
		if (response.status === 416) {
			await response.body?.cancel();
			const contentRange = response.headers.get("Content-Range");
			if (contentRange && /^bytes \*\/\d+$/.test(contentRange)) headers.set("Content-Range", contentRange);
			return fail(416);
		}
		if (![200, 206].includes(response.status)) {
			await response.body?.cancel();
			return fail(502);
		}
		headers.set("Content-Type", row.asset.mime);
		headers.set("Content-Disposition", "inline");
		for (const name of ["Content-Length", "Content-Range", "Accept-Ranges"]) if (response.headers.has(name)) headers.set(name, response.headers.get(name)!);
		return new Response(response.body, { status: response.status, headers });
	} catch {
		return fail(502);
	}
}
