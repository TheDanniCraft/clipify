import { randomUUID } from "node:crypto";
import { symmetricEncrypt } from "better-auth/crypto";
import type { createMcpPostgresFixture } from "./postgres";
import { toolInputSchemas } from "@/server/mcp/schemas";
export async function runWorkflowCatalogue(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string; mode: string }) {
	const { fixture, auth, origin, token, actorId, mode } = input;
	const [, , name, variant = "success"] = mode.split(":");
	const overlayId = randomUUID(),
		playlistId = randomUUID(),
		galleryId = randomUUID(),
		runnerId = randomUUID(),
		sessionId = randomUUID();
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-workflow-overlay','Workflow overlay','active','Featured')", [overlayId]);
	await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Workflow playlist')", [playlistId]);
	await fixture.pool.query("INSERT INTO galleries(id,owner_id,name,playlist_id,published) VALUES($1,'fixture-creator','Workflow gallery',$2,true)", [galleryId, playlistId]);
	await fixture.pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at) VALUES($1,'fixture-creator','Workflow runner','private-workflow-runner','online',now())", [runnerId]);
	await fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,encrypted_stream_key) VALUES($1,'fixture-creator',$2,$3,'24/7','private-workflow-key')", [sessionId, runnerId, overlayId]);
	await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at) VALUES('fixture-creator','runner_access','partner',now()-interval '1 hour')");
	process.env.TWITCH_CLIENT_ID = "workflow-client";
	const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET!, data: "private-workflow-provider" });
	await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('fixture-creator',$1,'twitch_onboarding')", [actorId]);
	await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,'workflow-twitch','twitch',$2,$3,now()+interval '1 hour','user:read:email',now(),now())", [randomUUID(), actorId, encrypted]);
	const commands: any[] = [];
	const feedbackEvents: any[] = [];
	let feedbackSdk: typeof import("@sentry/nextjs") | undefined;
	if (name === "submit_feedback" && variant !== "sentry_unavailable") {
		feedbackSdk = await import("@sentry/nextjs");
		feedbackSdk.init({
			dsn: "https://0123456789abcdef0123456789abcdef@sentry.example.invalid/1",
			enabled: variant !== "sentry_disabled",
			defaultIntegrations: false,
			transport: () => ({
				send: async (envelope: any) => {
					for (const [header, payload] of envelope[1]) if (header.type === "feedback") feedbackEvents.push(payload);
					return { statusCode: 200 };
				},
				flush: async () => true,
			}),
		});
	}
	const source = { role: "overlay", ownerId: "fixture-creator", overlayId, sourceSecret: "private-workflow-overlay", sourceActive: true, readyState: 1, send: (v: string) => commands.push(JSON.parse(v)), close: () => {} };
	const { addSubscriber, removeSubscriber } = await import("@/app/store/overlaySubscribers");
	addSubscriber("fixture-creator", overlayId, source as any);
	const originalFetch = globalThis.fetch;
	let providerCalls = 0;
	const clips = [
		{ id: "MinecraftClip", title: "Minecraft adventure", duration: 12, broadcaster_id: "fixture-creator", created_at: "2026-10-06T12:00:00Z", game_id: "27471", view_count: 100, url: "https://clips.twitch.tv/MinecraftClip", thumbnail_url: "https://static-cdn.jtvnw.net/test.jpg", secret: "private-provider-payload" },
		{ id: "OtherClip", title: "Other game", duration: 10, broadcaster_id: "fixture-creator", created_at: "2026-10-06T10:00:00Z", game_id: "123", view_count: 20, url: "https://clips.twitch.tv/OtherClip" },
	];
	globalThis.fetch = ((v: RequestInfo | URL, init?: RequestInit) => {
		const req = v instanceof Request ? v : new Request(v, init);
		const url = new URL(req.url);
		if (url.origin === origin) return auth.handler(req);
		if (url.origin !== "https://api.twitch.tv") throw new Error("WORKFLOW_EXTERNAL_IO_FORBIDDEN");
		providerCalls++;
		if (variant === "provider_failure") return Promise.resolve(new Response(null, { status: 503 }));
		if (variant === "provider_rate_limit") return Promise.resolve(new Response(null, { status: 429 }));
		if (variant === "provider_malformed") return Promise.resolve(Response.json({ data: [{ id: "Broken" }] }));
		if (url.pathname === "/helix/games") return Promise.resolve(Response.json({ data: [{ id: "27471", name: "Minecraft" }] }));
		if (url.pathname !== "/helix/clips") throw new Error("UNEXPECTED_PROVIDER_PATH");
		if (variant === "provider_partial") return Promise.resolve(Response.json({ data: [{ ...clips[0], id: `PageClip${providerCalls}` }], pagination: { cursor: `page-${providerCalls}` } }));
		if (variant === "provider_duplicate" && url.pathname === "/helix/clips") return Promise.resolve(Response.json({ data: [clips[0], clips[0]], pagination: {} }));
		if (variant === "provider_foreign") return Promise.resolve(Response.json({ data: [{ ...clips[0], broadcaster_id: "foreign-creator" }], pagination: {} }));
		if (variant === "provider_repeated_cursor") return Promise.resolve(Response.json({ data: [{ ...clips[0], id: `PageClip${providerCalls}` }], pagination: { cursor: "repeated" } }));
		const ids = url.searchParams.getAll("id");
		return Promise.resolve(Response.json({ data: ids.length ? clips.filter((c) => ids.includes(c.id)) : clips, pagination: {} }));
	}) as typeof fetch;
	const route = await import("@/app/mcp/route");
	let seq = 0;
	const responseTexts: string[] = [];
	const call = async (tool: string, args: Record<string, unknown>) => {
		const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method: "tools/call", params: { name: tool, arguments: args } }) }));
		const text = await response.text();
		responseTexts.push(text);
		const raw =
			text.startsWith("event:") || text.startsWith("data:")
				? text
						.split("\n")
						.find((l) => l.startsWith("data:"))
						?.slice(5)
						.trim()
				: text;
		return { status: response.status, body: raw ? JSON.parse(raw) : null, text };
	};
	try {
		const { handleMessage } = await import("@/app/actions/websocket");
		for (const report of [
			{ kind: "playback_state", paused: false, showPlayer: true, volume: 35, muted: false },
			{ kind: "now_playing", clipId: "MinecraftClip", title: "Minecraft adventure", creatorName: "Creator", duration: 12, currentTime: 3, thumbnailUrl: null },
			{ kind: "heartbeat", playerAttached: true, paused: false, showPlayer: true, standby: false },
		])
			await handleMessage(Buffer.from(JSON.stringify({ type: "state_update", data: { ...report, token: "private-state-token" } })), source as any);
		const defaults: Record<string, Record<string, unknown>> = {
			get_overlay_theme: { overlayId },
			get_overlay_filters: { overlayId },
			get_overlay_source: { overlayId },
			get_overlay_playback: { overlayId },
			update_overlay_theme: { overlayId, expectedRevision: 1, patch: { themeTextColor: "#abcdef" } },
			update_overlay_settings: { overlayId, expectedRevision: 1, patch: { name: "Edited overlay" } },
			update_overlay_source: { overlayId, expectedRevision: 1, patch: { type: "Playlist", playlistId } },
			update_overlay_filters: { overlayId, expectedRevision: 1, patch: { minClipViews: 100 } },
			update_overlay_playback: { overlayId, expectedRevision: 1, patch: { playerVolume: 70 } },
			get_gallery_theme: { galleryId },
			get_gallery_filters: { galleryId },
			get_gallery_source: { galleryId },
			get_gallery_layout: { galleryId },
			update_gallery_theme: { galleryId, expectedRevision: 1, patch: { accentColor: "#abcdef" } },
			update_gallery_settings: { galleryId, expectedRevision: 1, patch: { name: "Edited gallery" } },
			update_gallery_source: { galleryId, expectedRevision: 1, patch: { source: "live" } },
			update_gallery_filters: { galleryId, expectedRevision: 1, patch: { minimumViews: 100 } },
			update_gallery_layout: { galleryId, expectedRevision: 1, patch: { layout: "list" } },
			get_overlay_link: { overlayId },
			submit_feedback: { kind: "bug", message: "The queue did not advance.", confirmed: true, retryKey: "feedback-one" },
			get_capabilities: {},
			get_overlay_runtime: { overlayId },
			get_overlay_queues: { overlayId },
			control_overlay: { overlayId, command: "pause" },
			enqueue_overlay_clip: { overlayId, clip: "https://clips.twitch.tv/MinecraftClip", retryKey: "enqueue-one" },
			clear_overlay_queue: { overlayId, queue: "all" },
			search_clips: { filters: { category: "Minecraft", startedAt: "2026-10-06T00:00:00Z", endedAt: "2026-10-07T00:00:00Z", timezone: "UTC" } },
			resolve_clip: { reference: "https://clips.twitch.tv/MinecraftClip" },
			preview_playlist_import: { playlistId, expectedRevision: 1, clips: ["https://clips.twitch.tv/MinecraftClip"] },
			commit_playlist_import: { playlistId, confirmed: true, retryKey: "import-one", previewToken: "pending" },
			list_galleries: {},
			get_gallery: { galleryId },
			create_gallery: { name: "New gallery", retryKey: "gallery-one" },
			delete_gallery: { galleryId, expectedRevision: 1 },
			publish_gallery: { galleryId, expectedRevision: 1, published: false },
			get_gallery_embed: { galleryId },
			get_gallery_preview: { galleryId },
			get_player_embed: { overlayId, muted: true, autoplay: true },
			get_creator_page: {},
			update_creator_page: { expectedRevision: 1, patch: { creatorPageVisibility: "unlisted" } },
			publish_creator_page: { expectedRevision: 1, enabled: false },
			get_runner_setup: { platform: "linux" },
			list_runners: {},
			get_runner: { runnerId },
			create_runner: { name: "New runner", retryKey: "runner-one" },
			update_runner: { runnerId, expectedRevision: 1, name: "Edited runner" },
			delete_runner: { runnerId, expectedRevision: 1 },
			unlink_runner: { runnerId, expectedRevision: 1 },
			list_stream_sessions: {},
			get_stream_session: { sessionId },
			configure_stream_session: { sessionId, expectedRevision: 1, runnerId, overlayId, mode: "24/7", resolution: "720p", fps: 30 },
			control_stream_session: { sessionId, expectedRevision: 1, state: "running" },
			get_runner_snapshot: { runnerId },
		};
		let args: Record<string, unknown> = { creatorId: "fixture-creator", ...defaults[name] };
		async function prepareFeedbackQueueAndEmbedCases() {
			if (name === "submit_feedback" && variant === "shared_limit") {
				const { consumeAppRateLimit } = await import("@/server/rate-limit");
				for (let index = 0; index < 5; index++) await consumeAppRateLimit({ key: "mcp-feedback", points: 5, duration: 86400, identifier: actorId });
			}
			if (name === "submit_feedback" && variant === "suggestion") args.kind = "suggestion";
			if (name === "submit_feedback" && variant === "unconfirmed") args.confirmed = false;
			if (name === "submit_feedback" && variant === "empty_message") args.message = " ";
			if (name === "submit_feedback" && variant === "long_message") args.message = "x".repeat(2001);
			if (name === "submit_feedback" && variant === "unexpected_transcript") args.transcript = "private chat";
			async function prepareQueueAndEmbedCases() {
				if (name === "clear_overlay_queue") {
					await fixture.pool.query('INSERT INTO "clipQueue"(overlay_id,clip_id) VALUES($1,$2)', [overlayId, "MinecraftClip"]);
					await fixture.pool.query('INSERT INTO "modQueue"(broadcaster_id,clip_id) VALUES($1,$2)', ["fixture-creator", "OtherClip"]);
					if (variant.startsWith("queue_")) args.queue = variant.slice(6);
				}
				if (name === "get_overlay_queues" && variant === "fifo") {
					args.limit = 1;
					await fixture.pool.query('INSERT INTO "clipQueue"(id,overlay_id,clip_id,queued_at) VALUES($1,$2,$3,$4)', ["ffffffff-ffff-4fff-8fff-ffffffffffff", overlayId, "FirstClip", "2026-10-06T12:00:00.000001Z"]);
					await fixture.pool.query('INSERT INTO "modQueue"(id,broadcaster_id,clip_id,queued_at) VALUES($1,$2,$3,$4)', ["00000000-0000-4000-8000-000000000001", "fixture-creator", "SecondClip", "2026-10-06T12:00:00.000002Z"]);
				}
				if (name === "get_overlay_queues" && variant === "fifo_ties") {
					args.limit = 1;
					const tiedId = "00000000-0000-4000-8000-000000000001";
					await fixture.pool.query('INSERT INTO "clipQueue"(id,overlay_id,clip_id,queued_at) VALUES($1,$2,$3,$4)', [tiedId, overlayId, "ViewerClip", "2026-10-06T12:00:00.000001Z"]);
					await fixture.pool.query('INSERT INTO "modQueue"(id,broadcaster_id,clip_id,queued_at) VALUES($1,$2,$3,$4)', [tiedId, "fixture-creator", "ModeratorClip", "2026-10-06T12:00:00.000001Z"]);
				}
				if (name === "get_player_embed" && ["iframe", "elements_options"].includes(variant)) {
					args.format = variant === "iframe" ? "iframe" : "elements";
					args.showBanner = true;
					args.showOverlay = true;
				}
			}
			await prepareQueueAndEmbedCases();
			if (name === "get_runner_snapshot" && variant !== "no_snapshot") {
				const preview = await import("@/app/api/runner/preview/route");
				const upload = await preview.POST(new Request(origin + "/api/runner/preview", { method: "POST", headers: { Authorization: "Bearer private-workflow-runner", "Content-Type": "application/json" }, body: JSON.stringify({ overlayId, image: "data:image/jpeg;base64,/9j/2Q==" }) }));
				if (!upload.ok) throw new Error("WORKFLOW_PREVIEW_FIXTURE_UPLOAD_FAILED");
			}
		}
		await prepareFeedbackQueueAndEmbedCases();

		async function prepareImportAndPaginationCases() {
			if (name === "preview_playlist_import" && ["filtered", "free_filtered", "provider_partial"].includes(variant)) {
				delete args.clips;
				args.filters = { category: "Minecraft" };
			}
			if (["duplicate_selection", "quota_full"].includes(variant)) {
				if (variant === "quota_full") {
					await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
					await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) SELECT $1,'QuotaClip' || n,n,'{}' FROM generate_series(1,50) AS n", [playlistId]);
				} else await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'MinecraftClip',0,'{}')", [playlistId]);
			}
			async function seedWorkflowPagination() {
				if (variant === "pagination") {
					args.limit = 1;
					if (name === "list_galleries") await fixture.pool.query("INSERT INTO galleries(owner_id,name) VALUES('fixture-creator','Second gallery')");
					if (name === "list_runners") await fixture.pool.query("INSERT INTO runners(owner_id,name,token) VALUES('fixture-creator','Second runner','private-second-runner')");
					if (name === "list_stream_sessions") await fixture.pool.query("INSERT INTO stream_sessions(owner_id,runner_id,overlay_id,mode) VALUES('fixture-creator',$1,$2,'failsafe')", [runnerId, overlayId]);
					if (name === "get_gallery_preview") for (const [position, clip] of clips.entries()) await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,$2,$3,$4)", [playlistId, clip.id, position, JSON.stringify(clip)]);
					if (name === "search_clips") args.filters = {};
				}
			}
			await seedWorkflowPagination();
			if (variant === "malformed_cursor") args.cursor = "malformed";
			if (variant === "cursor_context_change") {
				args.limit = 1;
				args.filters = {};
			}
			if (name === "commit_playlist_import") {
				const preview = await call("preview_playlist_import", { creatorId: "fixture-creator", playlistId, expectedRevision: 1, ...(variant === "downgrade_filtered" ? { filters: { category: "Minecraft" } } : { clips: ["MinecraftClip"] }) });
				args.previewToken = preview.body?.result?.structuredContent?.previewToken ?? "missing-preview";
			}
			if (variant === "missing_secondary_scope") {
				if (name === "preview_playlist_import") {
					delete args.clips;
					args.filters = { category: "Minecraft" };
				}
				if (name === "configure_stream_session") {
					delete args.sessionId;
					delete args.expectedRevision;
					args.retryKey = "new-session-secondary";
				}
			}
		}
		await prepareImportAndPaginationCases();
		async function prepareOwnershipAndSnapshotCases() {
			if (["free_filtered", "downgrade_filtered"].includes(variant)) await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
			if (variant === "unconfirmed") args.confirmed = false;
			if (variant === "foreign_resource") {
				for (const field of ["overlayId", "playlistId", "galleryId", "runnerId", "sessionId"]) if (args[field]) args[field] = randomUUID();
			}
			if (variant.startsWith("volume_")) {
				args.command = "volume";
				args.volume = Number(variant.slice(7));
			}
			if (variant.startsWith("platform_")) args.platform = variant.slice(9);
			if (variant === "stop") args.state = "stopped";
			if (variant === "missing_stream_key") await fixture.pool.query("UPDATE stream_sessions SET encrypted_stream_key=null WHERE id=$1", [sessionId]);
			if (variant === "snapshot_stale_revision") await fixture.pool.query("UPDATE runners SET configuration_revision=2 WHERE id=$1", [runnerId]);
			if (variant === "snapshot_expired") await new Promise((resolve) => setTimeout(resolve, 16010));
			if (["foreign_owned", "foreign_runner_assignment", "foreign_overlay_assignment"].includes(variant)) {
				await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) SELECT 'foreign-workflow-creator','foreign@example.invalid','foreign-workflow','',role,plan FROM users WHERE id='fixture-creator'");
				if (variant === "foreign_runner_assignment") await fixture.pool.query("UPDATE runners SET owner_id='foreign-workflow-creator' WHERE id=$1", [runnerId]);
				else if (variant === "foreign_overlay_assignment") await fixture.pool.query("UPDATE overlays SET owner_id='foreign-workflow-creator' WHERE id=$1", [overlayId]);
				else if (args.galleryId) await fixture.pool.query("UPDATE galleries SET owner_id='foreign-workflow-creator' WHERE id=$1", [galleryId]);
				else if (name.includes("stream_session")) await fixture.pool.query("UPDATE stream_sessions SET owner_id='foreign-workflow-creator' WHERE id=$1", [sessionId]);
				else if (args.runnerId) await fixture.pool.query("UPDATE runners SET owner_id='foreign-workflow-creator' WHERE id=$1", [runnerId]);
				else if (args.playlistId) await fixture.pool.query("UPDATE playlists SET owner_id='foreign-workflow-creator' WHERE id=$1", [playlistId]);
				else await fixture.pool.query("UPDATE overlays SET owner_id='foreign-workflow-creator' WHERE id=$1", [overlayId]);
			}
		}
		await prepareOwnershipAndSnapshotCases();
		async function prepareCreatorAccessCases() {
			if (variant === "wrong_creator") args.creatorId = "unapproved-creator";
			if (variant === "invalid_input") args = { ...args, unexpected: "private-bad-input" };
			if (variant === "free") await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
			if (variant === "free_preserve") {
				await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
				await fixture.pool.query("UPDATE galleries SET source='live',live_time_window='custom',live_custom_start='2026-10-01T00:00:00Z',live_custom_end='2026-10-06T00:00:00Z' WHERE id=$1", [galleryId]);
			}
			if (variant === "paid_theme") {
				await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
				args.patch = { theme: "dark" };
			}
			if (variant === "no_runner_access") await fixture.pool.query("DELETE FROM entitlement_grants WHERE entitlement='runner_access'");
			if (variant === "expired_grant") await fixture.pool.query("UPDATE mcp_connection_grants SET expires_at=now()-interval '1 second'");
			if (variant === "suspended_creator") await fixture.pool.query("UPDATE users SET disabled=true WHERE id='fixture-creator'");
			if (variant === "revoked") await fixture.pool.query("UPDATE mcp_connection_grants SET active=false,revoked_at=now()");
		}
		await prepareCreatorAccessCases();

		async function prepareRevisionAndPlaybackCases() {
			if (variant === "stale_revision") {
				if (name === "commit_playlist_import") await fixture.pool.query("UPDATE playlists SET configuration_revision=2 WHERE id=$1", [playlistId]);
				else args.expectedRevision = 99;
			}
			if (variant === "tampered_preview") args.previewToken = String(args.previewToken) + "tampered";
			if (variant === "runner_offline") await fixture.pool.query("UPDATE runners SET status='offline',last_heartbeat_at=null WHERE id=$1", [runnerId]);
			if (variant === "foreign_assignment") await fixture.pool.query("UPDATE stream_sessions SET runner_id=null WHERE id=$1", [sessionId]);
			if (variant === "offline") removeSubscriber("fixture-creator", overlayId, source as any);
			if (variant.startsWith("command_")) {
				args.command = variant.slice(8);
				if (args.command === "volume") args.volume = 70;
			}
			if (variant === "deleted_replay" && name === "configure_stream_session") {
				delete args.sessionId;
				delete args.expectedRevision;
				args.retryKey = "new-session-replay";
			}
			if (variant.startsWith("layout_")) args.patch = { name: "Edited gallery", layout: variant.slice(7) };
			if (variant === "live_source") args.patch = { name: "Edited gallery", source: "live" };
			if (variant === "curated_without_playlist") args.patch = { playlistId: null };
		}
		await prepareRevisionAndPlaybackCases();
		async function prepareGalleryAndCreatorPageCases() {
			const freeOptions: Record<string, unknown> = { free_stable_sort: { liveSort: "stable_random" }, free_custom_window: { liveTimeWindow: "custom" }, free_custom_start: { liveCustomStart: "2026-10-01T00:00:00Z" }, free_custom_end: { liveCustomEnd: "2026-10-06T00:00:00Z" }, free_result_limit: { liveResultLimit: 51 }, free_unchanged_style: { name: "Edited gallery", theme: "system" } };
			if (freeOptions[variant]) {
				await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
				args.patch = freeOptions[variant];
			}
			if (variant === "custom_dates") args.patch = { name: "Edited gallery", source: "live", liveTimeWindow: "custom", liveCustomStart: "2026-10-01T00:00:00Z", liveCustomEnd: "2026-10-06T00:00:00Z" };
			if (variant === "clear_custom_dates") args.patch = { name: "Edited gallery", liveCustomStart: null, liveCustomEnd: null };
			if (variant === "preview_live") {
				await fixture.pool.query("UPDATE galleries SET source='live',playlist_id=null WHERE id=$1", [galleryId]);
				for (const clip of clips) await fixture.pool.query(`INSERT INTO "twitchCache"(type,key,value,expires_at) VALUES('clip',$1,$2,now()+interval '1 hour')`, [`clip:fixture-creator:${clip.id}`, JSON.stringify({ ...clip, creator_name: "Creator" })]);
			}
			if (variant === "preview_free") await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
			if (["existing_page", "free_existing_page", "free_unchanged_social", "clear_social"].includes(variant))
				await fixture.pool.query("INSERT INTO \"userSettings\"(id,creator_page_enabled,creator_page_visibility,creator_page_show_bio,creator_page_social_title,creator_page_social_description) VALUES('fixture-creator',false,'discoverable',false,'Saved title','Saved description') ON CONFLICT(id) DO UPDATE SET creator_page_enabled=false,creator_page_visibility='discoverable',creator_page_show_bio=false,creator_page_social_title='Saved title',creator_page_social_description='Saved description'");
			if (["free_existing_page", "free_social_edit", "free_unchanged_social", "free_clear_absent"].includes(variant)) await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
			if (["social_edit", "free_social_edit"].includes(variant)) args.patch = { creatorPageSocialTitle: "Agent title", creatorPageSocialDescription: "Agent description", creatorPageShowBio: false, creatorPageVisibility: "discoverable" };
			if (variant === "free_unchanged_social") args.patch = { creatorPageSocialTitle: "Saved title", creatorPageSocialDescription: "Saved description" };
			if (["clear_social", "free_clear_absent"].includes(variant)) args.patch = { creatorPageSocialTitle: null, creatorPageSocialDescription: null };
			if (variant === "page_bio") args.patch = { creatorPageShowBio: false };
		}
		await prepareGalleryAndCreatorPageCases();
		async function prepareRunnerSessionCases() {
			if (variant === "publish_on") args.enabled = true;
			if (variant === "unassigned") await fixture.pool.query("UPDATE stream_sessions SET runner_id=null WHERE id=$1", [sessionId]);
			if (variant === "inactive_overlay") await fixture.pool.query("UPDATE overlays SET status='paused' WHERE id=$1", [overlayId]);
			if (variant === "session_error") await fixture.pool.query("UPDATE stream_sessions SET last_error='private-stream-error' WHERE id=$1", [sessionId]);
			if (variant === "custom_destination") await fixture.pool.query("UPDATE stream_sessions SET rtmp_url='rtmp://private-stream-key@hidden.example.invalid/live',encrypted_stream_key=null WHERE id=$1", [sessionId]);
			if (variant === "runner_metadata") await fixture.pool.query("UPDATE runners SET os_info=repeat('system-',70),version=repeat('v1.',70),last_heartbeat_at=now()-interval '40 seconds' WHERE id=$1", [runnerId]);
			if (variant.startsWith("destination_")) args.destination = variant.slice(12);
			if (variant === "new_session") {
				delete args.sessionId;
				delete args.expectedRevision;
				args.retryKey = "new-session-options";
			}
		}
		await prepareRunnerSessionCases();
		async function prepareGalleryFieldCases() {
			const paidOptions: Record<string, unknown> = {
				includeCategories: ["27471"],
				excludeCategories: ["123"],
				minimumViews: 1,
				minimumDuration: 1,
				maximumDuration: 30,
				titleBlacklist: ["blocked"],
				creatorAllowlist: ["creator"],
				creatorBlocklist: ["blocked"],
				theme: "dark",
				accentColor: "#123456",
				backgroundMode: "solid",
				backgroundColor: "#123456",
				cardSurfaceColor: "#123456",
				textColor: "#123456",
				cardRadius: 10,
				gap: 20,
				thumbnailTreatment: "contain",
				modalBackdrop: "#123456",
				desktopModalWidth: 1080,
			};
			if (["paid_fields_free", "paid_fields_pro"].includes(variant)) {
				if (variant === "paid_fields_free") await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
				const [field, value] = Object.entries(paidOptions)[0];
				args.patch = { name: "Edited gallery", [field]: value };
			}
			if (name === "update_gallery_settings" && args.patch && Object.keys(args.patch as object).length > 1) {
				const patch = { ...(args.patch as Record<string, unknown>) };
				delete patch.name;
				args.patch = patch;
			}
			if (name === "update_gallery_source" && variant === "missing_linked_playlist") args.patch = { source: "curated", playlistId: randomUUID() };
			if (variant === "cross_area") args.patch = { ...(args.patch as object), name: "Unwanted overwrite" };
			return { paidOptions };
		}
		const { paidOptions } = await prepareGalleryFieldCases();
		const updateGalleryAreas = async (input: Record<string, unknown>) => {
			const { galleryFieldGroups } = await import("@/server/mcp/focused-fields");
			let expectedRevision = input.expectedRevision;
			let response;
			for (const [group, fields] of Object.entries(galleryFieldGroups)) {
				const patch = Object.fromEntries(Object.entries(input.patch as Record<string, unknown>).filter(([field]) => (fields as readonly string[]).includes(field)));
				if (!Object.keys(patch).length) continue;
				response = await call(`update_gallery_${group}`, { ...input, expectedRevision, patch });
				if (response.body?.result?.isError || response.body?.error) return response;
				expectedRevision = response.body?.result?.structuredContent?.configurationRevision;
			}
			if (!response) throw new Error("EMPTY_GALLERY_FIXTURE_PATCH");
			const full = await call("get_gallery", { creatorId: input.creatorId, galleryId });
			response.body.result.structuredContent = full.body?.result?.structuredContent?.gallery;
			return response;
		};
		async function executeWorkflowAndReplay() {
			async function executeWorkflowSeries() {
				let result = name === "update_gallery_settings" && args.patch ? await updateGalleryAreas(args) : await call(name, args);
				if (name === "submit_feedback" && variant === "limit") for (let index = 1; index <= 5; index++) result = await call(name, { ...args, message: `User report ${index}`, retryKey: `feedback-${index}` });
				const series: { field: string; value: unknown; result: any }[] = [];
				if (["paid_fields_free", "paid_fields_pro"].includes(variant)) {
					const options = Object.entries(paidOptions);
					series.push({ field: options[0][0], value: options[0][1], result: result.body?.result });
					for (const [index, [field, value]] of options.slice(1).entries()) {
						const next = await updateGalleryAreas({ ...args, expectedRevision: variant === "paid_fields_pro" ? index + 2 : 1, patch: { [field]: value } });
						series.push({ field, value, result: next.body?.result });
					}
				}
				if (result.body?.error?.code === -32602) process.stderr.write(`WORKFLOW_TOOL_UNAVAILABLE: ${name}\n`);
				const nextPage = ["fifo", "fifo_ties", "pagination", "cursor_context_change"].includes(variant) ? await call(name, { ...args, ...(variant === "cursor_context_change" ? { filters: { title: "changed" } } : {}), cursor: result.body?.result?.structuredContent?.nextCursor }) : undefined;
				return { result, series, nextPage };
			}
			const { result, series, nextPage } = await executeWorkflowSeries();
			if (variant === "deleted_replay") {
				const createdId = result.body?.result?.structuredContent?.id;
				if (!createdId) throw new Error("WORKFLOW_REPLAY_FIXTURE_CREATE_FAILED");
				if (name === "create_gallery") await fixture.pool.query("DELETE FROM galleries WHERE id=$1", [createdId]);
				else if (name === "create_runner") await fixture.pool.query("DELETE FROM runners WHERE id=$1", [createdId]);
				else if (name === "configure_stream_session") await fixture.pool.query("DELETE FROM stream_sessions WHERE id=$1", [createdId]);
			}
			if (variant === "retry_expired") await fixture.pool.query("UPDATE mcp_mutation_retries SET created_at=now()-interval '25 hours',expires_at=now()-interval '1 second'");
			let replay = ["replay", "deleted_replay", "retry_expired"].includes(variant) ? await call(name, args) : undefined;
			if (name === "submit_feedback" && variant === "alias_conflict") {
				await call(name, { ...args, retryKey: "feedback-alias" });
				replay = await call(name, { ...args, retryKey: "feedback-alias", message: "Changed feedback" });
			}
			return { result, series, nextPage, replay };
		}
		const { result, series, nextPage, replay } = await executeWorkflowAndReplay();
		async function collectWorkflowObservations() {
			const mayShowOverlaySecret = name === "get_overlay_link" && result.status === 200 && !result.body?.error && !result.body?.result?.isError && args.creatorId === "fixture-creator";
			const safe = ![...(mayShowOverlaySecret ? [] : ["private-workflow-overlay"]), "private-workflow-runner", "private-second-runner", "private-workflow-key", "private-stream-error", "private-stream-key", "private-workflow-provider", "private-provider-payload", "private-state-token", encrypted, token].some((value) => responseTexts.join("\n").includes(value));
			const writes = (await fixture.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE action LIKE $1 AND outcome='success'", [name === "update_gallery_settings" ? "sensitive-integration:mcp.update_gallery_%" : `sensitive-integration:mcp.${name}`])).rows[0].count;
			const playlistItemCount = Number((await fixture.pool.query("SELECT count(*)::int AS count FROM playlist_clips WHERE playlist_id=$1", [playlistId])).rows[0].count);
			const playlistRevision = Number((await fixture.pool.query("SELECT configuration_revision FROM playlists WHERE id=$1", [playlistId])).rows[0]?.configuration_revision ?? 0);
			const activity = (await fixture.pool.query("SELECT target_type,target_id FROM audit_events WHERE action=$1 AND outcome='success' ORDER BY occurred_at DESC LIMIT 1", [`sensitive-integration:mcp.${name}`])).rows[0];
			const auditMessageFree = !(await fixture.pool.query("SELECT metadata FROM audit_events WHERE action=$1", [`sensitive-integration:mcp.${name}`])).rows.some((row) => JSON.stringify(row).includes(String(args.message ?? "The queue did not advance.")));
			if (feedbackSdk) await feedbackSdk.flush(2000);
			const storedOverlay = (await fixture.pool.query("SELECT name,player_volume,min_clip_views,theme_text_color,configuration_revision FROM overlays WHERE id=$1", [overlayId])).rows[0];
			const storedGallery = (await fixture.pool.query("SELECT name,layout,accent_color,configuration_revision FROM galleries WHERE id=$1", [galleryId])).rows[0];
			return { storedOverlay, storedGallery, feedbackEvents, auditMessageFree, activity, series, nextPage: nextPage?.body?.result, replay: replay?.body?.result, playlistItemCount, playlistRevision, status: result.status, result: result.body?.result, error: result.body?.error, safe, commands, providerCalls, writes, ids: { overlayId, playlistId, galleryId, runnerId, sessionId }, schemaValid: toolInputSchemas[name as keyof typeof toolInputSchemas]?.safeParse(args).success };
		}
		return await collectWorkflowObservations();
	} finally {
		globalThis.fetch = originalFetch;
		removeSubscriber("fixture-creator", overlayId, source as any);
	}
}
