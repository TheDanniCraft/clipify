/** @jest-environment node */
export {};
import { CreationQuotaError } from "@/server/resources/quota";
const getPrincipal = jest.fn(),
	create = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: (...args: unknown[]) => getPrincipal(...args) }));
jest.mock("@/server/resources/overlays", () => ({ createOverlayForPrincipal: (...args: unknown[]) => create(...args) }));
let browser: any;
try {
	browser = require("@/server/resources/browser-overlays");
} catch {}
const principal = { kind: "session", authUserId: "actor", sessionId: "verified-session", authenticatedAt: new Date(0), organizationId: "agency" };
describe("browser creation delegates to the same backend enforcement", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getPrincipal.mockResolvedValue(principal);
	});
	test("unauthenticated browser cannot reach the creation service", async () => {
		expect(browser?.createBrowserOverlay).toEqual(expect.any(Function));
		getPrincipal.mockResolvedValue(null);
		expect(await browser.createBrowserOverlay("owner")).toBeNull();
		expect(create).not.toHaveBeenCalled();
	});
	test("uses the verified session principal and preserves the browser result", async () => {
		expect(browser?.createBrowserOverlay).toEqual(expect.any(Function));
		const overlay = { id: "created", ownerId: "owner", secret: "browser-private-secret", configurationRevision: 1 };
		create.mockResolvedValue(overlay);
		expect(await browser.createBrowserOverlay("owner")).toBe(overlay);
		expect(create).toHaveBeenCalledWith(principal, { creatorId: "owner", name: "New Overlay", retryKey: expect.stringMatching(/^[a-f0-9-]{36}$/) });
	});
	test.each(["PLAN_LIMIT_REACHED", "ACCESS_DENIED"])("%s preserves existing null browser outcome", async (code) => {
		expect(browser?.createBrowserOverlay).toEqual(expect.any(Function));
		create.mockRejectedValue(new Error(code));
		expect(await browser.createBrowserOverlay("owner")).toBeNull();
	});
	test("unexpected backend failure is a safe actionable browser error", async () => {
		expect(browser?.createBrowserOverlay).toEqual(expect.any(Function));
		create.mockRejectedValue(new Error("private-database-password"));
		await expect(browser.createBrowserOverlay("owner")).rejects.toThrow("Failed to create overlay");
	});
});

test("backend safe DTO cannot substitute a browser owner-bearing resource", async () => {
	getPrincipal.mockResolvedValue(principal);
	create.mockResolvedValue({ id: "safe-resource", name: "Fixture", configurationRevision: 1 });
	await expect(browser.createBrowserOverlay("owner")).rejects.toThrow("Failed to create overlay");
});
test("non-Error backend rejection remains a safe browser failure", async () => {
	getPrincipal.mockResolvedValue(principal);
	create.mockRejectedValue("private backend details");
	await expect(browser.createBrowserOverlay("owner")).rejects.toThrow("Failed to create overlay");
});

describe("structured browser creation feedback", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getPrincipal.mockResolvedValue(principal);
	});
	test("current backend quota fields reach only the explicit feedback response", async () => {
		create.mockRejectedValue(new CreationQuotaError(3, 1));
		expect(await browser.createBrowserOverlayWithFeedback("owner")).toEqual({ overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: 3, limit: 1 } });
	});
	test("missing verified identity reveals no usage", async () => {
		getPrincipal.mockResolvedValue(null);
		expect(await browser.createBrowserOverlayWithFeedback("owner")).toEqual({ overlay: null, error: { code: "ACCESS_DENIED" } });
		expect(create).not.toHaveBeenCalled();
	});
	test("current access denial reveals no quota metadata", async () => {
		create.mockRejectedValue(new Error("ACCESS_DENIED"));
		expect(await browser.createBrowserOverlayWithFeedback("owner")).toEqual({ overlay: null, error: { code: "ACCESS_DENIED" } });
	});
	test("unexpected backend failure reveals no private message", async () => {
		create.mockRejectedValue(new Error("private database credentials"));
		expect(await browser.createBrowserOverlayWithFeedback("owner")).toEqual({ overlay: null, error: { code: "SERVICE_UNAVAILABLE" } });
	});
	test("successful feedback preserves the browser-owned resource", async () => {
		const overlay = { id: "created", ownerId: "owner", configurationRevision: 1 };
		create.mockResolvedValue(overlay);
		expect(await browser.createBrowserOverlayWithFeedback("owner")).toEqual({ overlay, error: null });
	});
	test("safe DTO cannot substitute a browser-owned resource", async () => {
		create.mockResolvedValue({ id: "created", creatorId: "owner" });
		expect(await browser.createBrowserOverlayWithFeedback("owner")).toEqual({ overlay: null, error: { code: "SERVICE_UNAVAILABLE" } });
	});
});
