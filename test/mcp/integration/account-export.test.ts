/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-PRIVACY-001 account export MCP approvals", () => {
	test.each(["active", "revoked"])("exports own %s approvals without private client data", (mode) => {
		const result = runMcpProbe("account-export-probe", [mode]);
		expect(result.mcp).toEqual({ connections: [expect.objectContaining({ id: result.ownId, clientId: "client", clientName: "Custom AI", scopes: ["creator:read", "overlay:read"], active: mode === "active", revokedAt: mode === "revoked" ? result.now : null, creators: [{ creatorId: "creator", agencyOrganizationId: null }] })] });
		expect(result.leaksPrivateClientData).toBe(false);
		expect(result.leaksForeignGrant).toBe(false);
	});
	test("includes owned content, billing and privacy records alongside approvals", () => {
		const result = runMcpProbe("account-export-probe", ["populated"]);
		expect(result.resourceCounts).toEqual({ overlays: 1, playlists: 1, subscriptions: 1, subjects: 1 });
		expect(result.mcp.connections).toHaveLength(1);
		expect(result.leaksPrivateClientData).toBe(false);
		expect(result.leaksForeignGrant).toBe(false);
	});
	test("marks an approval expiring at the export instant inactive", () => {
		const result = runMcpProbe("account-export-probe", ["expired"]);
		expect(result.mcp.connections).toEqual([expect.objectContaining({ id: result.ownId, active: false, revokedAt: null })]);
	});
	test("uses the public client identifier when its display name is absent", () => {
		const result = runMcpProbe("account-export-probe", ["unnamed"]);
		expect(result.mcp.connections).toEqual([expect.objectContaining({ clientName: "client" })]);
		expect(result.leaksPrivateClientData).toBe(false);
	});
	test("exports no connections when only another actor has an approval", () => {
		const result = runMcpProbe("account-export-probe", ["empty"]);
		expect(result.mcp).toEqual({ connections: [] });
		expect(result.leaksForeignGrant).toBe(false);
	});
});
