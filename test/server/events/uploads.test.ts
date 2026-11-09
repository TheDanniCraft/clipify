/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { user } from "@/db/auth-schema";
import { usersTable, awardEventsTable, eventConnectionsTable, awardAssetsTable, awardSubmissionsTable } from "@/db/schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
import { acceptAwardUpload } from "@/server/events/uploads";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
jest.mock("@/server/events/upload-provider", () => ({ allocateAwardUpload: jest.fn(async () => "awards/provider-key"), writeAwardUpload: jest.fn(async () => {}), deleteAwardUpload: jest.fn(async () => {}), readAwardUpload: jest.fn() }));
let eventId: string, categoryId: string;
const input = { mime: "image/png", size: 16, title: "Thumbnail", description: "" };
const body = () =>
	new ReadableStream<Uint8Array>({
		start(c) {
			c.enqueue(new Uint8Array(16));
			c.close();
		},
	});
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(user).values({ id: "viewer", name: "Viewer", email: "viewer@example.invalid" });
	await fixture.db.insert(usersTable).values({ id: "host", username: "host", email: "host@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	const [connection] = await fixture.db.insert(eventConnectionsTable).values({ ownerId: "host", provider: "s3", identityId: "awards", identityName: "Awards" }).returning();
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.categories[0].source = "image";
	configuration.categories[0].submissionLimit = 1;
	configuration.storageConnectionId = connection.id;
	configuration.schedule.submissionsStart = new Date(Date.now() - 3600000).toISOString();
	const [event] = await fixture.db.insert(awardEventsTable).values({ ownerId: "host", configuration, presenterDigest: "fixture", publishedAt: new Date() }).returning();
	eventId = event.id;
	categoryId = configuration.categories[0].id;
}, 30000);
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("commits a file proposal only after transfer and retains no binary content in the database", async () => {
	const result = await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal);
	expect(result).toMatchObject({ ok: true });
	const assets = await fixture.db.select().from(awardAssetsTable);
	expect(assets).toHaveLength(1);
	expect(assets[0].state).toBe("completed");
	const receipts = await fixture.db.select().from(awardSubmissionsTable);
	expect(receipts[0].original.mediaUrl).toBe(`/api/events/${eventId}/media/${assets[0].id}`);
	expect(await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal)).toMatchObject({ ok: false, code: "LIMIT_REACHED" });
});
it("cleans up storage and rejects a transfer that finishes after submissions close", async () => {
	const { writeAwardUpload, deleteAwardUpload } = await import("@/server/events/upload-provider");
	jest.mocked(writeAwardUpload).mockImplementationOnce(async () => {
		const [event] = await fixture.db.select().from(awardEventsTable);
		event.configuration.schedule.submissionsEnd = new Date(Date.now() - 1000).toISOString();
		const { eq } = await import("drizzle-orm");
		await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	});
	expect(await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal)).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
	expect(await fixture.db.select().from(awardSubmissionsTable)).toHaveLength(0);
	expect(deleteAwardUpload).toHaveBeenCalled();
	expect(await fixture.db.select().from(awardAssetsTable)).toHaveLength(0);
});

it("keeps original uploads private until they become visible nominees", async () => {
	await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal);
	const [asset] = await fixture.db.select().from(awardAssetsTable);
	const { serveAwardAsset } = await import("@/server/events/media");
	expect((await serveAwardAsset(eventId, asset.id, null, new AbortController().signal)).status).toBe(404);
	const { readAwardUpload } = await import("@/server/events/upload-provider");
	jest.mocked(readAwardUpload).mockResolvedValueOnce(new Response(new Uint8Array(16), { headers: { "Content-Type": "image/png", "Content-Length": "16" } }));
	const own = await serveAwardAsset(eventId, asset.id, null, new AbortController().signal, "viewer");
	expect(own.status).toBe(200);
	expect(own.headers.get("X-Content-Type-Options")).toBe("nosniff");
	expect(own.headers.get("Cache-Control")).toContain("no-store");
	expect((await serveAwardAsset(eventId, asset.id, null, new AbortController().signal, "someone-else")).status).toBe(404);
});

jest.mock("@/server/resources/mutation", () => ({ authorizeLockedMutation: jest.fn(async () => ({ assertAuthorityCurrent() {} })) }));
it("allows upload categories to publish only with storage owned by the event creator", async () => {
	const { eq } = await import("drizzle-orm");
	await fixture.db.update(awardEventsTable).set({ publishedAt: null }).where(eq(awardEventsTable.id, eventId));
	const { publishAwardEvent } = await import("@/server/events/lifecycle");
	const principal = { kind: "session" as const, authUserId: "viewer", sessionId: "session", authenticatedAt: new Date() };
	const [event] = await fixture.db.select().from(awardEventsTable);
	const owned = event.configuration.storageConnectionId;
	await fixture.db.insert(usersTable).values({ id: "other", username: "other", email: "other@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	const [foreign] = await fixture.db.insert(eventConnectionsTable).values({ ownerId: "other", provider: "s3", identityId: "foreign", identityName: "Other" }).returning();
	await fixture.db
		.update(awardEventsTable)
		.set({ configuration: { ...event.configuration, storageConnectionId: foreign.id } })
		.where(eq(awardEventsTable.id, eventId));
	expect(await publishAwardEvent(principal, "host", eventId, 1)).toMatchObject({ ok: false, code: "STORAGE_REQUIRED" });
	await fixture.db
		.update(awardEventsTable)
		.set({ configuration: { ...event.configuration, storageConnectionId: owned } })
		.where(eq(awardEventsTable.id, eventId));
	expect(await publishAwardEvent(principal, "host", eventId, 1)).toMatchObject({ ok: true });
});

it("retries failed cleanup without deleting the record needed to find the creator's file", async () => {
	await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal);
	const { eq } = await import("drizzle-orm");
	const [asset] = await fixture.db.select().from(awardAssetsTable);
	await fixture.db
		.update(awardAssetsTable)
		.set({ state: "cleanup", updatedAt: new Date(Date.now() - 3600000) })
		.where(eq(awardAssetsTable.id, asset.id));
	const { deleteAwardUpload } = await import("@/server/events/upload-provider");
	jest.mocked(deleteAwardUpload).mockRejectedValueOnce(new Error("PROVIDER_UNAVAILABLE"));
	const { cleanupAwardUploads } = await import("@/server/events/uploads");
	await cleanupAwardUploads();
	expect(await fixture.db.select().from(awardAssetsTable)).toHaveLength(1);
	await cleanupAwardUploads(new Date(Date.now() + 660000));
	expect(await fixture.db.select().from(awardAssetsTable)).toHaveLength(0);
});

it("queues withdrawn files for deletion instead of filling the creator's storage", async () => {
	const submitted = await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal);
	if (!submitted.ok) throw new Error("upload failed");
	const { withdrawAwardSubmission } = await import("@/server/events/submissions");
	expect(await withdrawAwardSubmission("viewer", eventId, submitted.submission.id)).toMatchObject({ ok: true });
	const [asset] = await fixture.db.select().from(awardAssetsTable);
	expect(asset.state).toBe("cleanup");
});

it("accepts team uploads only through verified team authority and creates no viewer receipt", async () => {
	const { eq } = await import("drizzle-orm");
	const [event] = await fixture.db.select().from(awardEventsTable);
	event.configuration.categories[0].selection = "team";
	await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	expect(await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	const principal = { kind: "session" as const, authUserId: "viewer", sessionId: "session", authenticatedAt: new Date() };
	const { authorizeLockedMutation } = await import("@/server/resources/mutation");
	jest.mocked(authorizeLockedMutation).mockRejectedValueOnce(new Error("ACCESS_DENIED"));
	expect(await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal, { principal, ownerId: "host" })).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
	expect(await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal, { principal, ownerId: "host" })).toMatchObject({ ok: true });
	expect(await fixture.db.select().from(awardSubmissionsTable)).toHaveLength(0);
	expect(await fixture.db.select().from(awardAssetsTable)).toHaveLength(1);
});

it("lets a valid preview read a root nominee's file while keeping unshared/grouped files private", async () => {
	const uploaded = await acceptAwardUpload("viewer", eventId, categoryId, input, body(), new AbortController().signal);
	if (!uploaded.ok) throw new Error("upload failed");
	const { eq } = await import("drizzle-orm");
	const { awardCandidatesTable } = await import("@/db/schema");
	const { createAwardPreviewToken } = await import("@/auth/event-preview-token");
	const { serveAwardAsset } = await import("@/server/events/media");
	const { readAwardUpload } = await import("@/server/events/upload-provider");
	jest.mocked(readAwardUpload).mockImplementation(async () => new Response(new Uint8Array(16)));
	const [asset] = await fixture.db.select().from(awardAssetsTable);
	await fixture.db.update(awardEventsTable).set({ publishedAt: null }).where(eq(awardEventsTable.id, eventId));
	const [event] = await fixture.db.select().from(awardEventsTable);
	const token = createAwardPreviewToken(event);
	const { readAwardPreview } = await import("@/server/events/preview");
	const view = await readAwardPreview(eventId, token);
	if (!view.ok) throw new Error("preview failed");
	expect(view.event.categories[0].candidates[0].content.mediaUrl).toBe(`/api/events/${eventId}/media/${asset.id}?preview=${token}`);
	expect((await serveAwardAsset(eventId, asset.id, null, new AbortController().signal)).status).toBe(404);
	const preview = await serveAwardAsset(eventId, asset.id, null, new AbortController().signal, undefined, false, token);
	expect(preview.status).toBe(200);
	expect((await preview.arrayBuffer()).byteLength).toBe(16);
	const [parent] = await fixture.db
		.insert(awardCandidatesTable)
		.values({ eventId, categoryId, canonicalKey: "parent", content: { kind: "text", reference: "", title: "Group", description: "" } })
		.returning();
	await fixture.db.update(awardCandidatesTable).set({ parentId: parent.id }).where(eq(awardCandidatesTable.id, uploaded.submission.candidateId));
	expect((await serveAwardAsset(eventId, asset.id, null, new AbortController().signal, undefined, false, token)).status).toBe(404);
});
