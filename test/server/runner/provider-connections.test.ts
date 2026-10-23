/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { beginStreamingConnection, consumeStreamingState } from "@/server/runner/provider-connections";
import { user as authUser, session as authSession } from "@/db/auth-schema";
import { randomUUID } from "node:crypto";
import { encryptString } from "@/app/lib/encryption";
import { usersTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
jest.mock("@/server/provider-credentials", () => ({ withSerializedProviderCredential: jest.fn(async (_pool: unknown, _id: string, run: () => Promise<unknown>) => run()) }));
jest.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=fixture" }) }));
jest.mock("@/auth/config", () => ({
	auth: {
		api: {
			linkSocialAccount: jest.fn(async ({ body }: { body: { callbackURL: string } }) => ({ url: `https://provider.invalid/authorize?state=${new URL(body.callbackURL).searchParams.get("intent")}` })),
			getAccessToken: jest.fn(async () => ({ accessToken: "connected-access" })),
		},
	},
}));
jest.mock("@/server/resources/mutation", () => ({
	authorizeLockedMutation: jest.fn(async (_p: unknown, owner: string) => {
		if (owner !== "provider-owner") throw new Error("ACCESS_DENIED");
		return { creator: { id: owner, plan: "pro" }, assertAuthorityCurrent: () => {} };
	}),
}));
const principal: TrustedCreatorPrincipal = { kind: "session", authUserId: "auth-user", sessionId: "session-a", authenticatedAt: new Date() };
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(authUser).values({ id: "auth-user", name: "Provider", email: "auth@example.invalid" });
	await fixture.db.insert(authSession).values({ id: "session-a", userId: "auth-user", token: "test-session", expiresAt: new Date(Date.now() + 3600000) });
	await fixture.db.insert(usersTable).values({ id: "provider-owner", username: "provider", email: "provider@example.invalid", avatar: "", role: "user", plan: "free" } as typeof usersTable.$inferInsert);
	process.env.TWITCH_CLIENT_ID = "test-client";
	process.env.TWITCH_CLIENT_SECRET = "test-secret";
	const connection = randomUUID(),
		target = randomUUID(),
		runner = randomUUID(),
		overlay = randomUUID(),
		session = randomUUID(),
		event = randomUUID();
	await fixture.pool.query("INSERT INTO runner_provider_connections(id,owner_id,provider,channel_id,channel_name,encrypted_tokens) VALUES($1,'provider-owner','twitch','42','DanniCraft',$2)", [connection, encryptString(JSON.stringify({ accessToken: "access", refreshToken: "refresh", expiresAt: Date.now() + 3600000 }))]);
	await fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,encrypted_stream_key,connection_id) VALUES($1,'provider-owner','Existing Twitch','twitch','rtmp://live.twitch.tv/app',$2,$3)", [target, encryptString("fixture-existing-key"), connection]);
	await fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'provider-owner','Home PC',$2)", [runner, randomUUID()]);
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'provider-owner','source-secret','Source','active','Featured')", [overlay]);
	await fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,'provider-owner',$2,$3,'24/7','scheduled')", [session, runner, overlay]);
	await fixture.pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,'provider-owner',0)", [session, target]);
	await fixture.pool.query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time,set_stream_details,stream_details) VALUES($1,'provider-owner',$2,$3,$4,'Vacation','Europe/Berlin','once','2027-02-01','2027-02-01','2027-02-01','12:00','13:00',true,$5)", [event, runner, session, overlay, JSON.stringify([{ destinationId: target }])]);
	await fixture.pool.query("INSERT INTO runner_schedule_event_destinations(event_id,owner_id,destination_id,position) VALUES($1,'provider-owner',$2,0)", [event, target]);
}, 30000);
const nativeFetch = global.fetch;
afterEach(async () => {
	global.fetch = nativeFetch;
	jest.clearAllMocks();
	await fixture?.close();
}, 30000);
test("PC-1/6 one-use state is session-bound and wrong-session attempts do not consume it", async () => {
	const begun = await beginStreamingConnection(principal, { ownerId: "provider-owner", provider: "twitch" }, fixture.db);
	expect(begun.success).toBe(true);
	if (!begun.success) return;
	const nonce = new URL(begun.url).searchParams.get("state")!;
	expect(await consumeStreamingState({ ...principal, sessionId: "other" }, "twitch", nonce, fixture.db)).toBeNull();
	expect(await consumeStreamingState(principal, "youtube", nonce, fixture.db)).toBeNull();
	expect(await consumeStreamingState(principal, "twitch", nonce, fixture.db)).toMatchObject({ ownerId: "provider-owner" });
	expect(await consumeStreamingState(principal, "twitch", nonce, fixture.db)).toBeNull();
});
test("PC-6 unauthorized connection creates no state", async () => {
	await expect(beginStreamingConnection(principal, { ownerId: "foreign", provider: "twitch" }, fixture.db)).rejects.toThrow("ACCESS_DENIED");
});
test("PC-6 expired state cannot be exchanged", async () => {
	const begun = await beginStreamingConnection(principal, { ownerId: "provider-owner", provider: "twitch" }, fixture.db, () => 0);
	expect(begun.success).toBe(true);
	if (!begun.success) return;
	expect(await consumeStreamingState(principal, "twitch", new URL(begun.url).searchParams.get("state")!, fixture.db)).toBeNull();
});
test("PC-2 saves a connected destination with encrypted credentials and fixed Twitch ingest", async () => {
	const { runnerProviderConnectionsTable } = await import("@/db/schema");
	const { encryptString } = await import("@/app/lib/encryption");
	const originalFetch = global.fetch;
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ stream_key: "private-stream-key" }] }), { headers: { "content-type": "application/json" } }));
	const [connection] = await fixture.db
		.insert(runnerProviderConnectionsTable)
		.values({ ownerId: "provider-owner", provider: "twitch", channelId: "88", channelName: "DanniCraft", encryptedTokens: encryptString(JSON.stringify({ accessToken: "access", refreshToken: "refresh", expiresAt: Date.now() + 3600000 })) })
		.returning();
	const { saveRunnerDestinationForPrincipal } = await import("@/server/runner/destinations");
	const foreignEndpoint = await saveRunnerDestinationForPrincipal(principal, { ownerId: "provider-owner", name: "Connected Twitch", provider: "twitch", rtmpUrl: "rtmp://evil.example/app", connectionId: connection.id }, fixture.db);
	expect(foreignEndpoint).toMatchObject({ success: false, code: "INVALID_INPUT" });
	const saved = await saveRunnerDestinationForPrincipal(principal, { ownerId: "provider-owner", name: "Connected Twitch", provider: "twitch", connectionId: connection.id }, fixture.db);
	expect(saved).toMatchObject({ success: true, destination: { connectionId: connection.id, host: "live.twitch.tv", credentialConfigured: true } });
	expect(JSON.stringify(saved)).not.toContain("private-stream-key");
	expect(JSON.stringify(saved)).not.toContain("access");
	global.fetch = originalFetch;
});
test("PC-3/4 event stores enabled details and rejects settings for an unselected destination", async () => {
	const { randomUUID } = await import("node:crypto");
	const { saveRunnerScheduleEventForPrincipal } = await import("@/server/runner/schedules");
	const runner = randomUUID(),
		overlay = randomUUID(),
		session = randomUUID();
	await fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'provider-owner','Home PC',$2)", [runner, randomUUID()]);
	await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'provider-owner','source-secret','Source','active','Featured')", [overlay]);
	await fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,'provider-owner',$2,$3,'24/7','scheduled')", [session, runner, overlay]);
	const target = (await fixture.pool.query("SELECT id FROM runner_destinations WHERE owner_id='provider-owner' LIMIT 1")).rows[0].id;
	const input = { ownerId: "provider-owner", runnerId: runner, sessionId: session, overlayId: overlay, title: "Vacation", timezone: "Europe/Berlin", recurrence: "once", localStartDate: "2027-02-01", localEndDate: "2027-02-01", localStartTime: "12:00", localEndTime: "13:00", destinationIds: [target], setStreamDetails: true, streamDetails: [{ destinationId: target, title: "", categoryId: "509658", categoryName: "Just Chatting" }] };
	const saved = await saveRunnerScheduleEventForPrincipal(principal, input, fixture.db);
	expect(saved).toMatchObject({ success: true, event: { setStreamDetails: true, streamDetails: [{ destinationId: target, title: "", categoryId: "509658", categoryName: "Just Chatting" }] } });
	const denied = await saveRunnerScheduleEventForPrincipal(principal, { ...input, localStartDate: "2027-02-02", localEndDate: "2027-02-02", streamDetails: [{ destinationId: randomUUID(), title: "wrong" }] }, fixture.db);
	expect(denied).toMatchObject({ success: false, code: "INVALID_INPUT" });
});
test("PC-4 applies only due captured details, once per destination and occurrence", async () => {
	const { randomUUID } = await import("node:crypto");
	const { applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const runner = (await fixture.pool.query("SELECT id,token FROM runners WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	const connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	const target = (await fixture.pool.query("SELECT id FROM runner_destinations WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='provider-owner'");
	const event = (await fixture.pool.query("SELECT id,configuration_revision FROM runner_schedule_events WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	const snapshot = [{ destinationId: target.id, connectionId: connection.id, provider: "twitch", title: "Vacation" }];
	const admission = randomUUID();
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,execution_generation,configuration_revision,state,benefits_at_start,scheduled_end) VALUES($1,'provider-owner',$2,$3,1,'authorized',$4,$5)", [admission, runner.id, randomUUID(), JSON.stringify({ scheduledStart: Date.now() - 1000, scheduleEventId: event.id, scheduleEventRevision: event.configuration_revision, streamDetailsAtStart: snapshot }), new Date(Date.now() + 3600000)]);
	const original = global.fetch;
	const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
	global.fetch = fetcher;
	try {
		await applyRunnerBroadcastDetails({ id: runner.id, ownerId: "provider-owner", token: "wrong" }, fixture.db);
		expect(fetcher).not.toHaveBeenCalled();
		await applyRunnerBroadcastDetails({ ...runner, ownerId: "provider-owner" }, fixture.db);
		await applyRunnerBroadcastDetails({ ...runner, ownerId: "provider-owner" }, fixture.db);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ title: "Vacation" });
		const stored = (await fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [admission])).rows[0].benefits_at_start;
		expect(stored.streamDetailsResults[target.id].status).toBe("applied");
	} finally {
		global.fetch = original;
	}
});
test("PC-5 Twitch test captures only a bandwidth-test key and starts its duration after output is streaming", async () => {
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	const connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped'");
	await fixture.pool.query("UPDATE runners SET status='online',last_heartbeat_at=now(),protocol_version=2 WHERE id=$1", [runner.id]);
	const original = global.fetch;
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ stream_key: "live_private" }] })));
	try {
		const result = await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 60 }, fixture.db);
		expect(result).toMatchObject({ success: true, test: { id: expect.any(String), expiresAt: expect.any(String) } });
		expect(JSON.stringify(result)).not.toContain("live_private");
		if (!result.success) return;
		const row = (await fixture.pool.query("SELECT encrypted_targets_snapshot,benefits_at_start FROM runner_broadcast_admissions WHERE session_id=$1", [result.test.id])).rows[0];
		const { decryptString } = await import("@/app/lib/encryption");
		const captured = JSON.parse(decryptString(row.encrypted_targets_snapshot)!);
		expect(captured.destinations).toHaveLength(1);
		expect(captured.destinations[0].rtmpUrl).toBe("rtmp://live.twitch.tv/app");
		expect(captured.destinations[0].streamKey).toBe("live_private?bandwidthtest=true");
		expect(row.benefits_at_start.runnerPro).toBe(false);
		expect(row.benefits_at_start.testDurationSeconds).toBe(60);
		expect(Date.parse(result.test.expiresAt)).toBeGreaterThan(Date.now() + 4 * 60_000);
		const { generateKeyPairSync, randomUUID } = await import("node:crypto");
		const { privateKey } = generateKeyPairSync("ed25519");
		process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
		const { issueFreeExecutionLease, acknowledgeFreeExecutions } = await import("@/server/runner/lease");
		const runnerRow = (await fixture.pool.query("SELECT token FROM runners WHERE id=$1", [runner.id])).rows[0];
		const lease = await issueFreeExecutionLease({ id: runner.id, ownerId: "provider-owner", token: runnerRow.token }, result.test.id, randomUUID(), fixture.db);
		expect(lease?.lease).toBeDefined();
		const claims = JSON.parse(Buffer.from(lease!.lease!.payload, "base64url").toString());
		expect(claims.expiresAt).toBeLessThanOrEqual(Date.parse(result.test.expiresAt));
		const streamingAt = Date.now() + 1000;
		const acknowledgment = {
			admissionId: lease!.admissionId,
			sessionId: result.test.id,
			executionGeneration: lease!.executionGeneration,
			leaseId: claims.leaseId,
			configurationRevision: lease!.configurationRevision,
			state: "active" as const,
			outputs: [{ id: captured.destinations[0].id, state: "streaming" as const }],
		};
		expect(await acknowledgeFreeExecutions({ id: runner.id, ownerId: "provider-owner", token: runnerRow.token }, [acknowledgment], fixture.db, () => streamingAt)).toHaveLength(1);
		const started = (await fixture.pool.query("SELECT s.test_expires_at,a.scheduled_end,a.benefits_at_start FROM stream_sessions s JOIN runner_broadcast_admissions a ON a.session_id=s.id WHERE s.id=$1", [result.test.id])).rows[0];
		expect(started.test_expires_at.getTime()).toBe(streamingAt + 60_000);
		expect(started.scheduled_end.getTime()).toBe(streamingAt + 60_000);
		expect(started.benefits_at_start.testStartedAt).toBe(streamingAt);
		await acknowledgeFreeExecutions({ id: runner.id, ownerId: "provider-owner", token: runnerRow.token }, [acknowledgment], fixture.db, () => streamingAt + 10_000);
		const unchanged = (await fixture.pool.query("SELECT test_expires_at FROM stream_sessions WHERE id=$1", [result.test.id])).rows[0];
		expect(unchanged.test_expires_at.getTime()).toBe(streamingAt + 60_000);
	} finally {
		global.fetch = original;
	}
});
test("PC-6 token rotation survives an expected downstream provider denial", async () => {
	const { runnerProviderConnectionsTable } = await import("@/db/schema");
	const { encryptString, decryptString } = await import("@/app/lib/encryption");
	const { eq } = await import("drizzle-orm");
	const connection = (await fixture.db.select().from(runnerProviderConnectionsTable).limit(1))[0];
	await fixture.db
		.update(runnerProviderConnectionsTable)
		.set({ encryptedTokens: encryptString(JSON.stringify({ accessToken: "expired", refreshToken: "old-refresh", expiresAt: 0 })) })
		.where(eq(runnerProviderConnectionsTable.id, connection.id));
	const original = global.fetch;
	global.fetch = jest
		.fn()
		.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 })))
		.mockResolvedValueOnce(new Response("{}", { status: 401 }));
	try {
		const { saveRunnerDestinationForPrincipal } = await import("@/server/runner/destinations");
		const saved = await saveRunnerDestinationForPrincipal(principal, { ownerId: "provider-owner", name: "Denied channel", provider: "twitch", connectionId: connection.id }, fixture.db);
		expect(saved).toMatchObject({ success: false, code: "RECONNECT_REQUIRED" });
		const row = (await fixture.db.select().from(runnerProviderConnectionsTable).where(eq(runnerProviderConnectionsTable.id, connection.id)))[0];
		expect(JSON.parse(decryptString(row.encryptedTokens)!)).toMatchObject({ accessToken: "new-access", refreshToken: "new-refresh" });
	} finally {
		global.fetch = original;
	}
});
test("PC-5 expired tests that never received a lease release their reservation without inventing output closure", async () => {
	const { randomUUID } = await import("node:crypto");
	const { expireRunnerConnectionTests } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	const source = (await fixture.pool.query("SELECT overlay_id FROM stream_sessions WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	const id = randomUUID(),
		admission = randomUUID();
	await fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,test_expires_at,desired_state) VALUES($1,'provider-owner',$2,$3,'24/7',now()-interval '1 minute','running')", [id, runner.id, source.overlay_id]);
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,state,configuration_revision,scheduled_end,benefits_at_start) VALUES($1,'provider-owner',$2,$3,$4,'reserved',1,now()-interval '1 minute',$5)", [admission, runner.id, id, randomUUID(), JSON.stringify({ runnerPro: false, testConnectionId: randomUUID() })]);
	await expireRunnerConnectionTests(runner.id, fixture.db);
	expect((await fixture.pool.query("SELECT state,dispatched_at FROM runner_broadcast_admissions WHERE id=$1", [admission])).rows[0]).toMatchObject({ state: "failed_before_output", dispatched_at: null });
	expect((await fixture.pool.query("SELECT desired_state FROM stream_sessions WHERE id=$1", [id])).rows[0].desired_state).toBe("stopped");
});
test("PC-5 an expired dispatched test drains without releasing its occupied output", async () => {
	const { expireRunnerConnectionTests } = await import("@/server/runner/provider-test");
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id,token FROM runners LIMIT 1")).rows[0];
	const connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runners SET status='online',last_heartbeat_at=now(),protocol_version=2 WHERE id=$1", [runner.id]);
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ stream_key: "live_private" }] })));
	const started = await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 60 }, fixture.db);
	expect(started.success).toBe(true);
	if (!started.success) return;
	const { generateKeyPairSync } = await import("node:crypto");
	const { privateKey } = generateKeyPairSync("ed25519");
	process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
	const { issueFreeExecutionLease } = await import("@/server/runner/lease");
	await issueFreeExecutionLease({ id: runner.id, ownerId: "provider-owner", token: runner.token }, started.test.id, randomUUID(), fixture.db);

	const row = (await fixture.pool.query("SELECT a.id,a.session_id,a.runner_id,a.execution_generation FROM runner_broadcast_admissions a JOIN stream_sessions s ON s.id=a.session_id WHERE s.test_expires_at IS NOT NULL AND a.dispatched_at IS NOT NULL LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE stream_sessions SET test_expires_at=now()-interval '1 minute',desired_state='running' WHERE id=$1", [row.session_id]);
	await expireRunnerConnectionTests(row.runner_id, fixture.db);
	expect((await fixture.pool.query("SELECT state,execution_generation,stopped_at FROM runner_broadcast_admissions WHERE id=$1", [row.id])).rows[0]).toEqual({ state: "draining", execution_generation: row.execution_generation, stopped_at: null });
});
test("PC-5 a new Free admission can recover an expired test that never dispatched, without the old PC reconnecting", async () => {
	const { randomUUID } = await import("node:crypto");
	const { reserveBroadcastAdmission } = await import("@/server/runner/admission");
	const { streamSessionsTable } = await import("@/db/schema");
	const { isNull } = await import("drizzle-orm");
	await fixture.pool.query("UPDATE runner_broadcast_admissions SET state='stopped'");
	await fixture.pool.query("UPDATE stream_sessions SET desired_state='stopped',actual_state='stopped'");
	const session = (await fixture.db.select().from(streamSessionsTable).where(isNull(streamSessionsTable.testExpiresAt)).limit(1))[0];
	const old = randomUUID(),
		admission = randomUUID();
	await fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,test_expires_at,desired_state) VALUES($1,'provider-owner',$2,$3,'24/7',now()-interval '1 minute','running')", [old, session.runnerId, session.overlayId]);
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,state,configuration_revision,scheduled_end,benefits_at_start) VALUES($1,'provider-owner',$2,$3,$4,'reserved',1,now()-interval '1 minute',$5)", [admission, session.runnerId, old, randomUUID(), JSON.stringify({ runnerPro: false, testConnectionId: randomUUID() })]);
	const reserved = await fixture.db.transaction((tx) => reserveBroadcastAdmission(tx, session, { proAccess: false }, session.configurationRevision));
	expect(reserved).toMatchObject({ state: "reserved", sessionId: session.id });
	expect((await fixture.pool.query("SELECT state FROM runner_broadcast_admissions WHERE id=$1", [admission])).rows[0].state).toBe("failed_before_output");
});
test("PC-4 removing a standby image does not delete the same owned image from a scheduled thumbnail", async () => {
	const { randomUUID } = await import("node:crypto");
	const { saveRunnerBrandingProfileForPrincipal } = await import("@/server/runner/branding-profiles");
	const asset = randomUUID();
	const runner = (await fixture.pool.query("SELECT id FROM runners WHERE owner_id='provider-owner' LIMIT 1")).rows[0];
	await fixture.pool.query("INSERT INTO runner_branding_assets(id,owner_id,kind,normalized_mime,size_bytes,width,height,checksum,bytes) VALUES($1,'provider-owner','background','image/png',1,1,1,'fixture',decode('00','hex'))", [asset]);
	await fixture.pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,background_asset_id) VALUES('provider-owner',$1,$2)", [runner.id, asset]);
	// Retained calendar metadata must pin image bytes independently of standby presentation.
	await fixture.pool.query("UPDATE runner_schedule_events SET stream_details=$1 WHERE owner_id='provider-owner'", [JSON.stringify([{ destinationId: randomUUID(), thumbnailAssetId: asset }])]);
	const changed = await saveRunnerBrandingProfileForPrincipal(principal, { ownerId: "provider-owner", runnerId: runner.id, expectedRevision: 1, watermarkCorner: "bottom_right", backgroundAssetId: null }, fixture.db);
	expect(changed).toMatchObject({ success: true });
	expect((await fixture.pool.query("SELECT id FROM runner_branding_assets WHERE id=$1", [asset])).rowCount).toBe(1);
});
async function beginGrant(provider: "twitch" | "youtube" = "twitch") {
	const result = await beginStreamingConnection(principal, { ownerId: "provider-owner", provider }, fixture.db);
	expect(result.success).toBe(true);
	if (!result.success) throw new Error("Fixture consent could not start");
	return new URL(result.url).searchParams.get("state")!;
}
async function linkedGrant(provider: "twitch" | "youtube" = "twitch", refreshToken: string | null = "encrypted-refresh") {
	const { account } = await import("@/db/auth-schema");
	const row = { id: randomUUID(), userId: "auth-user", providerId: provider === "youtube" ? "google" : "twitch", accountId: "provider-subject", accessToken: "encrypted-access", refreshToken, scope: provider === "twitch" ? "channel:read:stream_key,channel:manage:broadcast" : "https://www.googleapis.com/auth/youtube.force-ssl" };
	await fixture.db.insert(account).values(row);
	return row;
}
test("PC-1/2 Better Auth stores the grant once and Runner references the exact linked account", async () => {
	const { recordStreamingAccount, completeStreamingConnection } = await import("@/server/runner/provider-connections");
	const { decryptString } = await import("@/app/lib/encryption");
	const nonce = await beginGrant();
	const account = await linkedGrant();
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "42", display_name: "Connected channel" }] })));
	await recordStreamingAccount(account, nonce, fixture.db);
	const result = await completeStreamingConnection(principal, "twitch", nonce, fixture.db);
	expect(result).toMatchObject({ success: true, connection: { provider: "twitch", channelName: "Connected channel" } });
	const rows = (await fixture.pool.query("SELECT encrypted_tokens FROM runner_provider_connections WHERE channel_id='42'")).rows;
	expect(JSON.parse(decryptString(rows[0].encrypted_tokens)!)).toEqual({ authAccountId: account.id, authUserId: "auth-user" });
	expect(JSON.stringify(result)).not.toContain("connected-access");
	expect(await completeStreamingConnection(principal, "twitch", nonce, fixture.db)).toMatchObject({ success: false });
});
test("PC-6 a new connection cannot save an unusable grant without offline access", async () => {
	const { recordStreamingAccount } = await import("@/server/runner/provider-connections");
	const nonce = await beginGrant();
	const account = await linkedGrant("twitch", null);
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "99", display_name: "No offline access" }] })));
	await expect(recordStreamingAccount(account, nonce, fixture.db)).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
	expect((await fixture.pool.query("SELECT id FROM runner_provider_connections WHERE channel_id='99'")).rowCount).toBe(0);
});
test("PC-6 invalid and incomplete connection requests do not contact a provider", async () => {
	const { completeStreamingConnection } = await import("@/server/runner/provider-connections");
	global.fetch = jest.fn();
	expect(await beginStreamingConnection(principal, { ownerId: "provider-owner", provider: "custom" }, fixture.db)).toMatchObject({ success: false });
	expect(await beginStreamingConnection({ ...principal, sessionId: undefined }, { ownerId: "provider-owner", provider: "twitch" }, fixture.db)).toMatchObject({ success: false });
	expect(await beginStreamingConnection({ ...principal, kind: "oauth" }, { ownerId: "provider-owner", provider: "twitch" }, fixture.db)).toMatchObject({ success: false });
	expect(await consumeStreamingState({ ...principal, kind: "oauth" }, "twitch", "invalid", fixture.db)).toBeNull();
	expect(await consumeStreamingState({ ...principal, sessionId: undefined }, "twitch", "invalid", fixture.db)).toBeNull();
	expect(await completeStreamingConnection(principal, "twitch", "invalid", fixture.db)).toMatchObject({ success: false });
	const state = await beginGrant();
	expect(await completeStreamingConnection(principal, "twitch", state, fixture.db)).toMatchObject({ success: false });
	const other = await beginGrant();
	expect(await completeStreamingConnection(principal, "twitch", other, fixture.db)).toMatchObject({ success: false });
	expect(global.fetch).not.toHaveBeenCalled();
});
test("PC-6 missing provider configuration keeps the manual-key path available", async () => {
	const { streamingProviderConfiguration, completeStreamingConnection } = await import("@/server/runner/provider-connections");
	const previousId = process.env.YOUTUBE_CLIENT_ID,
		previousSecret = process.env.YOUTUBE_CLIENT_SECRET;
	try {
		delete process.env.YOUTUBE_CLIENT_ID;
		delete process.env.YOUTUBE_CLIENT_SECRET;
		expect(streamingProviderConfiguration("youtube")).toBeNull();
		expect(await beginStreamingConnection(principal, { ownerId: "provider-owner", provider: "youtube" }, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("stream key") });
		process.env.YOUTUBE_CLIENT_ID = "client";
		process.env.YOUTUBE_CLIENT_SECRET = "secret";
		const nonce = await beginGrant("youtube");
		delete process.env.YOUTUBE_CLIENT_SECRET;
		expect(await completeStreamingConnection(principal, "youtube", nonce, fixture.db)).toMatchObject({ success: false });
	} finally {
		if (previousId === undefined) delete process.env.YOUTUBE_CLIENT_ID;
		else process.env.YOUTUBE_CLIENT_ID = previousId;
		if (previousSecret === undefined) delete process.env.YOUTUBE_CLIENT_SECRET;
		else process.env.YOUTUBE_CLIENT_SECRET = previousSecret;
	}
});
test("PC-2 account-wide connection views expose identity without token storage", async () => {
	const { listStreamingConnections } = await import("@/server/runner/provider-connections");
	expect(await listStreamingConnections(principal, "bad owner", fixture.db)).toMatchObject({ success: false });
	const result = await listStreamingConnections(principal, "provider-owner", fixture.db);
	expect(result).toMatchObject({ success: true, connections: [{ channelName: "DanniCraft", provider: "twitch" }] });
	expect(JSON.stringify(result)).not.toContain("encryptedTokens");
	expect(JSON.stringify(result)).not.toContain("refresh");
	await expect(listStreamingConnections(principal, "foreign", fixture.db)).rejects.toThrow("ACCESS_DENIED");
});
test.each(["missing", "corrupt", "malformed", "expired_without_refresh"])("PC-6 %s stored grants return a reconnect result without invoking the operation", async (variant) => {
	const { withStreamingConnection } = await import("@/server/runner/provider-connections");
	const row = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	if (variant !== "missing") await fixture.pool.query("UPDATE runner_provider_connections SET encrypted_tokens=$1 WHERE id=$2", [encryptString(variant === "corrupt" ? "not JSON" : variant === "malformed" ? JSON.stringify({ accessToken: "" }) : JSON.stringify({ accessToken: "expired", expiresAt: 0 })), row.id]);
	const operation = jest.fn(async () => true);
	const result = await fixture.db.transaction((tx) => withStreamingConnection(tx, "provider-owner", variant === "missing" ? randomUUID() : row.id, operation));
	expect(result).toMatchObject({ success: false, code: "RECONNECT_REQUIRED" });
	expect(operation).not.toHaveBeenCalled();
});
test("PC-6 unexpected operation failures remain unexpected, rather than becoming a false reconnect denial", async () => {
	const { withStreamingConnection } = await import("@/server/runner/provider-connections");
	const row = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await expect(
		fixture.db.transaction((tx) =>
			withStreamingConnection(tx, "provider-owner", row.id, async () => {
				throw new Error("controlled operation failure");
			}),
		),
	).rejects.toThrow("controlled operation failure");
});
test("PC-6 concurrent Runners rotate a channel token only once", async () => {
	const { withStreamingConnection } = await import("@/server/runner/provider-connections");
	const row = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runner_provider_connections SET encrypted_tokens=$1 WHERE id=$2", [encryptString(JSON.stringify({ accessToken: "expired", refreshToken: "old", expiresAt: 0 })), row.id]);
	let fetched!: () => void, release!: () => void;
	const started = new Promise<void>((resolve) => (fetched = resolve)),
		gate = new Promise<void>((resolve) => (release = resolve));
	const fetcher = jest.fn(async () => {
		fetched();
		await gate;
		return new Response(JSON.stringify({ access_token: "rotated", refresh_token: "new-refresh", expires_in: 3600 }));
	});
	global.fetch = fetcher;
	const operation = () => fixture.db.transaction((tx) => withStreamingConnection(tx, "provider-owner", row.id, async (context) => context.accessToken));
	const first = operation();
	await started;
	const second = operation();
	release();
	expect(await Promise.all([first, second])).toEqual([
		{ success: true, value: "rotated" },
		{ success: true, value: "rotated" },
	]);
	expect(fetcher).toHaveBeenCalledTimes(1);
});
async function metadataCase(extra: Record<string, unknown> = {}, patch?: Record<string, unknown>) {
	const { captureBroadcastDetails } = await import("@/server/runner/provider-metadata");
	await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='provider-owner'");
	const runner = (await fixture.pool.query("SELECT id,token FROM runners LIMIT 1")).rows[0];
	const event = (await fixture.pool.query("SELECT id,configuration_revision,session_id FROM runner_schedule_events LIMIT 1")).rows[0];
	const target = (await fixture.pool.query("SELECT id,connection_id FROM runner_destinations LIMIT 1")).rows[0];
	const snapshot = await captureBroadcastDetails(fixture.db, "provider-owner", event.id);
	const id = randomUUID(),
		occurrenceId = JSON.stringify([event.id, "fixture-occurrence"]);
	const benefits = { scheduledStart: Date.now() - 1000, scheduleEventId: event.id, scheduleEventRevision: event.configuration_revision, streamDetailsAtStart: snapshot, ...extra };
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,configuration_revision,state,occurrence_id,benefits_at_start,scheduled_end) VALUES($1,'provider-owner',$2,$3,$4,1,'authorized',$5,$6,$7)", [id, runner.id, event.session_id, randomUUID(), occurrenceId, JSON.stringify(benefits), new Date(Date.now() + 3600000)]);
	if (patch?.revoked) await fixture.pool.query("UPDATE runner_broadcast_admissions SET revoked_at=now() WHERE id=$1", [id]);
	if (patch?.ended) await fixture.pool.query("UPDATE runner_broadcast_admissions SET scheduled_end=now()-interval '1 second' WHERE id=$1", [id]);
	return { id, runner: { ...runner, ownerId: "provider-owner" }, event, target, snapshot, occurrenceId };
}
test("PC-3/4 capture resolves event defaults and safely excludes disabled, missing or unconnected metadata", async () => {
	const { captureBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const event = (await fixture.pool.query("SELECT id FROM runner_schedule_events LIMIT 1")).rows[0];
	const target = (await fixture.pool.query("SELECT id,connection_id FROM runner_destinations LIMIT 1")).rows[0];
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", event.id)).toMatchObject([{ title: "Vacation", destinationId: target.id }]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", randomUUID())).toEqual([]);
	await fixture.pool.query("UPDATE runner_schedule_events SET set_stream_details=false WHERE id=$1", [event.id]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", event.id)).toEqual([]);
	await fixture.pool.query("UPDATE runner_schedule_events SET set_stream_details=true,stream_details=$1 WHERE id=$2", [JSON.stringify([{ destinationId: "bad" }]), event.id]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", event.id)).toEqual([]);
	for (const details of [[], [{ destinationId: randomUUID() }]]) {
		await fixture.pool.query("UPDATE runner_schedule_events SET stream_details=$1 WHERE id=$2", [JSON.stringify(details), event.id]);
		expect(await captureBroadcastDetails(fixture.db, "provider-owner", event.id)).toEqual([]);
	}
	await fixture.pool.query("UPDATE runner_schedule_events SET stream_details=$1 WHERE id=$2", [JSON.stringify([{ destinationId: target.id }]), event.id]);
	await fixture.pool.query("UPDATE runner_destinations SET connection_id=NULL WHERE id=$1", [target.id]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", event.id)).toEqual([]);
	await fixture.pool.query("UPDATE runner_destinations SET provider='custom',connection_id=$1 WHERE id=$2", [target.connection_id, target.id]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", event.id)).toEqual([]);
});
test("PC-4 a protected occurrence retains its captured title while a future revision captures new details", async () => {
	const { captureBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const state = await metadataCase();
	await fixture.pool.query("UPDATE runner_schedule_events SET title='Renamed' WHERE id=$1", [state.event.id]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", state.event.id, state.occurrenceId)).toMatchObject([{ title: "Vacation" }]);
	await fixture.pool.query("UPDATE runner_schedule_events SET configuration_revision=2 WHERE id=$1", [state.event.id]);
	expect(await captureBroadcastDetails(fixture.db, "provider-owner", state.event.id, state.occurrenceId)).toMatchObject([{ title: "Renamed" }]);
});
test.each(["free", "disabled", "missing_owner", "missing_device", "revoked", "suppressed", "future", "ended", "missing_event", "invalid_event", "stale_revision", "invalid_snapshot"])("PC-4 %s authority never changes provider metadata", async (variant) => {
	const { applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const state = await metadataCase(variant === "suppressed" ? { scheduleSuppressed: true } : variant === "future" ? { scheduledStart: Date.now() + 60000 } : variant === "missing_event" ? { scheduleEventId: randomUUID() } : variant === "invalid_event" ? { scheduleEventId: 3 } : variant === "stale_revision" ? { scheduleEventRevision: 99 } : variant === "invalid_snapshot" ? { streamDetailsAtStart: [{ bad: true }] } : {}, { revoked: variant === "revoked", ended: variant === "ended" });
	if (variant === "free") await fixture.pool.query("UPDATE users SET plan='free' WHERE id='provider-owner'");
	if (variant === "disabled") await fixture.pool.query("UPDATE users SET disabled=true WHERE id='provider-owner'");
	if (variant === "missing_owner") await fixture.pool.query("DELETE FROM users WHERE id='provider-owner'");
	if (variant === "missing_device") state.runner.id = randomUUID();
	global.fetch = jest.fn();
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	expect(global.fetch).not.toHaveBeenCalled();
});
test("PC-4 retryable update failures are visible and back off before recovering", async () => {
	const { applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const state = await metadataCase();
	const now = Date.now();
	const fetcher = jest
		.fn()
		.mockResolvedValueOnce(new Response("{}", { status: 401 }))
		.mockResolvedValueOnce(new Response(null, { status: 204 }));
	global.fetch = fetcher;
	await applyRunnerBroadcastDetails(state.runner, fixture.db, () => now);
	await applyRunnerBroadcastDetails(state.runner, fixture.db, () => now + 1000);
	expect(fetcher).toHaveBeenCalledTimes(1);
	let stored = (await fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [state.id])).rows[0].benefits_at_start;
	expect(stored.streamDetailsResults[state.target.id]).toMatchObject({ status: "reconnect", error: "Reconnect this channel to continue." });
	await applyRunnerBroadcastDetails(state.runner, fixture.db, () => now + 61000);
	expect(fetcher).toHaveBeenCalledTimes(2);
	stored = (await fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [state.id])).rows[0].benefits_at_start;
	expect(stored.streamDetailsResults[state.target.id].status).toBe("applied");
});
test("PC-4 resuming the same occurrence preserves already applied details", async () => {
	const { applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const state = await metadataCase();
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,execution_generation,configuration_revision,state,occurrence_id,benefits_at_start) VALUES('provider-owner',$1,$2,1,'stopped',$3,$4)", [state.runner.id, randomUUID(), state.occurrenceId, JSON.stringify({ streamDetailsResults: { [state.target.id]: { status: "applied", attemptedAt: Date.now() } } })]);
	global.fetch = jest.fn();
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	expect(global.fetch).not.toHaveBeenCalled();
});
test("PC-4 a mismatched provider snapshot cannot use a grant for another platform", async () => {
	const { applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const state = await metadataCase();
	await fixture.pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=jsonb_set(benefits_at_start,'{streamDetailsAtStart}',$1) WHERE id=$2", [JSON.stringify([{ ...state.snapshot[0], provider: "youtube" }]), state.id]);
	global.fetch = jest.fn();
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	expect(global.fetch).not.toHaveBeenCalled();
	expect((await fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [state.id])).rows[0].benefits_at_start.streamDetailsResults[state.target.id].status).toBe("reconnect");
});
test("PC-1 YouTube uses a linked Google account without creating another Clipify identity", async () => {
	const { recordStreamingAccount, completeStreamingConnection } = await import("@/server/runner/provider-connections");
	const priorId = process.env.YOUTUBE_CLIENT_ID,
		priorSecret = process.env.YOUTUBE_CLIENT_SECRET;
	try {
		process.env.YOUTUBE_CLIENT_ID = "youtube-client";
		process.env.YOUTUBE_CLIENT_SECRET = "youtube-secret";
		const nonce = await beginGrant("youtube"),
			account = await linkedGrant("youtube");
		global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: "UCfixture", snippet: { title: "YouTube channel" } }] })));
		await recordStreamingAccount(account, nonce, fixture.db);
		expect(await completeStreamingConnection(principal, "youtube", nonce, fixture.db)).toMatchObject({ success: true, connection: { provider: "youtube", channelName: "YouTube channel" } });
		expect((await fixture.pool.query("SELECT id FROM auth.user")).rowCount).toBe(1);
		expect((await fixture.pool.query("SELECT provider_id FROM auth.account")).rows).toEqual([{ provider_id: "google" }]);
	} finally {
		if (priorId === undefined) delete process.env.YOUTUBE_CLIENT_ID;
		else process.env.YOUTUBE_CLIENT_ID = priorId;
		if (priorSecret === undefined) delete process.env.YOUTUBE_CLIENT_SECRET;
		else process.env.YOUTUBE_CLIENT_SECRET = priorSecret;
	}
});
test("PC-4 multiple selected channels finish their bounded updates on successive heartbeats", async () => {
	const { captureBroadcastDetails, applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const state = await metadataCase(),
		connection = randomUUID(),
		target = randomUUID();
	await fixture.pool.query("INSERT INTO runner_provider_connections(id,owner_id,provider,channel_id,channel_name,encrypted_tokens) VALUES($1,'provider-owner','twitch','99','Other channel',$2)", [connection, encryptString(JSON.stringify({ accessToken: "other-access", refreshToken: "other-refresh", expiresAt: Date.now() + 3600000 }))]);
	await fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,connection_id) VALUES($1,'provider-owner','Other Twitch','twitch','rtmp://live.twitch.tv/app',$2)", [target, connection]);
	await fixture.pool.query("UPDATE runner_schedule_events SET stream_details=$1 WHERE id=$2", [JSON.stringify([{ destinationId: state.target.id }, { destinationId: target }]), state.event.id]);
	const snapshot = await captureBroadcastDetails(fixture.db, "provider-owner", state.event.id);
	await fixture.pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=jsonb_set(benefits_at_start,'{streamDetailsAtStart}',$1) WHERE id=$2", [JSON.stringify(snapshot), state.id]);
	global.fetch = jest.fn().mockImplementation(async () => new Response(null, { status: 204 }));
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	expect(global.fetch).toHaveBeenCalledTimes(1);
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	expect(global.fetch).toHaveBeenCalledTimes(2);
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	expect(global.fetch).toHaveBeenCalledTimes(2);
});
test.each([true, false])("PC-4 YouTube metadata uploads only an owned thumbnail; owned=%s", async (owned) => {
	const { applyRunnerBroadcastDetails, captureBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const priorId = process.env.YOUTUBE_CLIENT_ID,
		priorSecret = process.env.YOUTUBE_CLIENT_SECRET;
	try {
		process.env.YOUTUBE_CLIENT_ID = "client";
		process.env.YOUTUBE_CLIENT_SECRET = "secret";
		const state = await metadataCase(),
			asset = randomUUID();
		await fixture.pool.query("UPDATE runner_provider_connections SET provider='youtube' WHERE id=$1", [state.target.connection_id]);
		await fixture.pool.query("UPDATE runner_destinations SET provider='youtube',provider_stream_id='fixture-stream' WHERE id=$1", [state.target.id]);
		if (owned) await fixture.pool.query("INSERT INTO runner_branding_assets(id,owner_id,kind,normalized_mime,size_bytes,width,height,checksum,bytes) VALUES($1,'provider-owner','background','image/png',1,1,1,'fixture',decode('00','hex'))", [asset]);
		await fixture.pool.query("UPDATE runner_schedule_events SET stream_details=$1 WHERE id=$2", [JSON.stringify([{ destinationId: state.target.id, thumbnailAssetId: asset }]), state.event.id]);
		const snapshot = await captureBroadcastDetails(fixture.db, "provider-owner", state.event.id);
		await fixture.pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=jsonb_set(benefits_at_start,'{streamDetailsAtStart}',$1) WHERE id=$2", [JSON.stringify(snapshot), state.id]);
		const fetcher = jest
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "video", contentDetails: { boundStreamId: "fixture-stream" }, status: { lifeCycleStatus: "ready" } }] })))
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ snippet: { title: "Old", categoryId: "20" } }] })))
			.mockResolvedValueOnce(new Response("{}"))
			.mockResolvedValueOnce(new Response("{}"));
		global.fetch = fetcher;
		await applyRunnerBroadcastDetails(state.runner, fixture.db);
		expect(fetcher).toHaveBeenCalledTimes(owned ? 4 : 3);
		const results = (await fixture.pool.query("SELECT benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [state.id])).rows[0].benefits_at_start.streamDetailsResults;
		expect(results[state.target.id].status).toBe(owned ? "applied" : "retry");
		if (owned) expect(fetcher.mock.calls[3][1].body).toEqual(new Uint8Array([0]));
	} finally {
		if (priorId === undefined) delete process.env.YOUTUBE_CLIENT_ID;
		else process.env.YOUTUBE_CLIENT_ID = priorId;
		if (priorSecret === undefined) delete process.env.YOUTUBE_CLIENT_SECRET;
		else process.env.YOUTUBE_CLIENT_SECRET = priorSecret;
	}
});
async function startPrivateTest() {
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners LIMIT 1")).rows[0],
		connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runners SET status='online',last_heartbeat_at=now(),protocol_version=2 WHERE id=$1", [runner.id]);
	global.fetch = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [{ stream_key: "live_private" }] })));
	const result = await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 30 }, fixture.db);
	expect(result.success).toBe(true);
	if (!result.success) throw new Error("Fixture test could not start");
	return { runner, connection, test: result.test };
}
test("PC-5 test status reports progress and Stop safely cancels an undispatched test", async () => {
	const { readTwitchConnectionTest, startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const state = await startPrivateTest();
	expect(await readTwitchConnectionTest(principal, { ownerId: "provider-owner", id: state.test.id }, false, fixture.db)).toMatchObject({ success: true, test: { state: "starting" } });
	expect(await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: state.runner.id, connectionId: state.connection.id, durationSeconds: 30 }, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("Stop your broadcasts") });
	expect(await readTwitchConnectionTest(principal, { ownerId: "provider-owner", id: state.test.id }, true, fixture.db)).toMatchObject({ success: true, test: { state: "stopped" } });
});
test("PC-5 test status preserves output telemetry while a dispatched test drains", async () => {
	const { readTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const state = await startPrivateTest(),
		output = randomUUID();
	await fixture.pool.query("UPDATE runner_broadcast_admissions SET state='active',dispatched_at=now(),output_states=$1 WHERE session_id=$2", [JSON.stringify([{ id: output, state: "streaming" }]), state.test.id]);
	expect(await readTwitchConnectionTest(principal, { ownerId: "provider-owner", id: state.test.id }, false, fixture.db)).toMatchObject({ success: true, test: { state: "running", outputs: [{ id: output, state: "streaming" }] } });
	expect(await readTwitchConnectionTest(principal, { ownerId: "provider-owner", id: state.test.id }, true, fixture.db)).toMatchObject({ success: true, test: { state: "stopping" } });
});
test("PC-5 reading an expired, undispatched test performs its safe automatic cancellation", async () => {
	const { readTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const state = await startPrivateTest();
	await fixture.pool.query("UPDATE stream_sessions SET test_expires_at=now()-interval '1 minute' WHERE id=$1", [state.test.id]);
	expect(await readTwitchConnectionTest(principal, { ownerId: "provider-owner", id: state.test.id }, false, fixture.db)).toMatchObject({ success: true, test: { state: "stopped" } });
});
test("PC-5 invalid or unavailable connection tests do not create any broadcast", async () => {
	const { startTwitchConnectionTest, readTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners LIMIT 1")).rows[0],
		connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	expect(await startTwitchConnectionTest(principal, { bad: true }, fixture.db)).toMatchObject({ success: false });
	expect(await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 30 }, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("Connect your Runner") });
	expect(await readTwitchConnectionTest(principal, { bad: true }, false, fixture.db)).toMatchObject({ success: false });
	expect(await readTwitchConnectionTest(principal, { ownerId: "provider-owner", id: randomUUID() }, false, fixture.db)).toMatchObject({ success: false });
	await fixture.pool.query("UPDATE runners SET status='online',last_heartbeat_at=now(),protocol_version=2 WHERE id=$1", [runner.id]);
	await fixture.pool.query("DELETE FROM stream_sessions WHERE runner_id=$1", [runner.id]);
	expect(await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 30 }, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("target overlay") });
	expect((await fixture.pool.query("SELECT id FROM runner_broadcast_admissions")).rowCount).toBe(0);
});
test("PC-6 an unavailable YouTube client does not use a stored grant", async () => {
	const { withStreamingConnection } = await import("@/server/runner/provider-connections");
	const row = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runner_provider_connections SET provider='youtube' WHERE id=$1", [row.id]);
	const previous = process.env.YOUTUBE_CLIENT_ID;
	try {
		delete process.env.YOUTUBE_CLIENT_ID;
		expect(await fixture.db.transaction((tx) => withStreamingConnection(tx, "provider-owner", row.id, async () => true))).toMatchObject({ success: false, code: "PROVIDER_UNAVAILABLE" });
	} finally {
		if (previous === undefined) delete process.env.YOUTUBE_CLIENT_ID;
		else process.env.YOUTUBE_CLIENT_ID = previous;
	}
});
test.each(["missing_runner", "missing_heartbeat", "stale_heartbeat", "old_protocol"])("PC-5 %s cannot accept a private test", async (variant) => {
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners LIMIT 1")).rows[0],
		connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runners SET status='online',protocol_version=2,last_heartbeat_at=now() WHERE id=$1", [runner.id]);
	if (variant === "missing_heartbeat") await fixture.pool.query("UPDATE runners SET last_heartbeat_at=NULL WHERE id=$1", [runner.id]);
	if (variant === "stale_heartbeat") await fixture.pool.query("UPDATE runners SET last_heartbeat_at=now()-interval '31 seconds' WHERE id=$1", [runner.id]);
	if (variant === "old_protocol") await fixture.pool.query("UPDATE runners SET protocol_version=1 WHERE id=$1", [runner.id]);
	expect(await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: variant === "missing_runner" ? randomUUID() : runner.id, connectionId: connection.id, durationSeconds: 30 }, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("Connect your Runner") });
});
test("PC-5 an unrelated orphaned admission does not block this Runner's connection test", async () => {
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners LIMIT 1")).rows[0],
		connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runners SET status='online',protocol_version=2,last_heartbeat_at=now() WHERE id=$1", [runner.id]);
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,execution_generation,configuration_revision,state,benefits_at_start) VALUES('provider-owner',NULL,$1,1,'uncertain',$2)", [randomUUID(), JSON.stringify({ provenance: "pre_admission_protocol" })]);
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ stream_key: "live_private" }] })));
	expect(await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 30 }, fixture.db)).toMatchObject({ success: true });
});
test.each(["past", "during_test", "unknown_start", "after_test"])("PC-5 scheduled authority %s respects the test window", async (variant) => {
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners LIMIT 1")).rows[0],
		connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runners SET status='online',protocol_version=2,last_heartbeat_at=now() WHERE id=$1", [runner.id]);
	await fixture.pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,execution_generation,configuration_revision,state,benefits_at_start,scheduled_end) VALUES('provider-owner',$1,$2,1,'authorized',$3,$4)", [
		runner.id,
		randomUUID(),
		JSON.stringify(variant === "unknown_start" ? {} : { scheduledStart: Date.now() + (variant === "past" ? -60000 : variant === "during_test" ? 1000 : 600000) }),
		variant === "past" ? new Date(Date.now() - 1000) : variant === "unknown_start" ? null : new Date(Date.now() + 3600000),
	]);
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ stream_key: "live_private" }] })));
	const result = await startTwitchConnectionTest(principal, { ownerId: "provider-owner", runnerId: runner.id, connectionId: connection.id, durationSeconds: 30 }, fixture.db);
	expect(result.success).toBe(variant === "past" || variant === "after_test");
});
test("PC-5 missing and non-Twitch grants cannot start a test output", async () => {
	const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
	const runner = (await fixture.pool.query("SELECT id FROM runners LIMIT 1")).rows[0],
		connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	await fixture.pool.query("UPDATE runners SET status='online',protocol_version=2,last_heartbeat_at=now() WHERE id=$1", [runner.id]);
	const input = { ownerId: "provider-owner", runnerId: runner.id, connectionId: randomUUID(), durationSeconds: 30 };
	expect(await startTwitchConnectionTest(principal, input, fixture.db)).toMatchObject({ success: false, code: "RECONNECT_REQUIRED" });
	const previousId = process.env.YOUTUBE_CLIENT_ID,
		previousSecret = process.env.YOUTUBE_CLIENT_SECRET;
	try {
		process.env.YOUTUBE_CLIENT_ID = "client";
		process.env.YOUTUBE_CLIENT_SECRET = "secret";
		await fixture.pool.query("UPDATE runner_provider_connections SET provider='youtube' WHERE id=$1", [connection.id]);
		expect(await startTwitchConnectionTest(principal, { ...input, connectionId: connection.id }, fixture.db)).toMatchObject({ success: false, code: "CHANNEL_UNAVAILABLE" });
	} finally {
		if (previousId === undefined) delete process.env.YOUTUBE_CLIENT_ID;
		else process.env.YOUTUBE_CLIENT_ID = previousId;
		if (previousSecret === undefined) delete process.env.YOUTUBE_CLIENT_SECRET;
		else process.env.YOUTUBE_CLIENT_SECRET = previousSecret;
	}
});
test("PC-4 provider failure feedback is visible on the owned saved schedule", async () => {
	const { applyRunnerBroadcastDetails } = await import("@/server/runner/provider-metadata");
	const { listRunnerScheduleEventsForPrincipal } = await import("@/server/runner/schedules");
	const state = await metadataCase();
	global.fetch = jest.fn().mockResolvedValue(new Response("{}", { status: 503 }));
	await applyRunnerBroadcastDetails(state.runner, fixture.db);
	const result = await listRunnerScheduleEventsForPrincipal(principal, { ownerId: "provider-owner", runnerId: state.runner.id }, fixture.db);
	expect(result).toMatchObject({ success: true, events: [expect.objectContaining({ id: state.event.id, streamDetailsFeedback: [expect.objectContaining({ destinationId: state.target.id, status: "retry", error: expect.any(String) })] })] });
});
test.each([true, false])("PC-4 only an owned YouTube thumbnail can be saved on an event: owned=%s", async (owned) => {
	const { saveRunnerScheduleEventForPrincipal } = await import("@/server/runner/schedules");
	const state = await metadataCase(),
		asset = randomUUID();
	await fixture.pool.query("DELETE FROM runner_broadcast_admissions");
	await fixture.pool.query("DELETE FROM runner_schedule_events");
	await fixture.pool.query("UPDATE runner_provider_connections SET provider='youtube' WHERE id=$1", [state.target.connection_id]);
	await fixture.pool.query("UPDATE runner_destinations SET provider='youtube',rtmp_url='rtmp://a.rtmp.youtube.com/live2' WHERE id=$1", [state.target.id]);
	if (owned) await fixture.pool.query("INSERT INTO runner_branding_assets(id,owner_id,kind,normalized_mime,size_bytes,width,height,checksum,bytes) VALUES($1,'provider-owner','background','image/png',1,1,1,'fixture',decode('00','hex'))", [asset]);
	const session = (await fixture.pool.query("SELECT id,overlay_id FROM stream_sessions LIMIT 1")).rows[0];
	const result = await saveRunnerScheduleEventForPrincipal(
		principal,
		{ ownerId: "provider-owner", runnerId: state.runner.id, sessionId: session.id, overlayId: session.overlay_id, title: "Vacation", timezone: "Europe/Berlin", recurrence: "once", localStartDate: "2027-02-01", localEndDate: "2027-02-01", localStartTime: "12:00", localEndTime: "13:00", destinationIds: [state.target.id], setStreamDetails: true, streamDetails: [{ destinationId: state.target.id, thumbnailAssetId: asset }] },
		fixture.db,
	);
	expect(result).toMatchObject(owned ? { success: true, event: { streamDetails: [{ destinationId: state.target.id, thumbnailAssetId: asset }] } } : { success: false, code: "INVALID_INPUT", error: expect.stringContaining("thumbnail") });
});
test("PC-4 Twitch does not accept YouTube-only metadata", async () => {
	const { saveRunnerScheduleEventForPrincipal } = await import("@/server/runner/schedules");
	const state = await metadataCase();
	await fixture.pool.query("DELETE FROM runner_broadcast_admissions");
	await fixture.pool.query("DELETE FROM runner_schedule_events");
	const session = (await fixture.pool.query("SELECT id,overlay_id FROM stream_sessions LIMIT 1")).rows[0];
	const result = await saveRunnerScheduleEventForPrincipal(
		principal,
		{ ownerId: "provider-owner", runnerId: state.runner.id, sessionId: session.id, overlayId: session.overlay_id, title: "Vacation", timezone: "Europe/Berlin", recurrence: "once", localStartDate: "2027-02-01", localEndDate: "2027-02-01", localStartTime: "12:00", localEndTime: "13:00", destinationIds: [state.target.id], setStreamDetails: true, streamDetails: [{ destinationId: state.target.id, description: "Unsupported" }] },
		fixture.db,
	);
	expect(result).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.stringContaining("supported") });
});

test("PC-6 authenticated linking delegates to Better Auth and removes abandoned intents on failure", async () => {
	const { auth } = await import("@/auth/config");
	const headers = new Headers({ cookie: "session=fixture" });
	await beginStreamingConnection(principal, { ownerId: "provider-owner", provider: "twitch" }, fixture.db, Date.now, headers);
	expect(auth.api.linkSocialAccount).toHaveBeenCalledWith(expect.objectContaining({ headers, body: expect.objectContaining({ provider: "twitch", scopes: ["channel:read:stream_key", "channel:manage:broadcast"], disableRedirect: true }) }));
	const before = (await fixture.pool.query("SELECT count(*) FROM runner_provider_states")).rows[0].count;
	jest.mocked(auth.api.linkSocialAccount).mockRejectedValueOnce(new Error("private configuration"));
	expect(await beginStreamingConnection(principal, { ownerId: "provider-owner", provider: "twitch" }, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("try again") });
	expect((await fixture.pool.query("SELECT count(*) FROM runner_provider_states")).rows[0].count).toBe(before);
});
test("PC-6 foreign, expired, logged-out and insufficient-scope linking cannot attach a destination", async () => {
	const { recordStreamingAccount } = await import("@/server/runner/provider-connections");
	const nonce = await beginGrant(),
		account = await linkedGrant();
	global.fetch = jest.fn();
	await recordStreamingAccount(account, "invalid", fixture.db);
	await recordStreamingAccount({ ...account, providerId: "unknown" }, nonce, fixture.db);
	await recordStreamingAccount({ ...account, userId: "foreign-user" }, nonce, fixture.db);
	await expect(recordStreamingAccount({ ...account, scope: "openid" }, nonce, fixture.db)).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
	await fixture.pool.query("UPDATE auth.session SET expires_at=now()-interval '1 second'");
	await recordStreamingAccount(account, nonce, fixture.db);
	expect(global.fetch).not.toHaveBeenCalled();
	expect((await fixture.pool.query("SELECT id FROM auth.verification WHERE identifier LIKE 'runner-connection:%'")).rowCount).toBe(0);
});
test("PC-6 linked account removal and token failure return reconnect without falling back to old credentials", async () => {
	const { withStreamingConnection } = await import("@/server/runner/provider-connections");
	const { auth } = await import("@/auth/config");
	const account = await linkedGrant();
	const reference = encryptString(JSON.stringify({ authAccountId: account.id, authUserId: account.userId }));
	const row = (await fixture.pool.query("UPDATE runner_provider_connections SET encrypted_tokens=$1 RETURNING id", [reference])).rows[0];
	const operation = jest.fn();
	jest.mocked(auth.api.getAccessToken).mockRejectedValueOnce(new Error("expired refresh"));
	expect(await fixture.db.transaction((tx) => withStreamingConnection(tx, "provider-owner", row.id, operation))).toMatchObject({ success: false, code: "RECONNECT_REQUIRED" });
	await fixture.pool.query("DELETE FROM auth.account");
	expect(await fixture.db.transaction((tx) => withStreamingConnection(tx, "provider-owner", row.id, operation))).toMatchObject({ success: false, code: "RECONNECT_REQUIRED" });
	expect(operation).not.toHaveBeenCalled();
});

test("PC-6 cancellation during provider lookup cannot attach an abandoned destination", async () => {
	const { recordStreamingAccount, consumeStreamingState } = await import("@/server/runner/provider-connections");
	const nonce = await beginGrant(),
		account = await linkedGrant();
	global.fetch = jest.fn(async () => {
		await consumeStreamingState(principal, "twitch", nonce, fixture.db);
		return new Response(JSON.stringify({ data: [{ id: "99", display_name: "Abandoned channel" }] }));
	});
	await recordStreamingAccount(account, nonce, fixture.db);
	expect((await fixture.pool.query("SELECT id FROM runner_provider_connections WHERE channel_id='99'")).rowCount).toBe(0);
});

test("PC-6 removed provider configuration, missing permissions and token lookup failure leave no connected channel", async () => {
	const { recordStreamingAccount } = await import("@/server/runner/provider-connections");
	const { auth } = await import("@/auth/config");
	const nonce = await beginGrant(),
		account = await linkedGrant();
	const previous = process.env.TWITCH_CLIENT_ID;
	try {
		delete process.env.TWITCH_CLIENT_ID;
		await expect(recordStreamingAccount(account, nonce, fixture.db)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
	} finally {
		process.env.TWITCH_CLIENT_ID = previous;
	}
	await expect(recordStreamingAccount({ ...account, scope: null }, nonce, fixture.db)).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
	jest.mocked(auth.api.getAccessToken).mockRejectedValueOnce(new Error("invalid grant"));
	await expect(recordStreamingAccount(account, nonce, fixture.db)).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
});
test("PC-6 a destination removed before returning to the editor gives a recoverable result", async () => {
	const { recordStreamingAccount, completeStreamingConnection } = await import("@/server/runner/provider-connections");
	const nonce = await beginGrant(),
		account = await linkedGrant();
	global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "99", display_name: "Removed channel" }] })));
	await recordStreamingAccount(account, nonce, fixture.db);
	await fixture.pool.query("DELETE FROM runner_provider_connections WHERE channel_id='99'");
	expect(await completeStreamingConnection(principal, "twitch", nonce, fixture.db)).toMatchObject({ success: false, error: expect.stringContaining("reconnect") });
});

test("PC-7 disconnect keeps destinations and schedules while removing their channel authorization", async () => {
	const { disconnectStreamingConnection } = await import("@/server/runner/provider-connections");
	const connection = (await fixture.pool.query("SELECT id FROM runner_provider_connections LIMIT 1")).rows[0];
	const result = await disconnectStreamingConnection(principal, { ownerId: "provider-owner", connectionId: connection.id }, fixture.db);
	expect(result).toEqual({ success: true });
	expect((await fixture.pool.query("SELECT id FROM runner_provider_connections WHERE id=$1", [connection.id])).rowCount).toBe(0);
	const destination = (await fixture.pool.query("SELECT connection_id,provider_stream_id,credential_revision,configuration_revision FROM runner_destinations LIMIT 1")).rows[0];
	expect(destination).toMatchObject({ connection_id: null, provider_stream_id: null, credential_revision: 2, configuration_revision: 2 });
	expect((await fixture.pool.query("SELECT id FROM runner_schedule_events")).rowCount).toBe(1);
	expect((await fixture.pool.query("SELECT event_id FROM runner_schedule_event_destinations")).rowCount).toBe(1);
});
