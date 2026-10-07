/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockSessionAuthority = jest.fn();
const mockOAuthAuthority = jest.fn();
const mockRead = jest.fn();
const mockSelect = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => mockSessionAuthority(...args), authorizeTrustedCreatorOperation: (...args: unknown[]) => mockOAuthAuthority(...args) }));
jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => mockSelect(...args) } }));
import { listOverlayRecords, readOverlayRecord } from "@/server/resources/overlay-reads";

const ownerRecord = { id: "overlay-1", ownerId: "creator", secret: "internal-owner-secret", configurationRevision: 4 };
const principal = { kind: "oauth" as const, authUserId: "actor", authenticatedAt: new Date(), grantId: "grant" };
const sessionPrincipal = { kind: "session" as const, authUserId: "actor", sessionId: "session", authenticatedAt: new Date() };
const chain = { from: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), execute: mockRead };
beforeEach(() => {
	jest.clearAllMocks();
	for (const name of ["from", "where", "orderBy", "limit"] as const) chain[name].mockReturnValue(chain);
	mockSelect.mockReturnValue(chain);
	mockRead.mockResolvedValue([ownerRecord]);
	mockSessionAuthority.mockResolvedValue({ allowed: true });
	mockOAuthAuthority.mockResolvedValue({ allowed: true });
});
test("browser owner list preserves internal records after live native session authorization", async () => {
	expect(await listOverlayRecords("creator", { principal: sessionPrincipal, permission: "overlay-secret:read" })).toEqual([ownerRecord]);
	expect(mockOAuthAuthority).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", resourceOwnerId: "creator", permission: "overlay-secret:read", principal: sessionPrincipal }));
	expect(mockSessionAuthority).not.toHaveBeenCalled();
	expect(chain.limit).not.toHaveBeenCalled();
});
test("OAuth pagination reads through the supplied client after current trusted authorization", async () => {
	const client = { select: mockSelect };
	expect(await listOverlayRecords("creator", { principal, afterId: "earlier-id", limit: 26 }, client as never)).toEqual([ownerRecord]);
	expect(mockOAuthAuthority).toHaveBeenCalledWith({ creatorId: "creator", resourceOwnerId: "creator", permission: "overlay:read", principal, client });
	expect(chain.limit).toHaveBeenCalledWith(26);
	expect(chain.orderBy).toHaveBeenCalledTimes(1);
});
test("cursor decoding happens only after current OAuth authorization", async () => {
	const decode = jest.fn(() => "earlier-id");
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(listOverlayRecords("creator", { principal, afterId: decode, limit: 26 })).rejects.toThrow("ACCESS_DENIED");
	expect(decode).not.toHaveBeenCalled();
	expect(mockSelect).not.toHaveBeenCalled();
});
test("authorized cursor decoding executes once before the owner-bound read", async () => {
	const decode = jest.fn(() => "earlier-id");
	await listOverlayRecords("creator", { principal, afterId: decode, limit: 26 });
	expect(decode).toHaveBeenCalledTimes(1);
	expect(mockRead).toHaveBeenCalledTimes(1);
});
test("removed session authority never queries saved records", async () => {
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(listOverlayRecords("creator", { principal: sessionPrincipal })).rejects.toThrow("ACCESS_DENIED");
	expect(mockSelect).not.toHaveBeenCalled();
});
test("empty authorized page preserves an empty list", async () => {
	mockRead.mockResolvedValue([]);
	expect(await listOverlayRecords("creator", { principal, limit: 26 })).toEqual([]);
});
test("persistence failure is propagated for the adapter's safe failure mapping", async () => {
	mockRead.mockRejectedValueOnce(new Error("controlled private database failure"));
	await expect(listOverlayRecords("creator", { principal: sessionPrincipal })).rejects.toThrow("controlled private database failure");
});

test("browser ID lookup uses the observed owner and preserves secret-read permission", async () => {
	const decision = { allowed: true, creator: { id: "creator" } };
	mockOAuthAuthority.mockResolvedValue(decision);
	expect(await readOverlayRecord("overlay-1", { principal: sessionPrincipal, permission: "overlay-secret:read" })).toEqual({ overlay: ownerRecord, decision });
	expect(mockOAuthAuthority).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator", resourceOwnerId: "creator", permission: "overlay-secret:read", principal: sessionPrincipal }));
	expect(mockRead).toHaveBeenCalledTimes(1);
});
test("MCP known-owner lookup authorizes before querying a resource", async () => {
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(readOverlayRecord("overlay-1", { creatorId: "creator", principal })).rejects.toThrow("ACCESS_DENIED");
	expect(mockSelect).not.toHaveBeenCalled();
});
test("MCP authorized lookup preserves internal row for the separate safe DTO projection", async () => {
	expect((await readOverlayRecord("overlay-1", { creatorId: "creator", principal })).overlay).toEqual(ownerRecord);
	expect(mockSessionAuthority).not.toHaveBeenCalled();
	expect(mockRead).toHaveBeenCalledTimes(1);
});
test.each([undefined, "creator"])("missing resource with known owner %s has one safe unavailable outcome", async (creatorId) => {
	mockRead.mockResolvedValue([]);
	await expect(readOverlayRecord("missing-id", { creatorId, principal: creatorId ? principal : sessionPrincipal })).rejects.toThrow("RESOURCE_UNAVAILABLE");
});
test("browser denied lookup never returns an observed internal owner row", async () => {
	mockOAuthAuthority.mockResolvedValue({ allowed: false });
	await expect(readOverlayRecord("overlay-1", { principal: sessionPrincipal })).rejects.toThrow("ACCESS_DENIED");
});
