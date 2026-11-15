import "server-only";
import { sql } from "drizzle-orm";
import type { QueryClient } from "@/db/client";
import type { CommunityCreatorStats } from "@lib/community-types";

/** Only the public, available clips on a currently discoverable Creator Page. */
export async function readCommunityCreatorStats(db: QueryClient, creatorId: string, now = new Date()): Promise<CommunityCreatorStats> {
	if (typeof creatorId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(creatorId)) return { status: "unavailable" };
	const prefix = `clip:${creatorId}:`.replace(/[\\%_]/g, "\\$&") + "%";
	try {
		const result = await db.execute(sql`
			SELECT (
				SELECT count(*)::int FROM "twitchCache" c
				WHERE c.type = 'clip' AND c.key LIKE ${prefix} ESCAPE '\\'
				AND (c.expires_at IS NULL OR c.expires_at > ${now})
				AND coalesce((c.value::jsonb ->> 'unavailable')::boolean, false) = false
				AND coalesce(c.value::jsonb -> 'clip', c.value::jsonb) ->> 'id' IS NOT NULL
				AND nullif(coalesce(c.value::jsonb -> 'clip', c.value::jsonb) ->> 'created_at', '') IS NOT NULL
			) AS clip_count
			FROM users u INNER JOIN "userSettings" s ON s.id = u.id
			WHERE u.id = ${creatorId} AND u.disabled = false AND s.creator_page_enabled = true
			AND (s.creator_page_visibility = 'discoverable' OR (s.creator_page_visibility IS NULL AND s.show_in_community = true))
		`);
		return result.rows.length ? { status: "ready", clipCount: Number(result.rows[0].clip_count) } : { status: "unavailable" };
	} catch {
		return { status: "unavailable" };
	}
}
