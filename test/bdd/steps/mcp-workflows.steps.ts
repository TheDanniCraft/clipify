import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("a workflow tool {string} under case {string}", async ({ mcpWorld }, tool: string, variant: string) => {
	mcpWorld.input = { tool, variant };
});
When("the approved client executes the workflow through MCP", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:${mcpWorld.input?.tool}:${mcpWorld.input?.variant}`) };
});
Then("the workflow result is {string} and has a safe projection", async ({ mcpWorld }, expected: string) => {
	const row = mcpWorld.result?.body;
	expect(row.safe).toBe(true);
	if (expected === "success") {
		expect(row.status).toBe(200);
		expect(row.error).toBeUndefined();
		expect(row.result?.isError).not.toBe(true);
		expect(row.result?.structuredContent).toBeDefined();
		const value = row.result.structuredContent;
		const tool = typeof mcpWorld.input?.tool === "string" ? mcpWorld.input.tool : undefined;
		const variant = typeof mcpWorld.input?.variant === "string" ? mcpWorld.input.variant : undefined;
		const expectedShapes: Record<string, any> = {
			get_overlay_runtime: { overlayId: row.ids.overlayId, status: "connected", nowPlaying: { clipId: "MinecraftClip" } },
			get_overlay_queues: { overlayId: row.ids.overlayId, targets: { viewer: "overlay", moderator: "creator" } },
			control_overlay: { overlayId: row.ids.overlayId, status: variant === "offline" ? "player_unavailable" : "sent", applied: false, target: "overlay" },
			enqueue_overlay_clip: { creatorId: "fixture-creator", clipId: "MinecraftClip", target: "creator", queue: "moderator" },
			clear_overlay_queue: { overlayId: row.ids.overlayId, removed: { viewer: variant === "queue_moderator" ? 0 : 1, moderator: variant === "queue_viewer" ? 0 : 1 } },
			search_clips: { creatorId: "fixture-creator", complete: true },
			resolve_clip: { clip: { id: "MinecraftClip" } },
			preview_playlist_import: { playlistId: row.ids.playlistId, canCommit: true, requiresConfirmation: true, proposed: [{ id: "MinecraftClip" }] },
			commit_playlist_import: { id: row.ids.playlistId, addedCount: 1, addedClipIds: ["MinecraftClip"], configurationRevision: 2 },
			list_galleries: { items: [{ id: row.ids.galleryId }] },
			get_gallery: { gallery: { id: row.ids.galleryId, configurationRevision: 1 } },
			create_gallery: { name: "New gallery", configurationRevision: 1, published: false },
			update_gallery: { id: row.ids.galleryId, name: "Edited gallery", configurationRevision: 2 },
			delete_gallery: { galleryId: row.ids.galleryId, deleted: true },
			publish_gallery: { id: row.ids.galleryId, published: false, configurationRevision: 2 },
			get_gallery_embed: { galleryId: row.ids.galleryId, published: true, previewRequiresBrowserSignIn: true },
			get_gallery_preview: { galleryId: row.ids.galleryId, runtimeAllowed: true },
			get_overlay_embed: { overlayId: row.ids.overlayId, public: false, containsCredential: true, purpose: "obs_browser_source" },
			get_player_embed: { overlayId: row.ids.overlayId, public: true, format: variant === "iframe" ? "iframe" : "elements" },
			get_creator_page: { creatorId: "fixture-creator", configurationRevision: 1, published: true },
			update_creator_page: { configurationRevision: 2, settings: { creatorPageVisibility: "unlisted" } },
			publish_creator_page: { configurationRevision: 2, published: false },
			get_runner_setup: { platform: variant?.startsWith("platform_") ? variant.slice(9) : "linux", installationRequired: true, enrollmentRequired: true },
			list_runners: { items: [{ id: row.ids.runnerId }] },
			get_runner: { id: row.ids.runnerId, configurationRevision: 1 },
			create_runner: { name: "New runner", configurationRevision: 1, enrollmentRequired: true },
			update_runner: { id: row.ids.runnerId, name: "Edited runner", configurationRevision: 2 },
			delete_runner: { runnerId: row.ids.runnerId, deleted: true, deviceShutdownConfirmed: false },
			unlink_runner: { id: row.ids.runnerId, credentialRevoked: true, enrollmentRequired: true, configurationRevision: 2 },
			list_stream_sessions: { items: [{ id: row.ids.sessionId }] },
			get_stream_session: { id: row.ids.sessionId, configurationRevision: 1 },
			configure_stream_session: { id: row.ids.sessionId, runnerId: row.ids.runnerId, overlayId: row.ids.overlayId, configurationRevision: 2, resolution: "720p", fps: 30 },
			control_stream_session: { id: row.ids.sessionId, desiredState: "running", actualState: "stopped", applied: false, configurationRevision: 2 },
			get_runner_snapshot: { runnerId: row.ids.runnerId, status: variant === "runner_offline" ? "runner_offline" : ["no_snapshot", "foreign_assignment"].includes(variant ?? "") ? "unavailable" : "available" },
		};
		if (tool === "preview_playlist_import" && ["provider_partial", "quota_full"].includes(variant ?? "")) {
			expectedShapes.preview_playlist_import = { playlistId: row.ids.playlistId, canCommit: false, previewToken: null, requiresConfirmation: true };
			if (variant === "provider_partial") {
				expect(value.complete).toBe(false);
				expect(value.proposed).toHaveLength(5);
			} else {
				expect(value.remainingQuota).toBe(0);
				expect(row.playlistItemCount).toBe(50);
			}
		}
		if (tool === "commit_playlist_import" && variant === "duplicate_selection") expectedShapes.commit_playlist_import = { id: row.ids.playlistId, addedCount: 0, addedClipIds: [], configurationRevision: 1 };
		if (tool === "get_runner_snapshot" && ["snapshot_stale_revision", "snapshot_expired"].includes(variant ?? "")) expectedShapes.get_runner_snapshot.status = "unavailable";
		if (tool === "control_stream_session" && variant === "stop") expectedShapes.control_stream_session = { id: row.ids.sessionId, desiredState: "stopped", actualState: "stopped", applied: true, configurationRevision: 2 };
		if (tool === "get_overlay_queues" && variant === "fifo") {
			expect(value.items).toMatchObject([{ clipId: "FirstClip", queue: "viewer" }]);
			expect(row.nextPage?.structuredContent.items).toMatchObject([{ clipId: "SecondClip", queue: "moderator" }]);
		}
		if (tool === "get_creator_page" && ["existing_page", "free_existing_page"].includes(variant ?? "")) {
			expectedShapes.get_creator_page.published = false;
			expect(value.settings).toMatchObject({ creatorPageEnabled: false, creatorPageVisibility: "discoverable", creatorPageShowBio: false, creatorPageSocialTitle: "Saved title", creatorPageSocialDescription: "Saved description" });
			expect(value.effectiveSocialPreview).toEqual(variant === "free_existing_page" ? { title: null, description: null } : { title: "Saved title", description: "Saved description" });
		}
		if (tool === "update_creator_page" && ["social_edit", "free_unchanged_social", "clear_social"].includes(variant ?? "")) {
			expectedShapes.update_creator_page.settings = { creatorPageVisibility: "discoverable" };
			expect(value.settings).toMatchObject({ creatorPageSocialTitle: variant === "social_edit" ? "Agent title" : variant === "clear_social" ? null : "Saved title", creatorPageSocialDescription: variant === "social_edit" ? "Agent description" : variant === "clear_social" ? null : "Saved description" });
		}
		if (variant === "free_clear_absent") expect(value.settings).toMatchObject({ creatorPageSocialTitle: null, creatorPageSocialDescription: null });
		if (variant === "page_bio") expect(value.settings.creatorPageShowBio).toBe(false);
		if (variant === "publish_on") expectedShapes.publish_creator_page.published = true;
		if (variant?.startsWith("layout_")) expect(value.layout).toBe(variant.slice(7));
		if (variant === "live_source") expect(value).toMatchObject({ source: "live", playlistId: null });
		if (variant === "custom_dates") expect(value).toMatchObject({ source: "live", liveTimeWindow: "custom", liveCustomStart: "2026-10-01T00:00:00.000Z", liveCustomEnd: "2026-10-06T00:00:00.000Z" });
		if (variant === "clear_custom_dates") expect(value).toMatchObject({ liveCustomStart: null, liveCustomEnd: null });
		if (variant === "preview_live") expect(value.items.map((clip: any) => clip.id)).toEqual(["MinecraftClip", "OtherClip"]);
		if (variant === "preview_free") expect(value.showAttribution).toBe(true);
		if (tool === "configure_stream_session" && variant === "new_session") expectedShapes.configure_stream_session = { id: expect.any(String), configurationRevision: 1, credentialsRequired: true, runnerId: row.ids.runnerId, overlayId: row.ids.overlayId };
		if (tool === "configure_stream_session") expect(row.activity).toEqual({ target_type: "stream_session", target_id: value.id });
		if (variant === "destination_youtube") expect(value).toMatchObject({ destination: "youtube", credentialsConfigured: false, credentialsRequired: true, desiredState: "stopped" });
		if (variant === "destination_twitch") expect(value).toMatchObject({ destination: "twitch", credentialsConfigured: true, credentialsRequired: false });
		if (variant === "unassigned") expect(value.runner).toBeNull();
		if (variant === "custom_destination") expect(value).toMatchObject({ destination: "custom", credentialsConfigured: false });
		if (variant === "session_error") expect(value).toMatchObject({ hasError: true, error: "The runner reported a stream error. Open the dashboard for details." });
		if (variant === "runner_metadata") {
			expectedShapes.get_runner.status = "offline";
			expect(value.osInfo).toHaveLength(256);
			expect(value.version).toHaveLength(128);
		}
		if (variant === "paid_fields_pro") {
			expect(row.series).toHaveLength(19);
			for (const [index, item] of row.series.entries()) {
				expect(item.result.isError).not.toBe(true);
				// Matching foreground and card colours are normalized for legibility by the shared gallery policy.
				const expectedValue = item.field === "textColor" ? "#FFFFFF" : item.value;
				expect(item.result.structuredContent).toMatchObject({ [item.field]: expectedValue, configurationRevision: index + 2 });
			}
			expect(row.writes).toBe(19);
		}
		if (variant === "pagination") {
			if (tool?.startsWith("list_")) expectedShapes[tool] = { items: expect.any(Array) };
			expect(value.items).toHaveLength(1);
			expect(value.nextCursor).toEqual(expect.any(String));
			expect(row.nextPage?.isError).not.toBe(true);
			expect(row.nextPage?.structuredContent.items).toHaveLength(1);
			expect(row.nextPage?.structuredContent.items[0].id).not.toBe(value.items[0].id);
			expect(row.nextPage?.structuredContent.nextCursor).toBeNull();
		}
		expect(expectedShapes[tool ?? ""]).toBeDefined();
		expect(value).toMatchObject(expectedShapes[tool ?? ""] as Record<string, unknown>);
		if (tool === "control_overlay") expect(row.commands.filter((item: any) => item.type === "command")).toHaveLength(variant === "offline" ? 0 : 1);
		if (tool === "commit_playlist_import") expect(row.playlistItemCount).toBe(1);
		if (tool === "get_player_embed") expect(value.html).toContain(variant === "iframe" ? "<iframe" : "<clipify-player");
		if (tool === "get_gallery_embed") expect(value.html).toContain("<clipify-gallery");
		if (tool === "get_runner_snapshot") expect(row.result.content.some((item: any) => item.type === "image")).toBe(value.status === "available");
	} else {
		if (mcpWorld.input?.variant === "paid_fields_free") {
			expect(row.series).toHaveLength(19);
			for (const item of row.series) expect(item.result.structuredContent.error.code).toBe("FEATURE_RESTRICTED");
		}
		expect(row.status >= 400 || row.result?.isError || row.error).toBeTruthy();
		expect(row.writes).toBe(0);
	}
});
