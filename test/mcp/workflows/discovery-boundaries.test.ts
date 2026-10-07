/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test.each(["provider_rate_limit", "provider_malformed", "provider_foreign", "provider_repeated_cursor"])("discovery %s fails without exposing provider payloads or writing", (variant) => {
	const row = flowProbe(`catalogue:workflow:search_clips:${variant}`);
	expect(row.result?.structuredContent.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(row.writes).toBe(0);
	expect(row.safe).toBe(true);
});
test("bounded incomplete discovery cannot create an import token", () => {
	const row = flowProbe("catalogue:workflow:preview_playlist_import:provider_partial");
	expect(row.result?.structuredContent).toMatchObject({ complete: false, canCommit: false, previewToken: null, requiresConfirmation: true });
	expect(row.result?.structuredContent.proposed).toHaveLength(5);
	expect(row.playlistItemCount).toBe(0);
});
test.each(["free_filtered", "downgrade_filtered"])("filtered import rechecks plan at %s", (variant) => {
	const tool = variant === "free_filtered" ? "preview_playlist_import" : "commit_playlist_import";
	const row = flowProbe(`catalogue:workflow:${tool}:${variant}`);
	expect(row.result?.structuredContent.error.code).toBe("FEATURE_RESTRICTED");
	expect(row.playlistItemCount).toBe(0);
	expect(row.writes).toBe(0);
});
test("full Free quota produces no commit token", () => {
	const row = flowProbe("catalogue:workflow:preview_playlist_import:quota_full");
	expect(row.result?.structuredContent).toMatchObject({ canCommit: false, remainingQuota: 0, previewToken: null });
	expect(row.playlistItemCount).toBe(50);
	expect(row.playlistRevision).toBe(1);
	expect(row.writes).toBe(1); // Successful preview records read activity, without changing playlist state.
});
test("duplicate selection commits no new clip or revision", () => {
	const row = flowProbe("catalogue:workflow:commit_playlist_import:duplicate_selection");
	expect(row.result?.structuredContent).toMatchObject({ addedCount: 0, addedClipIds: [], configurationRevision: 1 });
	expect(row.playlistItemCount).toBe(1);
});
