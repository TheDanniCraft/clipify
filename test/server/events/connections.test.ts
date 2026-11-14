/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { Role, Plan } from "@/app/lib/types";
import { user, session, account } from "@/db/auth-schema";
import { usersTable } from "@/db/schema";
import { beginEventGoogleConnection, recordEventGoogleAccount, listEventConnections } from "@/server/events/connections";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
jest.mock("@/server/resources/mutation", () => ({
	authorizeLockedMutation: jest.fn(async (p: TrustedCreatorPrincipal, owner: string) => {
		if (p.authUserId !== "actor" || owner !== "host") throw new Error("ACCESS_DENIED");
		return { assertAuthorityCurrent() {} };
	}),
}));
jest.mock("next/headers", () => ({ headers: async () => new Headers() }));
jest.mock("@/auth/config", () => ({ auth: { api: { linkSocialAccount: jest.fn(async ({ body }: { body: { callbackURL: string } }) => ({ url: body.callbackURL })), getAccessToken: jest.fn(async () => ({ accessToken: "selected-account-token" })) } } }));
jest.mock("@/server/provider-credentials", () => ({ withSerializedProviderCredential: jest.fn(async (_pool: unknown, _id: string, run: () => Promise<unknown>) => run()) }));
jest.mock("@/server/runner/provider-api", () => ({ fetchStreamingChannel: jest.fn(async () => ({ id: "UCselected", name: "Selected Brand" })) }));
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
const principal: TrustedCreatorPrincipal = { kind: "session", authUserId: "actor", sessionId: "session", authenticatedAt: new Date() };
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(user).values({ id: "actor", name: "Actor", email: "actor@example.invalid" });
	await fixture.db.insert(session).values({ id: "session", userId: "actor", token: "session-token", expiresAt: new Date(Date.now() + 3600000) });
	await fixture.db.insert(usersTable).values({ id: "host", email: "host@example.invalid", username: "host", avatar: "", role: Role.User, plan: Plan.Free });
	process.env.YOUTUBE_CLIENT_ID = "fixture-client";
	process.env.YOUTUBE_CLIENT_SECRET = "fixture-secret";
}, 30000);
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("binds contextual Google scopes and selected Brand account to the requesting creator and session", async () => {
	const begun = await beginEventGoogleConnection(principal, "host", "youtube", "/dashboard/events", fixture.db);
	expect(begun).toMatchObject({ ok: true });
	if (!begun.ok) throw new Error("begin failed");
	const intent = new URL(begun.link.callbackURL).searchParams.get("intent")!;
	await fixture.db.insert(account).values({ id: "selected-google", userId: "actor", providerId: "google-events-youtube", accountId: "brand-subject", scope: "https://www.googleapis.com/auth/youtube.readonly", accessToken: "fixture-token", refreshToken: "fixture-refresh", updatedAt: new Date() });
	expect(await recordEventGoogleAccount({ id: "selected-google", userId: "other", providerId: "google-events-youtube", scope: "https://www.googleapis.com/auth/youtube.readonly" }, intent, fixture.db)).toBeNull();
	expect(await recordEventGoogleAccount({ id: "selected-google", userId: "actor", providerId: "google-events-youtube", scope: "https://www.googleapis.com/auth/youtube.readonly" }, intent, fixture.db)).toMatchObject({ provider: "youtube", identityName: "Selected Brand" });
	const listed = await listEventConnections(principal, "host", fixture.db);
	expect(listed).toMatchObject({ ok: true, connections: [{ provider: "youtube", identityName: "Selected Brand" }] });
	expect(JSON.stringify(listed)).not.toContain("fixture-token");
});
it("does not request Drive permissions while linking YouTube", async () => {
	const begun = await beginEventGoogleConnection(principal, "host", "youtube", "/dashboard/events", fixture.db);
	expect(begun).toMatchObject({ ok: true, link: { provider: "google-events-youtube", scopes: ["https://www.googleapis.com/auth/youtube.readonly"] } });
	const { auth } = await import("@/auth/config");
	expect(auth.api.linkSocialAccount).not.toHaveBeenCalled();
});

it("requires reconnecting a legacy shared Google credential without changing its Runner grant", async () => {
	const { eventConnectionsTable } = await import("@/db/schema");
	await fixture.db.insert(account).values({ id: "legacy-google", userId: "actor", providerId: "google", accountId: "same-identity", scope: "https://www.googleapis.com/auth/youtube.force-ssl", accessToken: "runner-access", updatedAt: new Date() });
	await fixture.db.insert(eventConnectionsTable).values({ ownerId: "host", provider: "drive", authAccountId: "legacy-google", authUserId: "actor", identityId: "old-folder", identityName: "Google Drive", connected: true });
	expect(await listEventConnections(principal, "host", fixture.db)).toMatchObject({ ok: true, connections: [{ provider: "drive", connected: false }] });
	const { eventGoogleToken } = await import("@/server/events/connections");
	await expect(eventGoogleToken("host", "drive", fixture.db)).rejects.toThrow("PROVIDER_UNAVAILABLE");
	expect((await fixture.db.select().from(account))[0]).toMatchObject({ scope: "https://www.googleapis.com/auth/youtube.force-ssl", accessToken: "runner-access" });
});

jest.mock("@/server/events/storage-http", () => ({ ...jest.requireActual("@/server/events/storage-http"), s3Request: jest.fn(async () => new Response(null, { status: 200 })) }));
it("tests S3 write access and stores only encrypted credentials for the authorized creator", async () => {
	const { saveEventS3Connection } = await import("@/server/events/connections");
	const credentials = { endpoint: "https://storage.example.com", region: "auto", bucket: "awards", accessKeyId: "fixture-key", secretAccessKey: "fixture-s3-secret", prefix: "awards" };
	const result = await saveEventS3Connection(principal, "host", credentials, fixture.db);
	expect(result).toMatchObject({ ok: true, connection: { provider: "s3", connected: true } });
	const { eventConnectionsTable } = await import("@/db/schema");
	const rows = await fixture.db.select().from(eventConnectionsTable);
	expect(rows).toHaveLength(1);
	expect(rows[0].encryptedConfiguration).toBeTruthy();
	expect(JSON.stringify(rows)).not.toContain(credentials.secretAccessKey);
	expect(JSON.stringify(result)).not.toContain(credentials.accessKeyId);
	const { s3Request } = await import("@/server/events/storage-http");
	expect(s3Request).toHaveBeenCalledWith(expect.anything(), "PUT", expect.stringMatching(/^awards\/connection-check-/), expect.anything());
	expect(s3Request).toHaveBeenCalledWith(expect.anything(), "DELETE", expect.stringMatching(/^awards\/connection-check-/));
});
it("retains an existing S3 connection when replacement credentials fail their write check", async () => {
	const { saveEventS3Connection } = await import("@/server/events/connections");
	const { s3Request } = await import("@/server/events/storage-http");
	const original = { endpoint: "https://storage.example.com", region: "auto", bucket: "awards", accessKeyId: "original-key", secretAccessKey: "original-secret", prefix: "awards" };
	expect(await saveEventS3Connection(principal, "host", original, fixture.db)).toMatchObject({ ok: true });
	const { eventConnectionsTable } = await import("@/db/schema");
	const before = await fixture.db.select().from(eventConnectionsTable);
	jest.mocked(s3Request).mockResolvedValueOnce(new Response(null, { status: 403 }));
	expect(await saveEventS3Connection(principal, "host", { endpoint: "https://storage.example.com", region: "auto", bucket: "awards", accessKeyId: "key", secretAccessKey: "secret", prefix: "awards" }, fixture.db)).toEqual({ ok: false, code: "PROVIDER_UNAVAILABLE" });
	expect(await fixture.db.select().from(eventConnectionsTable)).toEqual(before);
});

it("does not move an in-use S3 connection to a different bucket and break existing media", async () => {
	const { saveEventS3Connection } = await import("@/server/events/connections");
	const credentials = { endpoint: "https://storage.example.com", region: "auto", bucket: "awards", accessKeyId: "key", secretAccessKey: "secret", prefix: "awards" };
	const saved = await saveEventS3Connection(principal, "host", credentials, fixture.db);
	if (!saved.ok) throw new Error("connection failed");
	const { awardEventsTable, awardAssetsTable } = await import("@/db/schema");
	const { createAwardConfiguration } = await import("@/app/lib/eventDefaults");
	const configuration = createAwardConfiguration("Awards", "UTC");
	const [event] = await fixture.db.insert(awardEventsTable).values({ ownerId: "host", configuration, presenterDigest: "fixture" }).returning();
	await fixture.db.insert(awardAssetsTable).values({ eventId: event.id, categoryId: configuration.categories[0].id, authUserId: "actor", connectionId: saved.connection.id, mime: "image/png", size: 16, title: "Original", state: "completed", providerKey: "awards/original" });
	expect(await saveEventS3Connection(principal, "host", { ...credentials, bucket: "different-bucket" }, fixture.db)).toMatchObject({ ok: false, code: "CONFLICT" });
	expect(await saveEventS3Connection(principal, "host", { ...credentials, secretAccessKey: "rotated-secret" }, fixture.db)).toMatchObject({ ok: true, connection: { id: saved.connection.id } });
});
