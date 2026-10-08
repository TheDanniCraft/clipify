/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockSessionAuthority = jest.fn();
const mockOAuthAuthority = jest.fn();
const mockDiscovery = jest.fn();
const mockRead = jest.fn();
const mockSelect = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => mockSessionAuthority(...args), authorizeTrustedCreatorOperation: (...args: unknown[]) => mockOAuthAuthority(...args), listAuthorizedCreatorOperations: (...args: unknown[]) => mockDiscovery(...args) }));
jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => mockSelect(...args) } }));
import { findPlaylistRecord, listPlaylistRecords, readPlaylistRecord, readPlaylistItemRecords } from "@/server/resources/playlist-reads";

const record = { id: "playlist-1", ownerId: "creator", name: "Saved playlist", configurationRevision: 4 };
const decision = { allowed: true, creator: { id: "creator" }, accessPath: "owner" };
const principal = { kind: "oauth" as const, authUserId: "actor", authenticatedAt: new Date() };
const sessionPrincipal = { kind: "session" as const, authUserId: "actor", sessionId: "session", authenticatedAt: new Date() };
const chain = { from: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), execute: mockRead };
beforeEach(() => {
	jest.clearAllMocks();
	for (const name of ["from", "where", "orderBy", "limit"] as const) chain[name].mockReturnValue(chain);
	mockSelect.mockReturnValue(chain);
	mockRead.mockResolvedValue([record]);
	mockOAuthAuthority.mockResolvedValue(decision);
	mockOAuthAuthority.mockResolvedValue(decision);
	mockDiscovery.mockResolvedValue([decision]);
});
test("browser discovery returns stored records and current access metadata", async () => {
	expect(await listPlaylistRecords({ principal: sessionPrincipal, creatorIds: ["creator"] })).toEqual({ records: [record], access: [decision] });
	expect(mockDiscovery).not.toHaveBeenCalled();
	expect(chain.limit).not.toHaveBeenCalled();
});
test("empty current discovery never queries private playlist storage", async () => {
	mockDiscovery.mockResolvedValue([]);
	expect(await listPlaylistRecords({ principal: sessionPrincipal, creatorIds: [] })).toEqual({ records: [], access: [] });
	expect(mockSelect).not.toHaveBeenCalled();
});
test("targeted browser creator list checks current native session authority", async () => {
	await listPlaylistRecords({ creatorId: "creator", principal: sessionPrincipal });
	expect(mockOAuthAuthority).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", resourceOwnerId: "creator", permission: "playlist:read", principal: sessionPrincipal }));
	expect(mockDiscovery).not.toHaveBeenCalled();
});
test("OAuth client cannot request implicit native dashboard discovery", async () => {
	await expect(listPlaylistRecords({ principal })).rejects.toThrow("INVALID_INPUT");
	expect(mockDiscovery).not.toHaveBeenCalled();
	expect(mockSelect).not.toHaveBeenCalled();
});
test("targeted OAuth page preserves supplied client, ordering, and page limit", async () => {
	const client = { select: mockSelect };
	await listPlaylistRecords({ creatorId: "creator", principal, afterId: "earlier-id", limit: 26 }, client as never);
	expect(mockOAuthAuthority).toHaveBeenCalledWith({ creatorId: "creator", resourceOwnerId: "creator", permission: "playlist:read", principal, client });
	expect(chain.limit).toHaveBeenCalledWith(26);
	expect(chain.orderBy).toHaveBeenCalledTimes(1);
});
test("denied current OAuth authority runs neither cursor decoding nor persistence", async () => {
	const decode = jest.fn(() => "earlier-id");
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(listPlaylistRecords({ creatorId: "creator", principal, afterId: decode })).rejects.toThrow("ACCESS_DENIED");
	expect(decode).not.toHaveBeenCalled();
	expect(mockRead).not.toHaveBeenCalled();
});
test("authorized cursor decoding runs once before reading the next page", async () => {
	const decode = jest.fn(() => "earlier-id");
	await listPlaylistRecords({ creatorId: "creator", principal, afterId: decode, limit: 26 });
	expect(decode).toHaveBeenCalledTimes(1);
});
test("browser ID lookup derives its owner and keeps the requested permission", async () => {
	expect(await readPlaylistRecord("playlist-1", { principal: sessionPrincipal, permission: "playlist:update" })).toEqual(record);
	expect(mockOAuthAuthority).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", resourceOwnerId: "creator", permission: "playlist:update", principal: sessionPrincipal }));
	expect(mockRead).toHaveBeenCalledTimes(1);
});
test("MCP known-owner lookup denies before querying a private resource", async () => {
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(readPlaylistRecord("playlist-1", { creatorId: "creator", principal })).rejects.toThrow("ACCESS_DENIED");
	expect(mockSelect).not.toHaveBeenCalled();
});
test("MCP known-owner lookup preserves saved record and revision", async () => {
	expect(await readPlaylistRecord("playlist-1", { creatorId: "creator", principal })).toEqual(record);
	expect(mockRead).toHaveBeenCalledTimes(1);
});
test.each([undefined, "creator"])("missing playlist with owner %s has the same unavailable boundary", async (creatorId) => {
	mockRead.mockResolvedValue([]);
	await expect(readPlaylistRecord("missing-id", { creatorId, principal: creatorId ? principal : sessionPrincipal })).rejects.toThrow("RESOURCE_UNAVAILABLE");
});
test("denied browser lookup never returns its observed stored record", async () => {
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(readPlaylistRecord("playlist-1", { principal: sessionPrincipal })).rejects.toThrow("ACCESS_DENIED");
});
test("trusted owner lookup represents missing parent as unavailable", async () => {
	mockRead.mockResolvedValue([]);
	expect(await findPlaylistRecord("playlist-1", "creator")).toBeUndefined();
});
test("item reader keeps stored metadata for separate browser and MCP projections", async () => {
	const rows = [{ clipId: "SavedClip", position: 0, clipData: JSON.stringify({ title: "Saved", private: "fixture" }) }];
	mockRead.mockResolvedValue(rows);
	expect(await readPlaylistItemRecords("playlist-1")).toEqual(rows);
	expect(chain.orderBy).toHaveBeenCalledTimes(1);
});
test("database failure propagates to existing adapter failure mapping", async () => {
	mockRead.mockRejectedValueOnce(new Error("controlled persistence failure"));
	await expect(listPlaylistRecords({ principal: sessionPrincipal, creatorIds: ["creator"] })).rejects.toThrow("controlled persistence failure");
});

test("explicit native identity without an adapter-selected creator set returns no private records", async () => {
	expect(await listPlaylistRecords({ principal: sessionPrincipal })).toEqual({ records: [], access: [] });
	expect(mockDiscovery).not.toHaveBeenCalled();
	expect(mockSelect).not.toHaveBeenCalled();
});
