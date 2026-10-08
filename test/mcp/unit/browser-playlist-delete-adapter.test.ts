/** @jest-environment node */
export {};
jest.mock("server-only", () => ({}));
const mockPrincipal = jest.fn(),
	mockRows = jest.fn(),
	mockDelete = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: (...args: unknown[]) => mockPrincipal(...args) }));
jest.mock("@/server/resources/playlists", () => ({ createPlaylistForPrincipal: jest.fn(), updatePlaylistRecord: jest.fn(), deletePlaylist: (...args: unknown[]) => mockDelete(...args) }));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => mockRows() }) }) }) } }));
const browser = require("@/server/resources/browser-playlists");
const principal = { kind: "session", authUserId: "verified-owner", sessionId: "verified-session", authenticatedAt: new Date() };
const row = { id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", ownerId: "creator", configurationRevision: 1 };
describe("TDD-BROWSER-DELETE-001 verified browser playlist deletion", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPrincipal.mockResolvedValue(principal);
		mockRows.mockResolvedValue([row]);
		mockDelete.mockResolvedValue({ deletedId: row.id });
	});
	test("derives session and current resource owner, forwarding the exact read revision", async () => {
		expect(browser.deleteBrowserPlaylist).toEqual(expect.any(Function));
		const headers = new Headers({ cookie: "fixture-cookie" });
		expect(await browser.deleteBrowserPlaylist(row.id, 1, headers)).toBe(true);
		expect(mockPrincipal).toHaveBeenCalledWith(headers);
		expect(mockDelete).toHaveBeenCalledWith(principal, { creatorId: "creator", playlistId: row.id, expectedRevision: 1 });
	});
	test.each([undefined, null, 0, -1, 1.5, "1"])("malformed revision %p cannot reach persistence", async (revision) => {
		expect(browser.deleteBrowserPlaylist).toEqual(expect.any(Function));
		expect(await browser.deleteBrowserPlaylist(row.id, revision)).toBe(false);
		expect(mockPrincipal).not.toHaveBeenCalled();
		expect(mockDelete).not.toHaveBeenCalled();
	});
	test("logged out session cannot delete", async () => {
		expect(browser.deleteBrowserPlaylist).toEqual(expect.any(Function));
		mockPrincipal.mockResolvedValue(null);
		expect(await browser.deleteBrowserPlaylist(row.id, 1)).toBe(false);
		expect(mockRows).not.toHaveBeenCalled();
		expect(mockDelete).not.toHaveBeenCalled();
	});
	test("missing resource cannot delete", async () => {
		expect(browser.deleteBrowserPlaylist).toEqual(expect.any(Function));
		mockRows.mockResolvedValue([]);
		expect(await browser.deleteBrowserPlaylist(row.id, 1)).toBe(false);
		expect(mockDelete).not.toHaveBeenCalled();
	});
	test.each(["ACCESS_DENIED", "FEATURE_RESTRICTED", "REVISION_CONFLICT", "RESOURCE_UNAVAILABLE", "private database password"])("%s returns only safe failed deletion", async (error) => {
		expect(browser.deleteBrowserPlaylist).toEqual(expect.any(Function));
		mockDelete.mockRejectedValue(new Error(error));
		expect(await browser.deleteBrowserPlaylist(row.id, 1)).toBe(false);
	});
	test("private session/lookup errors never escape", async () => {
		expect(browser.deleteBrowserPlaylist).toEqual(expect.any(Function));
		mockPrincipal.mockRejectedValueOnce(new Error("private session token"));
		expect(await browser.deleteBrowserPlaylist(row.id, 1)).toBe(false);
		mockRows.mockRejectedValueOnce(new Error("private database password"));
		expect(await browser.deleteBrowserPlaylist(row.id, 1)).toBe(false);
	});
});
