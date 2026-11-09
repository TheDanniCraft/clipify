/** @jest-environment node */
export {};
const session = jest.fn();
const adminView = jest.fn();
jest.mock("next/headers", () => ({ headers: async () => new Headers() }));
jest.mock("@actions/auth", () => ({ getVerifiedAdminViewContext: (...args: unknown[]) => adminView(...args) }));
jest.mock("@/auth/session", () => ({ getAuthSession: (...args: unknown[]) => session(...args) }));
let principals: any;
try {
	principals = require("@/auth/session-principal");
} catch {}
describe("verified browser principal adapter", () => {
	beforeEach(() => jest.clearAllMocks());
	test("missing verified session has no creator authority", async () => {
		expect(principals?.getVerifiedSessionPrincipal).toEqual(expect.any(Function));
		session.mockResolvedValue(null);
		expect(await principals.getVerifiedSessionPrincipal()).toBeNull();
	});
	test("maps verified identity and agency context without accepting request-body authority", async () => {
		expect(principals?.getVerifiedSessionPrincipal).toEqual(expect.any(Function));
		const headers = new Headers({ Cookie: "fixture-session" });
		session.mockResolvedValue({ session: { id: "session-id", userId: "actor", createdAt: "2026-10-05T00:00:00Z", activeOrganizationId: "agency" }, user: { id: "actor", clientInfo: { grantId: "forged" } } });
		expect(await principals.getVerifiedSessionPrincipal(headers)).toEqual({ kind: "session", authUserId: "actor", sessionId: "session-id", authenticatedAt: new Date("2026-10-05T00:00:00Z"), organizationId: "agency" });
		expect(session).toHaveBeenCalledWith(headers);
	});
	test("malformed verified session creation date fails closed", async () => {
		expect(principals?.getVerifiedSessionPrincipal).toEqual(expect.any(Function));
		session.mockResolvedValue({ session: { id: "session-id", userId: "actor", createdAt: "invalid" } });
		expect(await principals.getVerifiedSessionPrincipal()).toBeNull();
	});
});

test.each([
	{ authUserId: "actor", sessionId: "session-id", expected: "target" },
	{ authUserId: "other", sessionId: "session-id", expected: undefined },
	{ authUserId: "actor", sessionId: "other-session", expected: undefined },
])("binds admin view to verified auth identity and session: %p", async ({ authUserId, sessionId, expected }) => {
	session.mockResolvedValue({ session: { id: "session-id", userId: "actor", createdAt: "2026-10-05T00:00:00Z" } });
	adminView.mockResolvedValue({ creatorId: "target", authUserId, sessionId });
	const headers = new Headers({ cookie: "admin_view=signed" });
	const result = await principals.getVerifiedSessionPrincipal(headers);
	expect(result.adminViewCreatorId).toBe(expected);
	expect(adminView).toHaveBeenLastCalledWith(headers);
});
