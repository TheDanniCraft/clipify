import { existsSync } from "node:fs";
import type { createMcpPostgresFixture } from "./postgres";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { Entitlement, EntitlementGrantSource } from "@types";
export async function runCreateFixture(fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>, principal: TrustedCreatorPrincipal, mode: string) {
	const playlist = mode.startsWith("creation:playlist-");
	const variant = mode.replace("creation:playlist-", "creation:");
	const service = existsSync("src/server/resources/overlays.ts") ? await import("@/server/resources/overlays") : null;
	const playlists = playlist ? await import("@/server/resources/playlists") : null;
	const create = playlist ? playlists?.createPlaylistForPrincipal : service?.createOverlayForPrincipal;
	if (!create) return { serviceAvailable: false };
	if (variant === "creation:pro") await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	if (variant === "creation:grant") await fixture.pool.query("INSERT INTO entitlement_grants (user_id,entitlement,source,reason,starts_at,ends_at) VALUES ($1,$2,$3,'fixture-grant',now(),now()+interval '1 day')", ["fixture-creator", Entitlement.ProAccess, EntitlementGrantSource.Partner]);
	if (variant === "creation:denied") await fixture.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org'");
	const session: TrustedCreatorPrincipal = { kind: "session", authUserId: principal.authUserId, authenticatedAt: principal.authenticatedAt };
	const outcomes = await Promise.all(
		Array.from({ length: 20 }, async (_, index) => {
			try {
				const result = await create(index % 2 ? session : principal, { creatorId: "fixture-creator", retryKey: `independent-${index}`, name: playlist ? "New Playlist" : "New Overlay" }, fixture.db);
				return { success: true, id: result.id };
			} catch (error) {
				return { success: false, code: error instanceof Error ? error.message : "failure" };
			}
		}),
	);
	const count = await fixture.pool.query(playlist ? "SELECT count(*) FROM playlists" : "SELECT count(*) FROM overlays");
	return { serviceAvailable: true, successes: outcomes.filter((value) => value.success).length, denials: outcomes.filter((value) => !value.success).map((value) => value.code), resources: Number(count.rows[0].count) };
}
