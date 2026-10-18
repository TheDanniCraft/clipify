import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";

/** Exercise real authenticated actions and storage; never use a shared database or external provider. */
export async function runRunnerDestinationsProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = (async (value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		const runnerId = randomUUID();
		const deviceToken = randomUUID();
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Destination fixture',$2)", [runnerId, deviceToken]);
		const { auth } = await import("@/auth/config");
		const context = await auth.$context;
		const session = await context.internalAdapter.createSession(input.actorId, false, { activeOrganizationId: "creator-org" }, true);
		if (!session || typeof context.secret !== "string") throw new Error("RUNNER_FIXTURE_SESSION_UNAVAILABLE");
		const signed = session.token + "." + createHmac("sha256", context.secret).update(session.token).digest("base64");
		const headers = new Headers({ cookie: context.authCookies.sessionToken.name + "=" + encodeURIComponent(signed) });
		const storage = new AsyncLocalStorage<{ headers: Headers }>();
		Reflect.set(globalThis, Symbol.for("next-ws.request-store"), storage);
		const { workAsyncStorage } = createRequire(import.meta.url)("next/dist/server/app-render/work-async-storage.external.js");
		const actions = await import("@/app/actions/runner");
		return await workAsyncStorage.run({ route: "/dashboard/runners/[id]", isStaticGeneration: false, incrementalCache: {}, pendingRevalidatedTags: [] }, () =>
			storage.run({ headers }, async () => {
				const tokenResult = await actions.getRunnerToken(runnerId, "fixture-creator");
				const authenticated = tokenResult.success && tokenResult.token === deviceToken;
				// The established action module imports successfully. Absence of the new named-destination
				// boundary is the explicit missing product contract, never an import/setup failure.
				const save = Reflect.get(actions, "saveRunnerDestination");
				const list = Reflect.get(actions, "listRunnerDestinations");
				if (typeof save !== "function" || typeof list !== "function") return { authenticated, available: false };
				if (input.variant === "destinations_standby_permission") return (await import("./runner-standby-probe")).runRunnerStandbyPermissionProbe({ ...input, runnerId, actions, headers });
				if (input.variant.startsWith("schedule_")) return (await import("./runner-schedule-probe")).runRunnerScheduleProbe({ ...input, authenticated, runnerId, deviceToken, actions });
				if (input.variant.startsWith("multistream_")) return (await import("./runner-multistream-probe")).runRunnerMultistreamProbe({ ...input, authenticated, runnerId, deviceToken, actions });
				if (input.variant.startsWith("destinations_legacy_")) {
					const overlayId = randomUUID();
					const sessionId = randomUUID();
					const legacyKey = "private-legacy-conversion-key";
					const legacyUrl = input.variant === "destinations_legacy_youtube" ? "rtmp://a.rtmp.youtube.com/live2" : input.variant === "destinations_legacy_custom" ? "rtmp://127.0.0.1:1940/custom" : "rtmp://live.twitch.tv/app";
					const { encryptString, decryptString } = await import("@/app/lib/encryption");
					await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','legacy-source-secret','Legacy source','active','Featured')", [overlayId]);
					await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url,encrypted_stream_key) VALUES($1,'fixture-creator',$2,$3,'24/7',$4,$5)", [sessionId, runnerId, overlayId, legacyUrl, input.variant === "destinations_legacy_custom" ? null : encryptString(legacyKey)]);
					const data = { id: sessionId, ownerId: "fixture-creator", runnerId, overlayId, mode: "24/7" as Parameters<typeof actions.upsertStreamSession>[0]["mode"], streamKey: "", rtmpUrl: legacyUrl };
					if (input.variant === "destinations_legacy_rollback") {
						const before = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						await input.fixture.pool.query("CREATE FUNCTION legacy_conversion_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled legacy conversion failure'; END $$");
						await input.fixture.pool.query("CREATE TRIGGER legacy_conversion_failure AFTER INSERT ON runner_destinations FOR EACH ROW EXECUTE FUNCTION legacy_conversion_failure()");
						const attempted = await actions.upsertStreamSession({ ...data, expectedRevision: 1, streamKey: "must-not-persist-legacy-key" });
						const after = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						return { authenticated, attempted, unchanged: JSON.stringify(before) === JSON.stringify(after), targets: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_destinations")).rows[0].count), references: Number((await input.fixture.pool.query("SELECT count(*) FROM stream_session_destinations")).rows[0].count) };
					}

					if (input.variant.startsWith("destinations_legacy_mcp_")) {
						const rollback = input.variant.endsWith("rollback");
						const before = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						if (rollback) {
							await input.fixture.pool.query("CREATE FUNCTION legacy_mcp_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled legacy MCP conversion failure'; END $$");
							await input.fixture.pool.query("CREATE TRIGGER legacy_mcp_failure AFTER INSERT ON runner_destinations FOR EACH ROW EXECUTE FUNCTION legacy_mcp_failure()");
						}
						const { call } = await (await import("./runner-free-pro-probe")).runRunnerFreeProProbe(input);
						const request = { sessionId, runnerId, overlayId, mode: "24/7", resolution: "720p", fps: 30 };
						const firstRaw = (await call("configure_stream_session", { ...request, expectedRevision: 1 })).result?.structuredContent;
						const first = { success: firstRaw?.id === sessionId && !firstRaw?.error, code: firstRaw?.error?.code };
						const firstRows = (await input.fixture.pool.query("SELECT id FROM runner_destinations WHERE owner_id='fixture-creator'")).rows;
						const secondRaw = rollback ? undefined : (await call("configure_stream_session", { ...request, expectedRevision: 2 })).result?.structuredContent;
						const rows = (await input.fixture.pool.query("SELECT id,encrypted_stream_key,credential_revision FROM runner_destinations WHERE owner_id='fixture-creator'")).rows;
						const references = (await input.fixture.pool.query("SELECT destination_id FROM stream_session_destinations WHERE session_id=$1", [sessionId])).rows;
						const reopened = await list("fixture-creator", runnerId);
						const readAfter = (await call("get_stream_session", { sessionId })).result?.structuredContent;
						return {
							authenticated,
							first,
							attempted: first,
							second: { success: secondRaw?.id === sessionId && !secondRaw?.error, code: secondRaw?.error?.code },
							firstCount: firstRows.length,
							count: rows.length,
							references: references.length,
							stable: rows.length === 1 && rows[0].id === firstRows[0]?.id && references[0]?.destination_id === rows[0].id,
							encrypted: rows.length === 1 && rows[0].encrypted_stream_key !== legacyKey && decryptString(rows[0].encrypted_stream_key) === legacyKey,
							credentialRevision: rows[0]?.credential_revision,
							reopened,
							readAfter,
							unchanged: JSON.stringify(before) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0]),
							safe: ![legacyKey, deviceToken].some((value) => JSON.stringify({ firstRaw, secondRaw, reopened, readAfter }).includes(value)),
						};
					}

					let peer: { id: string; before: unknown } | undefined;
					if (input.variant === "destinations_legacy_reuse" || input.variant === "destinations_legacy_collision") {
						const reuse = input.variant === "destinations_legacy_reuse";
						const savedPeer = await save({ ownerId: "fixture-creator", ...(reuse ? {} : { runnerId }), name: reuse ? "Reusable Twitch" : "Twitch", provider: reuse ? "twitch" : "custom", rtmpUrl: reuse ? legacyUrl : "rtmp://127.0.0.1:1942/collision", credentialAction: reuse ? "replace" : "clear", ...(reuse ? { streamKey: legacyKey } : {}) });
						if (!savedPeer.success) throw new Error("LEGACY_PEER_FIXTURE_FAILED");
						peer = { id: savedPeer.destination.id, before: (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [savedPeer.destination.id])).rows[0] };
					}

					const first = await actions.upsertStreamSession({ ...data, expectedRevision: 1 });
					const firstRows = (await input.fixture.pool.query("SELECT id FROM runner_destinations WHERE owner_id='fixture-creator'")).rows;
					if (input.variant.startsWith("destinations_legacy_endpoint_")) {
						const entry = input.variant.replace("destinations_legacy_endpoint_", "");
						const clear = entry === "clear";
						const targetUrl = clear ? "rtmp://127.0.0.1:1943/keyless" : entry === "mcp_same" ? legacyUrl : "rtmp://a.rtmp.youtube.com/live2";
						let attempted: unknown;
						if (entry.startsWith("mcp_")) {
							const { call } = await (await import("./runner-free-pro-probe")).runRunnerFreeProProbe(input);
							const body = (await call("configure_stream_session", { sessionId, runnerId, overlayId, mode: "24/7", expectedRevision: 2, destination: entry === "mcp_same" ? "twitch" : "youtube" })).result?.structuredContent;
							attempted = { success: body?.id === sessionId && !body?.error, credentialsRequired: body?.credentialsRequired, credentialsConfigured: body?.credentialsConfigured };
						} else attempted = await actions.upsertStreamSession({ ...data, expectedRevision: 2, rtmpUrl: targetUrl, ...(clear ? { clearStreamKey: true } : {}) });
						const target = (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [firstRows[0].id])).rows[0];
						const session = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						return { authenticated, attempted, endpointChanged: target.rtmp_url === targetUrl, provider: target.provider, keyPreserved: decryptString(target.encrypted_stream_key) === legacyKey, cleared: target.encrypted_stream_key === null, credentialRevision: target.credential_revision, configurationRevision: target.configuration_revision, scalarSynchronized: session.rtmp_url === target.rtmp_url && session.encrypted_stream_key === target.encrypted_stream_key };
					}

					if (input.variant.startsWith("destinations_legacy_authority_")) {
						const replacementKey = "private-authoritative-stream-key";
						const replacementUrl = "rtmps://retained-destination.invalid:443/live";
						const edited = await save({ ownerId: "fixture-creator", runnerId, id: firstRows[0].id, expectedRevision: 1, name: "Authoritative destination", provider: "custom", rtmpUrl: replacementUrl, credentialAction: "replace", streamKey: replacementKey });
						if (!edited.success) throw new Error("AUTHORITATIVE_DESTINATION_FIXTURE_FAILED");
						let attempted: unknown;
						if (input.variant.endsWith("mcp")) {
							const { call } = await (await import("./runner-free-pro-probe")).runRunnerFreeProProbe(input);
							const body = (await call("configure_stream_session", { sessionId, runnerId, overlayId, mode: "24/7", expectedRevision: 2, resolution: "720p", fps: 30 })).result?.structuredContent;
							attempted = { success: body?.id === sessionId && !body?.error, code: body?.error?.code };
						} else attempted = await actions.upsertStreamSession({ ...data, expectedRevision: 2, resolution: "720p", fps: 30 });
						const target = (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [firstRows[0].id])).rows[0];
						const session = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						const reopened = await list("fixture-creator", runnerId);
						return {
							authenticated,
							attempted,
							reopened,
							keyPreserved: decryptString(target.encrypted_stream_key) === replacementKey,
							endpointPreserved: target.rtmp_url === replacementUrl,
							providerPreserved: target.provider === "custom",
							credentialRevision: target.credential_revision,
							configurationRevision: target.configuration_revision,
							scalarSynchronized: session.rtmp_url === replacementUrl && decryptString(session.encrypted_stream_key) === replacementKey,
							safe: ![legacyKey, replacementKey, replacementUrl, deviceToken].some((value) => JSON.stringify({ attempted, reopened }).includes(value)),
						};
					}

					if (peer || input.variant === "destinations_legacy_youtube" || input.variant === "destinations_legacy_custom") {
						const targets = (await input.fixture.pool.query("SELECT d.id,d.name,d.provider,d.encrypted_stream_key FROM runner_destinations d JOIN stream_session_destinations s ON s.destination_id=d.id AND s.owner_id=d.owner_id WHERE s.session_id=$1", [sessionId])).rows;
						const start = input.variant === "destinations_legacy_custom" ? await actions.setStreamDesiredState(sessionId, "running" as Parameters<typeof actions.setStreamDesiredState>[1], 2) : undefined;
						return {
							authenticated,
							first,
							total: firstRows.length,
							targets: targets.map((target) => ({ id: target.id, name: target.name, provider: target.provider, keyConfigured: Boolean(target.encrypted_stream_key), keyPreserved: target.encrypted_stream_key ? decryptString(target.encrypted_stream_key) === legacyKey : null })),
							reused: peer ? targets[0]?.id === peer.id : undefined,
							peerUnchanged: peer ? JSON.stringify(peer.before) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [peer.id])).rows[0]) : undefined,
							start,
						};
					}

					if (input.variant === "destinations_legacy_owner_delete") {
						const remove = Reflect.get(actions, "deleteRunnerDestination");
						const blocked = await remove({ ownerId: "fixture-creator", id: firstRows[0].id, expectedRevision: 1 });
						const directDeletionBlocked = blocked.success === false && blocked.code === "RESOURCE_IN_USE";

						let ownerDeleted = false;
						let deletionFailure: { code?: string; constraint?: string } | undefined;
						try {
							await input.fixture.pool.query("DELETE FROM users WHERE id='fixture-creator'");
							ownerDeleted = true;
						} catch (error) {
							const diagnostic = error as { code?: string; constraint?: string };
							deletionFailure = { code: diagnostic.code, constraint: diagnostic.constraint };
						}
						return {
							authenticated,
							first,
							directDeletionBlocked,
							ownerDeleted,
							deletionFailure,
							constraints: (await input.fixture.pool.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'stream_session_destinations'::regclass")).rows,
							targets: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_destinations WHERE owner_id='fixture-creator'")).rows[0].count),
							references: Number((await input.fixture.pool.query("SELECT count(*) FROM stream_session_destinations WHERE owner_id='fixture-creator'")).rows[0].count),
						};
					}

					if (input.variant === "destinations_legacy_multiple") {
						const added = await save({ ownerId: "fixture-creator", runnerId, name: "Additional custom target", provider: "custom", rtmpUrl: "rtmp://127.0.0.1:1940/second", credentialAction: "clear" });
						if (!added.success) throw new Error("LEGACY_ADDITIONAL_TARGET_FIXTURE_FAILED");
						await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,'fixture-creator',1)", [sessionId, added.destination.id]);
						const before = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						const attempted = await actions.upsertStreamSession({ ...data, expectedRevision: 2, streamKey: "must-not-change-multiple-key" });
						return { authenticated, first, attempted, unchanged: JSON.stringify(before) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0]), targets: Number((await input.fixture.pool.query("SELECT count(*) FROM runner_destinations")).rows[0].count), references: Number((await input.fixture.pool.query("SELECT count(*) FROM stream_session_destinations WHERE session_id=$1", [sessionId])).rows[0].count) };
					}

					if (input.variant === "destinations_legacy_shared") {
						const otherSession = randomUUID();
						await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url,encrypted_stream_key) SELECT $1,owner_id,runner_id,overlay_id,mode,rtmp_url,encrypted_stream_key FROM stream_sessions WHERE id=$2", [otherSession, sessionId]);
						await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,'fixture-creator',0)", [otherSession, firstRows[0].id]);
						const before = (await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0];
						const targetBefore = (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [firstRows[0].id])).rows[0];
						const attempted = await actions.upsertStreamSession({ ...data, expectedRevision: 2, streamKey: "must-not-change-shared-key" });
						return {
							authenticated,
							first,
							attempted,
							unchanged: JSON.stringify(before) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM stream_sessions WHERE id=$1", [sessionId])).rows[0]),
							targetUnchanged: JSON.stringify(targetBefore) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [firstRows[0].id])).rows[0]),
							references: Number((await input.fixture.pool.query("SELECT count(*) FROM stream_session_destinations WHERE destination_id=$1", [firstRows[0].id])).rows[0].count),
						};
					}

					const rekey = input.variant === "destinations_legacy_rekey";
					const second = await actions.upsertStreamSession({ ...data, expectedRevision: 2, ...(rekey ? { streamKey: "replacement-legacy-key" } : {}) });
					const rows = (await input.fixture.pool.query("SELECT id,encrypted_stream_key,credential_revision FROM runner_destinations WHERE owner_id='fixture-creator'")).rows;
					const references = (await input.fixture.pool.query("SELECT destination_id FROM stream_session_destinations WHERE session_id=$1", [sessionId])).rows;
					const reopened = await list("fixture-creator", runnerId);
					return {
						authenticated,
						available: true,
						first,
						second,
						firstCount: firstRows.length,
						count: rows.length,
						references: references.length,
						stable: rows.length === 1 && rows[0].id === firstRows[0]?.id && references[0]?.destination_id === rows[0].id,
						encrypted: rows.length === 1 && rows[0].encrypted_stream_key !== legacyKey && decryptString(rows[0].encrypted_stream_key) === (rekey ? "replacement-legacy-key" : legacyKey),
						credentialRevision: rows[0]?.credential_revision,
						reopened,
						safe: ![legacyKey, "replacement-legacy-key"].some((value) => JSON.stringify({ first, second, reopened }).includes(value)),
					};
				}
				const secret = "private-named-destination-stream-key";
				const saved = await save({ ownerId: "fixture-creator", runnerId, name: "My Twitch", provider: "twitch", rtmpUrl: "rtmp://live.twitch.tv/app", credentialAction: "replace", streamKey: secret });
				if (!saved.success) return { authenticated, available: true, saved };
				const destinationId = saved.destination.id;
				const before = (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [destinationId])).rows[0];
				let attempted: unknown;
				const variant = input.variant.replace("destinations_", "");
				if (variant === "persisted_control_url") {
					await input.fixture.pool.query("UPDATE runner_destinations SET rtmp_url=$2 WHERE id=$1", [destinationId, "rtmp://127.0.0.1/li\nve"]);
					const before = (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [destinationId])).rows[0];
					const attempted = await save({ ownerId: "fixture-creator", runnerId, id: destinationId, expectedRevision: 1, name: "Rejected edit", provider: "twitch", credentialAction: "keep" });
					const after = (await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [destinationId])).rows[0];
					return { authenticated, attempted, unchanged: JSON.stringify(before) === JSON.stringify(after), credentialPreserved: Boolean(after.encrypted_stream_key) && after.encrypted_stream_key === before.encrypted_stream_key && after.encrypted_stream_key !== secret, revision: after.configuration_revision, safe: !JSON.stringify(attempted).includes(secret) };
				}

				const remove = Reflect.get(actions, "deleteRunnerDestination");
				if (variant.startsWith("delete") && typeof remove !== "function") return { authenticated, available: true, deleteAvailable: false };
				let clearSessionId: string | undefined;
				if (variant === "clear" || variant === "clear_metadata" || variant === "delete_referenced") {
					const overlayId = randomUUID();
					clearSessionId = randomUUID();
					await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','destination-source-secret','Destination source','active','Featured')", [overlayId]);
					const { encryptString } = await import("@/app/lib/encryption");
					await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,rtmp_url,encrypted_stream_key) VALUES($1,'fixture-creator',$2,$3,'24/7','rtmp://live.twitch.tv/app',$4)", [clearSessionId, runnerId, overlayId, encryptString(secret)]);
					await input.fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,'fixture-creator',0)", [clearSessionId, destinationId]);
				}
				const update = { ownerId: "fixture-creator", runnerId, id: destinationId, expectedRevision: 1, name: "My Twitch", provider: "twitch", rtmpUrl: "rtmp://live.twitch.tv/app", credentialAction: "keep" } as const;
				if (variant === "validation_matrix") {
					const invalidInputs = [
						["missing revision", { ...update, expectedRevision: undefined }],
						["invalid owner", { ...update, ownerId: "bad.owner" }],
						["unknown destination", { ...update, id: randomUUID() }],
						["stale revision", { ...update, expectedRevision: 2 }],
						["foreign runner", { ...update, runnerId: randomUUID() }],
						["malformed URL", { ...update, rtmpUrl: "not a URL" }],
						["control character URL", { ...update, rtmpUrl: "rtmp://127.0.0.1/live\n" }],
						["fragment URL", { ...update, rtmpUrl: "rtmp://127.0.0.1/live#fragment" }],
						["key supplied with keep", { ...update, streamKey: "must-not-implicitly-replace" }],
						["missing replacement key", { ...update, credentialAction: "replace", streamKey: " " }],
						["control character key", { ...update, credentialAction: "replace", streamKey: "private\nkey" }],
						["new provider without key", { ownerId: "fixture-creator", runnerId, name: "Missing key", provider: "youtube", rtmpUrl: "rtmp://a.rtmp.youtube.com/live2", credentialAction: "clear" }],
						["duplicate name", { ownerId: "fixture-creator", runnerId, name: "my twitch", provider: "custom", rtmpUrl: "rtmp://127.0.0.1/unique", credentialAction: "clear" }],
					] as const;
					const invalid: Array<{ name: string; success: boolean; code?: string }> = [];
					for (const [name, request] of invalidInputs) {
						const response = await save(request);
						invalid.push({ name, success: response.success, code: "code" in response ? response.code : undefined });
					}
					const reads = [await list("bad.owner"), await list("fixture-creator", randomUUID())];
					const removals = [await remove({ ownerId: "fixture-creator", id: "invalid", expectedRevision: 1 }), await remove({ ownerId: "fixture-creator", id: randomUUID(), expectedRevision: 1 })];
					const global = await save({ ownerId: "fixture-creator", name: "Global custom", provider: "custom", rtmpUrl: "rtmp://127.0.0.1:1941/global", credentialAction: "clear" });
					const globalEdit = global.success ? await save({ ownerId: "fixture-creator", id: global.destination.id, expectedRevision: 1, name: "Renamed global", provider: "custom", credentialAction: "keep" }) : global;
					const all = await list("fixture-creator");
					const scoped = await list("fixture-creator", runnerId);
					return { authenticated, invalid, reads, removals, global, globalEdit, all, scoped, unchanged: JSON.stringify(before) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [destinationId])).rows[0]), safe: ![secret, deviceToken].some((value) => JSON.stringify({ invalid, reads, removals, global, globalEdit, all, scoped }).includes(value)) };
				}

				if (variant === "invalid_url") attempted = await save({ ...update, rtmpUrl: "https://example.invalid/not-rtmp" });
				if (variant === "missing_youtube" || variant === "missing_twitch") attempted = await save({ ...update, provider: variant.endsWith("youtube") ? "youtube" : "twitch", rtmpUrl: variant.endsWith("youtube") ? "rtmp://a.rtmp.youtube.com/live2" : update.rtmpUrl, credentialAction: "replace", streamKey: "" });
				if (variant === "duplicate") attempted = await save({ ...update, id: undefined, expectedRevision: undefined, name: "Duplicate", credentialAction: "replace", streamKey: secret });
				if (variant === "keep" || variant === "replace" || variant === "clear") attempted = await save({ ...update, credentialAction: variant, ...(variant === "replace" ? { streamKey: "replacement-named-stream-key" } : {}) });
				if (variant === "clear_metadata") {
					const cleared = await save({ ...update, credentialAction: "clear" });
					if (!cleared.success) throw new Error("CLEAR_METADATA_FIXTURE_FAILED");
					attempted = await save({ ...update, expectedRevision: 2, name: "Renamed without key", credentialAction: "keep" });
				}

				if (variant.startsWith("delete")) attempted = await remove({ ownerId: "fixture-creator", id: destinationId, expectedRevision: variant === "delete_stale" ? 2 : 1 });
				if (variant.startsWith("bound_")) attempted = await save({ ownerId: "fixture-creator", runnerId, name: "x".repeat(Number(variant.slice(6))), provider: "custom", rtmpUrl: "rtmp://127.0.0.1:1940/local", credentialAction: "clear" });
				if (variant === "rollback") {
					// A real transaction fault after the attempted row mutation must preserve prior data.
					await input.fixture.pool.query("CREATE FUNCTION destination_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled destination transaction failure'; END $$");
					await input.fixture.pool.query("CREATE TRIGGER destination_test_failure AFTER UPDATE ON runner_destinations FOR EACH ROW EXECUTE FUNCTION destination_test_failure()");
					try {
						attempted = await save({ ...update, name: "Must roll back", credentialAction: "replace", streamKey: "must-not-persist" });
					} finally {
						await input.fixture.pool.query("DROP TRIGGER destination_test_failure ON runner_destinations");
					}
				}
				let foreignReadsDenied: boolean | undefined;
				if (variant === "foreign") {
					const fc = await import("fast-check");
					foreignReadsDenied = true;
					await fc.assert(
						fc.asyncProperty(fc.uuid(), async (foreignId) => {
							const denied = await list(foreignId, runnerId);
							if (denied.success !== false || JSON.stringify(denied).includes(secret) || JSON.stringify(denied).includes(destinationId)) foreignReadsDenied = false;
							return denied.success === false && !JSON.stringify(denied).includes(secret) && !JSON.stringify(denied).includes(destinationId);
						}),
						{ seed: 41971, numRuns: 20 },
					);
				}
				const reopened = await list("fixture-creator", runnerId);
				let clearedStart: unknown;
				if (clearSessionId && (variant === "clear" || variant === "clear_metadata")) {
					const { call } = await (await import("./runner-free-pro-probe")).runRunnerFreeProProbe(input);
					clearedStart = await call("control_stream_session", { sessionId: clearSessionId, expectedRevision: 1, state: "running" });
				}
				const rows = await input.fixture.pool.query("SELECT id,name,encrypted_stream_key,credential_revision,configuration_revision FROM runner_destinations WHERE owner_id='fixture-creator'");
				const { decryptString } = await import("@/app/lib/encryption");
				return {
					authenticated,
					available: true,
					deleteAvailable: typeof remove === "function",
					sessionReferences: Number((await input.fixture.pool.query("SELECT count(*) FROM stream_session_destinations WHERE destination_id=$1", [destinationId])).rows[0].count),
					attempted,
					clearedStart,
					foreignReadsDenied,
					unchanged: JSON.stringify(before) === JSON.stringify((await input.fixture.pool.query("SELECT * FROM runner_destinations WHERE id=$1", [destinationId])).rows[0]),
					saved,
					reopened,
					stored: rows.rows.map((row) => ({ id: row.id, name: row.name, credentialRevision: row.credential_revision, configurationRevision: row.configuration_revision, encrypted: row.encrypted_stream_key !== secret && decryptString(row.encrypted_stream_key) === secret, replacementEncrypted: decryptString(row.encrypted_stream_key) === "replacement-named-stream-key", cleared: row.encrypted_stream_key === null })),
					safe: ![secret, "replacement-named-stream-key", deviceToken].some((value) => JSON.stringify({ saved, reopened, attempted, clearedStart }).includes(value)),
				};
			}),
		);
	} finally {
		globalThis.fetch = previousFetch;
	}
}
