/** @jest-environment node */
export {};
jest.mock("server-only", () => ({}));
const mockPrincipal = jest.fn();
const mockUpdate = jest.fn();
const mockRows = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: (...args: unknown[]) => mockPrincipal(...args) }));
jest.mock("@/server/resources/playlists", () => ({ createPlaylistForPrincipal: jest.fn(), updatePlaylistRecord: (...args: unknown[]) => mockUpdate(...args) }));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => mockRows() }) }) }) } }));
let browser: any;
try {
	browser = require("@/server/resources/browser-playlists");
} catch {}
const principal = { kind: "session", authUserId: "verified-actor", sessionId: "verified-session", authenticatedAt: new Date() };
const row = { id: "79e6c5a3-5368-4813-9780-49d22d99175f", ownerId: "creator", name: "Old name", configurationRevision: 1 };
describe("TDD-US2-038 browser playlist rename adapter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPrincipal.mockResolvedValue(principal);
		mockRows.mockResolvedValue([row]);
		mockUpdate.mockResolvedValue({ ...row, name: "Browser name", configurationRevision: 2 });
	});
	test("verified session, owner and last-read revision reach the shared backend writer", async () => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		const headers = new Headers({ Cookie: "isolated-fixture-cookie" });
		const result = await browser.saveBrowserPlaylist(row.id, { name: "  Browser name  " }, 1, headers);
		expect(mockPrincipal).toHaveBeenCalledWith(headers);
		expect(mockUpdate).toHaveBeenCalledWith(principal, { creatorId: "creator", playlistId: row.id, name: "Browser name", expectedRevision: 1 });
		expect(result).toMatchObject({ name: "Browser name", configurationRevision: 2 });
	});
	test("logged-out request cannot mutate", async () => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		mockPrincipal.mockResolvedValue(null);
		expect(await browser.saveBrowserPlaylist(row.id, { name: "Browser name" }, 1)).toBeNull();
		expect(mockUpdate).not.toHaveBeenCalled();
	});
	test.each([undefined, null, 0, -1, 1.5, "1"])("missing/malformed revision %p does not reach persistence", async (revision) => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		expect(await browser.saveBrowserPlaylist(row.id, { name: "Browser name" }, revision)).toBeNull();
		expect(mockUpdate).not.toHaveBeenCalled();
	});
	test("absent resource is unavailable without a mutation", async () => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		mockRows.mockResolvedValue([]);
		expect(await browser.saveBrowserPlaylist(row.id, { name: "Browser name" }, 1)).toBeNull();
		expect(mockUpdate).not.toHaveBeenCalled();
	});
	test("browser name normalization preserves existing empty/max-length behavior", async () => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		await expect(browser.saveBrowserPlaylist(row.id, { name: "   " }, 1)).rejects.toThrow("Playlist name is required");
		expect(mockUpdate).not.toHaveBeenCalled();
		await browser.saveBrowserPlaylist(row.id, { name: "x".repeat(130) }, 1);
		expect(mockUpdate).toHaveBeenCalledWith(principal, expect.objectContaining({ name: "x".repeat(120) }));
	});
	test.each(["ACCESS_DENIED", "FEATURE_RESTRICTED", "REVISION_CONFLICT", "INVALID_INPUT", "RESOURCE_UNAVAILABLE"])("%s preserves the unavailable browser outcome", async (code) => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		mockUpdate.mockRejectedValueOnce(new Error(code));
		expect(await browser.saveBrowserPlaylist(row.id, { name: "Browser name" }, 1)).toBeNull();
	});
	test("resource lookup failure never discloses database details", async () => {
		mockRows.mockRejectedValueOnce(new Error("private database password"));
		await expect(browser.saveBrowserPlaylist(row.id, { name: "Browser name" }, 1)).rejects.toThrow("Failed to save playlist");
	});

	test("unexpected failure never discloses backend details", async () => {
		expect(browser?.saveBrowserPlaylist).toEqual(expect.any(Function));
		mockUpdate.mockRejectedValueOnce(new Error("private database password"));
		await expect(browser.saveBrowserPlaylist(row.id, { name: "Browser name" }, 1)).rejects.toThrow("Failed to save playlist");
	});
});

test("omitted name preserves the current persisted name through the shared writer", async () => {
	jest.clearAllMocks();
	mockUpdate.mockResolvedValue(row);
	mockPrincipal.mockResolvedValue(principal);
	mockRows.mockResolvedValue([row]);
	await browser.saveBrowserPlaylist(row.id, {}, 1);
	expect(mockUpdate).toHaveBeenLastCalledWith(principal, { creatorId: row.ownerId, playlistId: row.id, name: row.name, expectedRevision: 1 });
});
