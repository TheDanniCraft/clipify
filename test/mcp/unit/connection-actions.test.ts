/** @jest-environment node */
jest.mock("next/headers", () => ({ headers: jest.fn(async () => new Headers({ origin: "https://clipify.example" })) }));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock("@/server/mcp/config", () => ({ getMcpConfiguration: jest.fn(() => ({ valid: true, origin: "https://clipify.example" })) }));
jest.mock("@/server/mcp/connections", () => ({ listMcpConnections: jest.fn(), revokeMcpConnection: jest.fn(), purgeInactiveMcpConnections: jest.fn() }));
import { getConnectedMcpApps, revokeConnectedMcpApp, purgeInactiveConnectedMcpApps } from "@/app/actions/mcp-connections";
import { getMcpConfiguration } from "@/server/mcp/config";
import { listMcpConnections, revokeMcpConnection, purgeInactiveMcpConnections } from "@/server/mcp/connections";
describe("connected app server-action boundary", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(getMcpConfiguration as jest.Mock).mockReturnValue({ valid: true, origin: "https://clipify.example" });
	});
	test("failed connection listing exposes a safe message", async () => {
		(listMcpConnections as jest.Mock).mockRejectedValue(new Error("private database credential"));
		expect(await getConnectedMcpApps()).toEqual({ connections: [], error: "Connected apps could not be loaded. Try again." });
	});
	test("failed revocation does not leak errors or report success", async () => {
		(revokeMcpConnection as jest.Mock).mockRejectedValue(new Error("private database credential"));
		expect(await revokeConnectedMcpApp("id")).toEqual({ error: "The app could not be disconnected. Try again." });
	});
	test("pending cleanup is preserved for a durably revoked grant", async () => {
		(revokeMcpConnection as jest.Mock).mockResolvedValue(Response.json({ revoked: true, cleanupPending: true }));
		expect(await revokeConnectedMcpApp("id")).toEqual({ revoked: true, cleanupPending: true });
	});
	test("invalid configuration feature does not list or revoke private connections", async () => {
		(getMcpConfiguration as jest.Mock).mockReturnValue({ valid: false });
		expect(await getConnectedMcpApps()).toEqual({ connections: [] });
		expect(await revokeConnectedMcpApp("grant")).toEqual({ error: "Connected apps are unavailable." });
		expect(listMcpConnections).not.toHaveBeenCalled();
		expect(revokeMcpConnection).not.toHaveBeenCalled();
	});
	test("successful connection listing preserves its safe service response", async () => {
		const connections = [{ grantId: "grant", clientName: "Custom app" }];
		(listMcpConnections as jest.Mock).mockResolvedValue(connections);
		expect(await getConnectedMcpApps()).toEqual({ connections });
	});
	test("provider HTTP failure does not falsely report revocation", async () => {
		(revokeMcpConnection as jest.Mock).mockResolvedValue(new Response(null, { status: 403 }));
		expect(await revokeConnectedMcpApp("grant")).toEqual({ error: "The app could not be disconnected. Try again." });
	});
});

test("purge action exposes safe failures and the exact purged IDs on success", async () => {
	(getMcpConfiguration as jest.Mock).mockReturnValue({ valid: true, origin: "https://clipify.example" });
	(purgeInactiveMcpConnections as jest.Mock).mockResolvedValueOnce(Response.json({ error: "private" }, { status: 503 })).mockResolvedValueOnce(Response.json({ purgedIds: ["old"] }));
	expect(await purgeInactiveConnectedMcpApps()).toEqual({ error: "Inactive connections could not be purged. Try again." });
	expect(await purgeInactiveConnectedMcpApps()).toEqual({ purgedIds: ["old"] });
});
