/** @jest-environment node */
export {};
const getPrincipal = jest.fn(),
	create = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: (...args: unknown[]) => getPrincipal(...args) }));
jest.mock("@/server/resources/playlists", () => ({ createPlaylistForPrincipal: (...args: unknown[]) => create(...args) }));
let browser: any;
try {
	browser = require("@/server/resources/browser-playlists");
} catch {}
const principal = { kind: "session", authUserId: "actor", sessionId: "verified-session", authenticatedAt: new Date(0), organizationId: "agency" };
describe("browser playlist creation shares backend enforcement", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getPrincipal.mockResolvedValue(principal);
	});
	test("unauthenticated browser cannot reach creation", async () => {
		expect(browser?.createBrowserPlaylist).toEqual(expect.any(Function));
		getPrincipal.mockResolvedValue(null);
		expect(await browser.createBrowserPlaylist("owner", "name")).toBeNull();
		expect(create).not.toHaveBeenCalled();
	});
	test("verified principal and normalized bounded name preserve the browser result", async () => {
		expect(browser?.createBrowserPlaylist).toEqual(expect.any(Function));
		const playlist = { id: "created", ownerId: "owner", name: "a".repeat(120), configurationRevision: 1 };
		create.mockResolvedValue(playlist);
		expect(await browser.createBrowserPlaylist("owner", "  " + "a".repeat(130) + "  ")).toBe(playlist);
		expect(create).toHaveBeenCalledWith(principal, { creatorId: "owner", name: "a".repeat(120), retryKey: expect.stringMatching(/^[a-f0-9-]{36}$/) });
	});
	test("empty name is rejected before creation", async () => {
		expect(browser?.createBrowserPlaylist).toEqual(expect.any(Function));
		await expect(browser.createBrowserPlaylist("owner", "   ")).rejects.toThrow("Playlist name is required");
		expect(create).not.toHaveBeenCalled();
	});
	test("current backend denial preserves null outcome", async () => {
		expect(browser?.createBrowserPlaylist).toEqual(expect.any(Function));
		create.mockRejectedValue(new Error("ACCESS_DENIED"));
		expect(await browser.createBrowserPlaylist("owner", "name")).toBeNull();
	});
	test("Free quota denial preserves browser message", async () => {
		expect(browser?.createBrowserPlaylist).toEqual(expect.any(Function));
		create.mockRejectedValue(new Error("PLAN_LIMIT_REACHED"));
		await expect(browser.createBrowserPlaylist("owner", "name")).rejects.toThrow("Free plan allows only one playlist");
	});
	test("unexpected backend errors do not disclose secrets", async () => {
		expect(browser?.createBrowserPlaylist).toEqual(expect.any(Function));
		create.mockRejectedValue(new Error("private-database-password"));
		await expect(browser.createBrowserPlaylist("owner", "name")).rejects.toThrow("Failed to create playlist");
	});
});

test("backend safe DTO cannot substitute a browser owner-bearing resource", async () => {
	getPrincipal.mockResolvedValue(principal);
	create.mockResolvedValue({ id: "safe-resource", name: "Fixture", configurationRevision: 1 });
	await expect(browser.createBrowserPlaylist("owner", "name")).rejects.toThrow("Failed to create playlist");
});
test("non-Error backend rejection remains a safe browser failure", async () => {
	getPrincipal.mockResolvedValue(principal);
	create.mockRejectedValue("private backend details");
	await expect(browser.createBrowserPlaylist("owner", "name")).rejects.toThrow("Failed to create playlist");
});
