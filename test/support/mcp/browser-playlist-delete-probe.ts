import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	process.env.BETTER_AUTH_SECRET = "isolated-browser-delete-secret-32chars";

	const mode = process.argv[2],
		playlistId = "a1dca8b8-089a-47ce-b649-1c32bb3842c1",
		overlayId = randomUUID();
	try {
		await fixture.pool.query(
			`INSERT INTO auth."user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.invalid',true,now(),now()),('foreign','Foreign','foreign@example.invalid',true,now(),now()); INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Creator','creator-org',now()); INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('creator','creator@example.invalid','Creator','','user','free'); INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('creator','creator-org','active'); INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ('owner','creator-org','owner','owner',now());`,
		);
		await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'creator','Browser playlist');", [playlistId]);
		await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,'ClipFirst',0,$2)", [playlistId, JSON.stringify({ id: "ClipFirst", title: "First", duration: 10 })]);
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,playlist_id) VALUES($1,'creator','private-overlay-secret','Linked','active','Playlist',$2);", [overlayId, playlistId]);
		await fixture.pool.query("INSERT INTO galleries(owner_id,name,published,playlist_id) VALUES('creator','Linked',true,$1)", [playlistId]);
		const { auth } = await import("@/auth/config");
		const context = await auth.$context;
		const session = await context.internalAdapter.createSession(mode === "foreign" || mode === "overlay-foreign" ? "foreign" : "owner", false, { activeOrganizationId: "creator-org" }, true);
		if (!session || typeof context.secret !== "string") throw new Error("Fixture session unavailable");
		const signed = session.token + "." + createHmac("sha256", context.secret).update(session.token).digest("base64");
		const headers = new Headers({ cookie: context.authCookies.sessionToken.name + "=" + encodeURIComponent(signed) });
		if (mode === "removed" || mode === "overlay-removed") await fixture.pool.query("DELETE FROM auth.member WHERE id='owner'");
		if (mode === "suspended" || mode === "overlay-suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended'");
		if (mode === "expired-session" || mode === "overlay-expired") await fixture.pool.query("UPDATE auth.session SET expires_at=now()-interval '1 second'");
		if (mode.startsWith("commercial:")) process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		if (mode.includes("policy-grant") || mode.includes("policy-global-grant") || mode.includes("policy-allocation")) process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		const stateExtras: Record<string, unknown> = {};
		const service = await import("@/server/resources/browser-playlists");
		const remove = (service as any).deleteBrowserPlaylist;
		const reorder = (service as any).reorderBrowserPlaylist;
		let deleted: any = null;
		if (mode.startsWith("runner-browser")) {
			const runnerId = randomUUID(),
				sessionId = randomUUID();
			await fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'creator','Browser runner','private-browser-runner')", [runnerId]);
			await fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url) VALUES($1,'creator',$2,$3,'24/7','rtmp://custom.example/live')", [sessionId, runnerId, overlayId]);
			await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at) VALUES('creator','runner_access','partner',now()-interval '1 hour')");
			const action = await import("@/app/actions/runner");
			const storage = new AsyncLocalStorage<{ headers: Headers }>();
			Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
			const { workAsyncStorage } = createRequire(import.meta.url)("next/dist/server/app-render/work-async-storage.external.js");
			const workStore = { route: "/dashboard/runners/[id]", isStaticGeneration: false, incrementalCache: {}, pendingRevalidatedTags: [] };
			const run = <T>(operation: () => Promise<T>) => workAsyncStorage.run(workStore, () => storage.run({ headers }, operation));
			if (mode.includes("-suspend")) {
				await fixture.pool.query("UPDATE stream_sessions SET desired_state='running',actual_state='running' WHERE id=$1", [sessionId]);
				const entitlements = await import("@/app/lib/entitlements");
				stateExtras.runnerOutcome = await entitlements.suspendRunnersForOwner("creator", "fixture_expiry");
				stateExtras.firstSuspendRevision = (await fixture.pool.query("SELECT configuration_revision FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].configuration_revision;
				await entitlements.suspendRunnersForOwner("creator", "fixture_expiry_repeat");
			} else if (mode.includes("-enroll")) {
				await fixture.pool.query("INSERT INTO runner_enrollments(device_code,user_code,api_base,hostname,os_info,version,expires_at) VALUES('fixture-device-code','ABCD-EFGH','http://127.0.0.1:3107','Enrolled native runner','Linux','fixture',now()+interval '5 minutes')");
				const enrollment = await import("@/app/runner/enroll/actions");
				const form = new FormData();
				form.set("code", "ABCD-EFGH");
				form.set("runnerId", runnerId);
				const { RequestCookies } = createRequire(import.meta.url)("next/dist/compiled/@edge-runtime/cookies");
				const enrollmentStorage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
				Reflect.set(globalThis, Symbol.for("next-ws.request-store"), enrollmentStorage);
				stateExtras.runnerOutcome = await workAsyncStorage.run(workStore, () => enrollmentStorage.run({ headers, cookies: new RequestCookies(headers) }, () => enrollment.submitRunnerSelection({ status: "idle" }, form)));
			} else if (mode.includes("-heartbeat")) {
				await fixture.pool.query("UPDATE runners SET name='New Hardware Node' WHERE id=$1", [runnerId]);
				if (mode.endsWith("expired")) {
					await fixture.pool.query("DELETE FROM entitlement_grants WHERE user_id='creator'");
					await fixture.pool.query("UPDATE stream_sessions SET desired_state='running',actual_state='running' WHERE id=$1", [sessionId]);
				}
				const heartbeat = await import("@/app/api/runner/heartbeat/route");
				const request = () => new Request("http://127.0.0.1:3107/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer private-browser-runner", "Content-Type": "application/json" }, body: JSON.stringify({ hostname: "Native runner", os: "Linux", version: "fixture" }) });
				stateExtras.firstHeartbeatStatus = (await heartbeat.POST(request())).status;
				stateExtras.firstHeartbeatRecord = (await fixture.pool.query("SELECT name,configuration_revision FROM runners WHERE id=$1", [runnerId])).rows[0];
				stateExtras.firstHeartbeatSessionRevision = (await fixture.pool.query("SELECT configuration_revision FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].configuration_revision;
				stateExtras.secondHeartbeatStatus = (await heartbeat.POST(request())).status;
			} else if (mode.includes("-unlink")) stateExtras.runnerOutcome = await run(() => action.unlinkRunner(runnerId, "creator"));
			else if (mode.includes("-control")) stateExtras.runnerOutcome = await run(() => (action.setStreamDesiredState as any)(sessionId, "running", mode.endsWith("stale") ? 99 : 1));
			else stateExtras.runnerOutcome = await run(() => (action.upsertStreamSession as any)({ id: sessionId, ownerId: "creator", runnerId, overlayId, mode: "24/7", rtmpUrl: "rtmp://custom.example/live", streamKey: "", resolution: "720p", fps: 30, expectedRevision: mode.endsWith("stale") ? 99 : 1 }));
			stateExtras.runnerRecord = (await fixture.pool.query("SELECT name,configuration_revision,status,last_heartbeat_at,token <> $2 AS credential_rotated FROM runners WHERE id=$1", [runnerId, "private-browser-runner"])).rows[0];
			stateExtras.runnerSession = (await fixture.pool.query("SELECT configuration_revision,resolution,fps,desired_state,actual_state FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
		} else if (mode.startsWith("settings-save")) {
			await fixture.pool.query('INSERT INTO "userSettings"(id,prefix,marketing_opt_in) VALUES($1,$2,false)', ["creator", "!"]);
			const { db } = await import("@/db/client");
			const { settingsTable } = await import("@/db/schema");
			const [settings] = await db.select().from(settingsTable);
			const action = await import("@/app/actions/database");
			const { RequestCookies } = createRequire(import.meta.url)("next/dist/compiled/@edge-runtime/cookies");
			const storage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
			Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
			if (mode === "settings-save-stale") await fixture.pool.query('UPDATE "userSettings" SET configuration_revision=2');
			try {
				stateExtras.savedSettings = await storage.run({ headers, cookies: new RequestCookies(headers) }, () => action.saveSettings({ ...settings, creatorPageVisibility: "unlisted" }));
			} catch (error) {
				stateExtras.settingsError = error instanceof Error ? error.message : "unknown";
			}
			stateExtras.settingsState = (await fixture.pool.query('SELECT configuration_revision,creator_page_visibility FROM "userSettings"')).rows[0];
		} else if (mode.startsWith("gallery-")) {
			const storage = new AsyncLocalStorage<{ headers: Headers }>();
			Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
			const action = await import("@/app/actions/gallery");
			const galleryId = (await fixture.pool.query("SELECT id FROM galleries LIMIT 1")).rows[0].id;
			const nativeRequire = createRequire(import.meta.url);
			const { workAsyncStorage } = nativeRequire("next/dist/server/app-render/work-async-storage.external.js");
			const requestWorkStore = { route: "/dashboard/galleries/[galleryId]", isStaticGeneration: false, incrementalCache: {}, pendingRevalidatedTags: [] };
			if (mode === "gallery-create-race") {
				await fixture.pool.query("DELETE FROM galleries");
				const principal = await (await import("@/auth/session-principal")).getVerifiedSessionPrincipal(headers);
				if (!principal) throw new Error("BROWSER_GALLERY_FIXTURE_SESSION_MISSING");
				const shared = await import("@/server/resources/galleries");
				const attempts = await Promise.allSettled([workAsyncStorage.run(requestWorkStore, () => storage.run({ headers }, () => action.createGallery("creator", "Browser gallery"))), shared.createGalleryForPrincipal(principal, { creatorId: "creator", name: "Principal gallery", retryKey: "session-unused" })]);
				stateExtras.creationAttempts = attempts.map((row) => (row.status === "fulfilled" ? { status: row.status, created: Boolean(row.value) } : { status: row.status, reason: row.reason.message }));
				stateExtras.galleryCount = Number((await fixture.pool.query("SELECT count(*) FROM galleries")).rows[0].count);
			} else deleted = await workAsyncStorage.run(requestWorkStore, () => storage.run({ headers }, () => (action.saveGallery as any)(galleryId, { name: "Browser edited gallery" }, mode === "gallery-save-stale" ? 99 : 1)));
			stateExtras.revalidatedTags = requestWorkStore.pendingRevalidatedTags;
			stateExtras.galleryRevision = (await fixture.pool.query("SELECT configuration_revision FROM galleries WHERE id=$1", [galleryId])).rows[0]?.configuration_revision;
		} else if (mode.startsWith("commercial:")) {
			stateExtras.commercialObservation = await (await import("./browser-commercial-policy")).observeBrowserCommercialPolicy({ pool: fixture.pool, headers, overlayId, playlistId, mode });
		} else if (mode.startsWith("playlist-list-") || mode.startsWith("playlist-get-")) {
			const { RequestCookies } = createRequire(process.cwd() + "/package.json")("next/dist/compiled/@edge-runtime/cookies");
			const storage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
			Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
			if (mode.endsWith("removed")) await fixture.pool.query("DELETE FROM auth.member WHERE id='owner'");
			if (mode.endsWith("read-denied")) await fixture.pool.query("UPDATE users SET plan='pro'; UPDATE auth.member SET role='billing-manager' WHERE id='owner'");
			const actions = await import("@/app/actions/database");
			stateExtras.playlistReadObservation = await storage.run({ headers, cookies: new RequestCookies(headers) }, async () => {
				if (mode.startsWith("playlist-list-")) {
					const rows = await actions.getAllPlaylists("creator");
					return { available: rows !== null, names: rows?.map((row) => row.name) ?? [], clipCounts: rows?.map((row) => row.clipCount) ?? [] };
				}
				const clips = await actions.getPlaylistClips(playlistId);
				return { available: true, clipIds: clips.map((clip) => clip.id), titles: clips.map((clip) => clip.title) };
			});
		} else if (mode.startsWith("overlay-list-") || mode.startsWith("overlay-get-") || mode.startsWith("overlay-editor-")) {
			const { RequestCookies } = createRequire(process.cwd() + "/package.json")("next/dist/compiled/@edge-runtime/cookies");
			const storage = new AsyncLocalStorage<{ headers: Headers; cookies: unknown }>();
			Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
			if (mode === "overlay-list-removed" || mode === "overlay-get-removed") await fixture.pool.query("DELETE FROM auth.member WHERE id='owner'");
			if (mode === "overlay-list-read-denied" || mode === "overlay-get-read-denied") await fixture.pool.query("UPDATE users SET plan='pro'; UPDATE auth.member SET role='billing-manager' WHERE id='owner'");
			if (mode === "overlay-list-read-only" || mode === "overlay-get-read-only") {
				await fixture.pool.query("UPDATE users SET plan='pro'");
				await fixture.pool.query("INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('read-only-role','creator-org','read-only',$1)", [JSON.stringify({ creator: ["read"], overlay: ["read"] })]);
				await fixture.pool.query("UPDATE auth.member SET role='read-only' WHERE id='owner'");
			}

			if (mode.startsWith("overlay-editor-")) {
				await fixture.pool.query(
					"UPDATE users SET plan='pro' WHERE id='creator'; INSERT INTO auth.organization(id,name,slug,created_at) VALUES('personal-org','Personal','personal-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('personal-creator','personal@example.invalid','Personal','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('personal-creator','personal-org','active'); INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES('personal-owner','personal-org','owner','owner',now())",
				);
				await fixture.pool.query("UPDATE auth.session SET active_organization_id='personal-org' WHERE id=$1", [session.id]);
				await fixture.pool.query("UPDATE auth.member SET role='operations' WHERE id='owner'");
				if (mode === "overlay-editor-removed") await fixture.pool.query("DELETE FROM auth.member WHERE id='owner'");
				if (mode === "overlay-editor-read-only") {
					await fixture.pool.query("INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('editor-read-only-role','creator-org','read-only',$1)", [JSON.stringify({ creator: ["read"], overlay: ["read"] })]);
					await fixture.pool.query("UPDATE auth.member SET role='read-only' WHERE id='owner'");
				}
			}

			const actions = await import("@/app/actions/database");
			const rows = await storage.run({ headers, cookies: new RequestCookies(headers) }, async () => {
				if (mode.startsWith("overlay-editor-")) return actions.getEditorOverlays("personal-creator");
				if (mode.startsWith("overlay-list-")) return actions.getAllOverlays("creator");
				const row = await actions.getOverlay(overlayId);
				return row ? [row] : null;
			});
			stateExtras.listObservation = { available: rows !== null, count: rows?.length ?? 0, ownerIds: rows?.map((row) => row.ownerId) ?? [], ownerSecretPresent: rows?.some((row) => row.secret === "private-overlay-secret") ?? false };
		} else if (mode === "overlay-create-quota-feedback") {
			const browserService = await import("@/server/resources/browser-overlays");
			const createWithFeedback = (browserService as any).createBrowserOverlayWithFeedback;
			stateExtras.creationFeedbackAvailable = typeof createWithFeedback === "function";
			stateExtras.creationFeedback = createWithFeedback ? await createWithFeedback("creator", headers) : null;
		} else if (mode.startsWith("volume-")) {
			if (!mode.endsWith("free")) await fixture.pool.query("UPDATE users SET plan='pro'");
			await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'creator','second-private-secret','Second','active','Featured')", [randomUUID()]);
			if (mode.endsWith("removed")) await fixture.pool.query("DELETE FROM auth.member");
			if (mode.endsWith("suspended")) await fixture.pool.query("UPDATE creator_accounts SET status='suspended'");
			if (mode.endsWith("disabled") && !mode.includes("policy")) await fixture.pool.query("UPDATE users SET disabled=true");
			if (mode.endsWith("overflow")) await fixture.pool.query("UPDATE overlays SET configuration_revision=2147483647 WHERE id=$1", [overlayId]);
			const browserService = await import("@/server/resources/browser-overlays");
			const resourceService = await import("@/server/resources/overlays");
			const browserSet = (browserService as any).setBrowserOverlayVolume;
			const chatSet = (resourceService as any).updateTrustedChatOverlayVolume;
			let policyWriter;
			if (mode.includes("chat-policy")) {
				const { interleaveOwnerPolicyWriter } = await import("./policy-writer-interleave");
				if (mode.includes("policy-grant") || mode.includes("policy-global-grant")) {
					await fixture.pool.query("UPDATE users SET plan='free' WHERE id='creator'");
					await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,starts_at,ends_at) VALUES($1,'pro_access',now()-interval '1 day',now()+interval '1 day')", [mode.includes("policy-global-grant") ? null : "creator"]);
				}
				if (mode.includes("policy-allocation")) {
					const { seedCreatorProAllocation } = await import("./seed-pro-allocation");
					await seedCreatorProAllocation(fixture.pool, "creator", "creator-org", "owner");
				}
				policyWriter = interleaveOwnerPolicyWriter(fixture.pool, "creator", mode.split("-policy-")[1] as Parameters<typeof interleaveOwnerPolicyWriter>[2]);
			}
			if (mode.startsWith("volume-public")) {
				const storage = new AsyncLocalStorage<{ headers: Headers }>();
				Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
				const { default: axios } = await import("axios");
				const axiosCjs = createRequire(process.cwd() + "/package.json")("axios");
				const transports = [...new Set([axios, axiosCjs.default ?? axiosCjs])];
				const originalAdapters = transports.map((transport) => transport.defaults.adapter);
				const chatMessages: string[] = [];
				const controlledAdapter: typeof axios.defaults.adapter = async (config: any) => {
					const url = new URL(config.url!);
					if (url.origin === "https://id.twitch.tv" && url.pathname === "/oauth2/token") return { status: 200, statusText: "OK", headers: {}, config, data: { access_token: "isolated-chat-token", expires_in: 3600, token_type: "bearer" } };
					if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/chat/messages") {
						chatMessages.push(JSON.parse(config.data).message);
						return { status: 200, statusText: "OK", headers: {}, config, data: { data: [] } };
					}
					throw new Error("Unexpected isolated provider request");
				};
				for (const transport of transports) transport.defaults.adapter = controlledAdapter;
				try {
					await fixture.pool.query('INSERT INTO "userSettings"(id,prefix) VALUES($1,$2)', ["creator", "!"]);
					await storage.run({ headers }, async () => {
						if (mode.includes("controller")) {
							const action = await import("@/app/actions/controller");
							deleted = await action.runControllerAction(overlayId, { action: "set_volume", volume: 73 });
						} else if (mode.includes("chat")) {
							const action = await import("@/app/actions/commands");
							const message = (text: string) => ({ broadcaster_user_id: "creator", chatter_user_id: "creator", chatter_user_name: "Verified owner", chatter_user_login: "owner", badges: [], message: { text, fragments: [{ type: "text", text }] } }) as any;
							if (mode.includes("downgrade")) {
								await action.handleCommand(message("!volume"));
								await fixture.pool.query("UPDATE users SET plan='free'");
								chatMessages.length = 0;
							}
							try {
								await action.handleCommand(message("!volume 73"));
								deleted = true;
							} catch {
								deleted = null;
							}
						} else {
							const action = await import("@/app/actions/database");
							deleted = await action.setPlayerVolumeForOwner("creator", mode.endsWith("high") ? 150 : mode.endsWith("low") ? -10 : 73);
						}
					});
					stateExtras.chatMessages = chatMessages;
				} finally {
					transports.forEach((transport, index) => {
						transport.defaults.adapter = originalAdapters[index];
					});
				}
			} else
				try {
					deleted = mode.startsWith("volume-chat") ? (chatSet ? await chatSet("creator", 73, "verified-twitch-moderator") : null) : browserSet ? await browserSet("creator", 73, headers) : null;
				} catch {
					deleted = null;
				}
			if (policyWriter) {
				policyWriter.restore();
				stateExtras.policyInterleave = await policyWriter.finish();
			}
			stateExtras.volumeRows = (await fixture.pool.query("SELECT player_volume,configuration_revision FROM overlays ORDER BY id")).rows;
			stateExtras.volumeActivity = (await fixture.pool.query("SELECT action,actor_user_id,actor_session_id,metadata FROM audit_events ORDER BY occurred_at,id")).rows;
		} else if (mode.startsWith("overlay-save")) {
			if (mode === "overlay-save-pro" || mode.startsWith("overlay-save-sanitize") || mode.startsWith("overlay-save-reward")) await fixture.pool.query("UPDATE users SET plan='pro'");
			if (mode === "overlay-save-removed") await fixture.pool.query("DELETE FROM auth.member");
			if (mode === "overlay-save-suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended'");
			if (mode === "overlay-save-reward-outbox-rollback") await fixture.pool.query("CREATE FUNCTION reject_effect_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$; CREATE TRIGGER reject_effect_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_effect_audit()");
			if (mode === "overlay-save-reward-outbox-unchanged" || mode === "overlay-save-reward-outbox-clear") await fixture.pool.query("UPDATE overlays SET reward_id='RewardOne' WHERE id=$1", [overlayId]);
			if (mode.startsWith("overlay-save-reward")) {
				process.env.TWITCH_CLIENT_ID = "isolated-browser-reward-client";
				const { symmetricEncrypt } = await import("better-auth/crypto");
				const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET!, data: "isolated-browser-reward-owner-token" });
				await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('creator','owner','twitch_onboarding')");
				await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES($1,'creator','twitch','owner',$2,now()+interval '1 hour','channel:read:redemptions',now(),now())", [randomUUID(), encrypted]);
				globalThis.fetch = (async (input: any, init: any) => {
					const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
					const requestHeaders = new Headers(init?.headers);
					if (url.origin !== "https://api.twitch.tv" || url.pathname !== "/helix/channel_points/custom_rewards" || url.searchParams.get("broadcaster_id") !== "creator" || url.searchParams.get("id") !== "RewardOne" || requestHeaders.get("Authorization") !== "Bearer isolated-browser-reward-owner-token" || requestHeaders.get("Client-Id") !== process.env.TWITCH_CLIENT_ID) throw new Error("Unexpected reward metadata fixture I/O");
					return Response.json({ data: [{ id: "RewardOne", broadcaster_id: "creator" }] });
				}) as typeof fetch;
			}
			const overlayService = await import("@/server/resources/browser-overlays");
			const save = (overlayService as any).saveBrowserOverlay;
			const patch =
				mode === "overlay-save-reward" || (mode.startsWith("overlay-save-reward-outbox") && mode !== "overlay-save-reward-outbox-clear")
					? { rewardId: "RewardOne" }
					: mode === "overlay-save-reward-clear" || mode === "overlay-save-reward-outbox-clear"
						? { rewardId: null }
						: mode === "overlay-save-free-snapshot"
							? { name: "Browser renamed overlay", playerVolume: 50, themeFontFamily: "inherit" }
							: mode === "overlay-save-sanitize-font"
								? { themeFontFamily: "Bad<script>" }
								: mode === "overlay-save-sanitize-color"
									? { themeTextColor: "url(https://evil.example.invalid/x)" }
									: mode === "overlay-save-sanitize-type"
										? { type: "Featured", playbackMode: "order" }
										: mode === "overlay-save-free-advanced" || mode === "overlay-save-pro"
											? { playerVolume: 73 }
											: mode === "overlay-save-invalid"
												? { ownerId: "foreign" }
												: { name: "Browser renamed overlay" };
			if (mode === "overlay-save-reward-outbox-public") {
				const storage = new AsyncLocalStorage<{ headers: Headers }>();
				Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
				const { default: axios } = await import("axios");
				const axiosCjs = createRequire(process.cwd() + "/package.json")("axios");
				const transports = [...new Set([axios, axiosCjs.default ?? axiosCjs])];
				const adapters = transports.map((transport) => transport.defaults.adapter);
				const requests: string[] = [];
				for (const transport of transports)
					transport.defaults.adapter = async (config: any) => {
						const url = new URL(config.url);
						if (url.origin === "https://id.twitch.tv" && url.pathname === "/oauth2/token") {
							requests.push("token");
							return { status: 200, statusText: "OK", headers: {}, config, data: { access_token: "isolated-reward-token", token_type: "bearer", expires_in: 3600 } };
						}
						if (url.origin === "https://api.twitch.tv" && url.pathname === "/helix/eventsub/subscriptions") {
							requests.push("subscription");
							return { status: 202, statusText: "Accepted", headers: {}, config, data: { data: [] } };
						}
						throw new Error("Unexpected public reward fixture I/O");
					};
				try {
					const action = await import("@/app/actions/database");
					deleted = await storage.run({ headers }, () => action.saveOverlay(overlayId, patch as any, 1));
					await new Promise<void>((resolve) => setImmediate(resolve));
					stateExtras.providerRequests = requests;
				} finally {
					transports.forEach((transport, index) => {
						transport.defaults.adapter = adapters[index];
					});
				}
			} else {
				deleted = save ? await save(overlayId, patch, mode === "overlay-save-stale" || mode === "overlay-save-reward-outbox-stale" ? 2 : mode === "overlay-save-missing" ? undefined : 1, headers) : null;
			}
			if (mode.startsWith("overlay-save-reward-outbox")) {
				const exists = await fixture.pool.query("SELECT to_regclass('public.overlay_effect_jobs') IS NOT NULL AS present");
				stateExtras.effectJobs = exists.rows[0].present ? (await fixture.pool.query("SELECT overlay_id,creator_id,reward_id,configuration_revision,status,attempts FROM overlay_effect_jobs ORDER BY created_at,id")).rows : [];
			}
			stateExtras.storedOverlay = (await fixture.pool.query("SELECT name,player_volume,configuration_revision,reward_id,theme_font_family,theme_text_color,type,playback_mode,playlist_id FROM overlays WHERE id=$1", [overlayId])).rows[0];
		} else if (mode.startsWith("overlay-")) {
			const overlayService = await import("@/server/resources/browser-overlays");
			const removeOverlay = (overlayService as any).deleteBrowserOverlay;
			deleted = removeOverlay ? await removeOverlay(mode === "overlay-missing" ? randomUUID() : overlayId, mode === "overlay-stale" ? 2 : mode === "overlay-missing-revision" ? undefined : 1, headers) : null;
		} else if (mode.startsWith("items")) {
			if (mode.startsWith("items-stored-")) {
				const metadata: Record<string, string> = {
					malformed: "{broken",
					null: "null",
					array: "[]",
					primitive: "42",
					mismatch: JSON.stringify({ id: "DifferentClip", title: "Untrusted" }),
					wrapped: JSON.stringify({ clip: { id: "ClipFirst", title: "Legacy clip", duration: 10 } }),
				};
				await fixture.pool.query("UPDATE playlist_clips SET clip_data=$1", [metadata[mode.slice("items-stored-".length)]]);
			}
			process.env.TWITCH_CLIENT_ID = "isolated-provider-client";
			const { symmetricEncrypt } = await import("better-auth/crypto");
			const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET!, data: "isolated-provider-token" });
			await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('creator','owner','twitch_onboarding')");
			await fixture.pool.query("INSERT INTO auth.account(id,account_id,provider_id,user_id,access_token,access_token_expires_at,created_at,updated_at) VALUES($1,'creator','twitch','owner',$2,now()+interval '1 hour',now(),now())", [randomUUID(), encrypted]);
			if (mode.startsWith("items-import")) await fixture.pool.query("UPDATE users SET plan='pro'");
			if (mode === "items-limit" || mode === "items-pro") {
				for (let i = 1; i < 50; i++) await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES($1,$2,$3,$4)", [playlistId, "Existing" + i, i, JSON.stringify({ id: "Existing" + i, title: "Trusted", duration: 10 })]);
				if (mode === "items-pro") await fixture.pool.query("UPDATE users SET plan='pro'");
			}
			const originalFetch = globalThis.fetch;
			let providerCalls = 0;
			globalThis.fetch = (async (input: any, init: any) => {
				const req = input instanceof Request ? input : new Request(input, init);
				if (new URL(req.url).origin !== "https://api.twitch.tv") return originalFetch(input, init);
				providerCalls++;
				if (req.headers.get("Authorization") !== "Bearer isolated-provider-token") throw new Error("Fixture credential mismatch");
				if (mode === "items-provider-error") return new Response("controlled error", { status: 503 });
				if (mode === "items-import-downgrade") await fixture.pool.query("UPDATE users SET plan='free'");
				if (mode === "items-lost-access") await fixture.pool.query("DELETE FROM auth.member");
				if (mode === "items-raced") await fixture.pool.query("UPDATE playlists SET configuration_revision=2,name='Concurrent name'");
				return new Response(JSON.stringify({ data: new URL(req.url).searchParams.getAll("id").map((id) => ({ id, title: "Trusted " + id, duration: 12, broadcaster_id: "creator", created_at: "2026-10-05T00:00:00Z" })) }), { status: 200 });
			}) as typeof fetch;
			try {
				const save = (service as any).saveBrowserPlaylistItems;
				const ids = mode === "items-clear" ? [] : mode === "items-retained" || mode.startsWith("items-stored-") ? ["ClipFirst"] : ["NewClip"];
				deleted = save ? await save(playlistId, ids, mode === "items-limit" || mode === "items-pro" ? "append" : "replace", mode === "items-stale" ? 2 : mode === "items-missing" ? undefined : 1, mode === "items-rename" ? "New playlist name" : undefined, headers, mode.startsWith("items-import")) : null;
				(stateExtras as any).providerCalls = providerCalls;
			} finally {
				globalThis.fetch = originalFetch;
			}
		} else if (mode.startsWith("reorder")) {
			if (mode === "reorder-removed") await fixture.pool.query("DELETE FROM auth.member WHERE id='owner'");
			if (mode === "reorder-suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended'");
			deleted = reorder ? await reorder(playlistId, mode === "reorder-invalid" ? ["Unknown"] : ["ClipFirst"], mode === "reorder-stale" ? 2 : mode === "reorder-missing" ? undefined : 1, headers) : null;
		} else if (mode === "rename") deleted = !!(await service.saveBrowserPlaylist(playlistId, { name: "Browser renamed" }, 1, headers));
		else if (remove) deleted = await remove(mode === "missing" ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : playlistId, mode === "stale" ? 2 : mode === "missing-revision" ? undefined : 1, headers);
		stateExtras.linkedGalleryRevision = (await fixture.pool.query("SELECT configuration_revision FROM galleries LIMIT 1")).rows[0]?.configuration_revision;
		const state = { playlists: Number((await fixture.pool.query("SELECT count(*) FROM playlists")).rows[0].count), items: Number((await fixture.pool.query("SELECT count(*) FROM playlist_clips")).rows[0].count), overlay: (await fixture.pool.query("SELECT playlist_id,configuration_revision FROM overlays")).rows[0], gallery: (await fixture.pool.query("SELECT playlist_id,published FROM galleries")).rows[0] };
		const activity = (await fixture.pool.query("SELECT action,actor_user_id,actor_session_id,metadata FROM audit_events WHERE target_id=$1 ORDER BY occurred_at,id", [mode.startsWith("overlay-") ? overlayId : playlistId])).rows;
		console.log(
			JSON.stringify({
				...stateExtras,
				overlayCount: Number((await fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count),
				storedItems: (await fixture.pool.query("SELECT clip_id,position,clip_data FROM playlist_clips ORDER BY position")).rows,
				playlistName: (await fixture.pool.query("SELECT name FROM playlists WHERE id=$1", [playlistId])).rows[0]?.name,
				available: !!remove,
				deleted,
				state,
				activity,
				sessionId: session.id,
				revision: (await fixture.pool.query("SELECT configuration_revision FROM playlists WHERE id=$1", [playlistId])).rows[0]?.configuration_revision,
			}),
		);
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
