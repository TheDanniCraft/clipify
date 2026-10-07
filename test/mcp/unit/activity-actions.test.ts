/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("next/headers", () => ({ headers: jest.fn(async () => new Headers({ cookie: "verified-fixture-cookie" })) }));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock("@/server/mcp/config", () => ({ getMcpConfiguration: jest.fn(() => ({ enabled: true })) }));
jest.mock("@/server/mcp/connections", () => ({ listMcpConnections: jest.fn(), revokeMcpConnection: jest.fn() }));
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: jest.fn() }));
jest.mock("@/auth/authorize-operation", () => ({ listAuthorizedCreatorOperations: jest.fn() }));
jest.mock("@/server/mcp/activity", () => ({ listMcpActivity: jest.fn() }));
import { getMcpConfiguration } from "@/server/mcp/config";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { listAuthorizedCreatorOperations } from "@/auth/authorize-operation";
import { listMcpActivity } from "@/server/mcp/activity";
const actions = require("@/app/actions/mcp-connections");
const principal = { kind: "session", authUserId: "verified-owner", sessionId: "verified-session", authenticatedAt: new Date() };
describe("TDD-ACTIVITY-004 activity server-action trust boundary", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(getMcpConfiguration as jest.Mock).mockReturnValue({ enabled: true });
		(getVerifiedSessionPrincipal as jest.Mock).mockResolvedValue(principal);
		(listAuthorizedCreatorOperations as jest.Mock).mockResolvedValue([{ creator: { id: "creator", username: "Creator", email: "private@example.invalid" }, sessionId: "private-session", creatorOrganizationId: "private-org" }]);
		(listMcpActivity as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
	});
	test("creator selector contains only currently audit-authorized public labels", async () => {
		expect(actions.getMcpActivityCreators).toEqual(expect.any(Function));
		expect(await actions.getMcpActivityCreators()).toEqual({ available: true, creators: [{ id: "creator", name: "Creator" }] });
		expect(listAuthorizedCreatorOperations).toHaveBeenCalledWith({ permission: "audit:read", requestHeaders: expect.any(Headers) });
	});
	test("page derives principal from verified current headers and forwards only a selector as data", async () => {
		expect(actions.getConnectedMcpActivityPage).toEqual(expect.any(Function));
		const input = { creatorId: "creator", limit: 25, cursor: "opaque-cursor", authUserId: "forged-user" };
		expect(await actions.getConnectedMcpActivityPage(input)).toEqual({ items: [], nextCursor: null });
		expect(listMcpActivity).toHaveBeenCalledWith(principal, input);
		expect(getVerifiedSessionPrincipal).toHaveBeenCalledWith(expect.any(Headers));
	});
	test("disabled feature performs no session or private activity query", async () => {
		expect(actions.getMcpActivityCreators).toEqual(expect.any(Function));
		expect(actions.getConnectedMcpActivityPage).toEqual(expect.any(Function));
		(getMcpConfiguration as jest.Mock).mockReturnValue({ enabled: false });
		expect(await actions.getMcpActivityCreators()).toEqual({ available: false, creators: [] });
		expect(await actions.getConnectedMcpActivityPage({ creatorId: "creator" })).toMatchObject({ items: [], nextCursor: null, error: expect.any(String) });
		expect(getVerifiedSessionPrincipal).not.toHaveBeenCalled();
		expect(listMcpActivity).not.toHaveBeenCalled();
		expect(listAuthorizedCreatorOperations).not.toHaveBeenCalled();
	});
	test("logged out user cannot list creators or activity", async () => {
		expect(actions.getMcpActivityCreators).toEqual(expect.any(Function));
		expect(actions.getConnectedMcpActivityPage).toEqual(expect.any(Function));
		(getVerifiedSessionPrincipal as jest.Mock).mockResolvedValue(null);
		expect(await actions.getMcpActivityCreators()).toMatchObject({ creators: [], error: expect.any(String) });
		expect(await actions.getConnectedMcpActivityPage({ creatorId: "creator" })).toMatchObject({ items: [], error: expect.any(String) });
		expect(listMcpActivity).not.toHaveBeenCalled();
		expect(listAuthorizedCreatorOperations).not.toHaveBeenCalled();
	});
	test.each(["ACCESS_DENIED", "INVALID_INPUT", "private database credential"])("%s never exposes private errors or false page success", async (reason) => {
		expect(actions.getConnectedMcpActivityPage).toEqual(expect.any(Function));
		(listMcpActivity as jest.Mock).mockRejectedValueOnce(new Error(reason));
		const result = await actions.getConnectedMcpActivityPage({ creatorId: "creator" });
		expect(result).toMatchObject({ items: [], nextCursor: null, error: expect.any(String) });
		expect(JSON.stringify(result)).not.toContain("private database credential");
	});
	test("creator lookup failure exposes only safe feedback", async () => {
		expect(actions.getMcpActivityCreators).toEqual(expect.any(Function));
		(listAuthorizedCreatorOperations as jest.Mock).mockRejectedValueOnce(new Error("private database credential"));
		const result = await actions.getMcpActivityCreators();
		expect(result).toMatchObject({ creators: [], error: expect.any(String) });
		expect(JSON.stringify(result)).not.toContain("private database credential");
	});
});

test("non-Error private activity rejection exposes only safe feedback", async () => {
	(getMcpConfiguration as jest.Mock).mockReturnValue({ enabled: true });
	(getVerifiedSessionPrincipal as jest.Mock).mockResolvedValue(principal);
	(listMcpActivity as jest.Mock).mockRejectedValue("private activity credentials");
	expect(await actions.getConnectedMcpActivityPage({ creatorId: "creator" })).toEqual({ items: [], nextCursor: null, error: "Activity could not be loaded. Refresh and try again." });
});
