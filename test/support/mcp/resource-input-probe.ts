import { createMcpPostgresFixture } from "./postgres";

async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	try {
		const overlays = await import("@/server/resources/overlays");
		const playlists = await import("@/server/resources/playlists");
		const { savePlaylistItemSelection } = await import("@/server/resources/playlist-items");
		const principal = { kind: "oauth" as const, authUserId: "actor", authenticatedAt: new Date() };
		const results: Record<string, string> = {};
		for (const [name, call] of Object.entries({
			listOverlays: () => overlays.listOverlays(principal, null, fixture.db),
			getOverlay: () => overlays.getOverlay(principal, null, fixture.db),
			createOverlay: () => overlays.createOverlayForPrincipal(principal, null, fixture.db),
			updateOverlay: () => overlays.updateOverlay(principal, null, fixture.db),
			deleteOverlay: () => overlays.deleteOverlay(principal, null, fixture.db),
			listPlaylists: () => playlists.listPlaylists(principal, null, fixture.db),
			getPlaylist: () => playlists.getPlaylist(principal, null, fixture.db),
			createPlaylist: () => playlists.createPlaylistForPrincipal(principal, null, fixture.db),
			updatePlaylist: () => playlists.updatePlaylist(principal, null, fixture.db),
			deletePlaylist: () => playlists.deletePlaylist(principal, null, fixture.db),
			addItems: () => playlists.addPlaylistItems(principal, null, fixture.db),
			removeItems: () => playlists.removePlaylistItems(principal, null, fixture.db),
			reorderItems: () => playlists.reorderPlaylistItems(principal, null, fixture.db),
			saveItems: () => savePlaylistItemSelection(principal, null, fixture.db),
			ownerVolumeWithOAuth: () => overlays.updateOwnerOverlayVolume(principal, "creator", 50, fixture.db),
			invalidChatActor: () => overlays.updateTrustedChatOverlayVolume("creator", 50, "", fixture.db),
		})) {
			try {
				await call();
				results[name] = "unexpected_success";
			} catch (error) {
				results[name] = error instanceof Error ? error.message : "unexpected_error";
			}
		}
		const { rows } = await fixture.pool.query("SELECT (SELECT count(*) FROM overlays)+(SELECT count(*) FROM playlists)+(SELECT count(*) FROM audit_events) AS writes");
		console.log(JSON.stringify({ results, writes: Number(rows[0].writes) }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
