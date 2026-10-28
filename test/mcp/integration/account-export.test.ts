/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-PRIVACY-001 account export MCP approvals", () => {
	test("preserves empty datasets and export time when linked records have already disappeared", () => {
		const result = runMcpProbe("account-export-probe", ["sparse"]);
		expect(result.identity.profile).toBeNull();
		expect(result.identity.authUsers).toEqual([]);
		expect(result.external.newsletter.status).toBe("not_configured");
		expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
	});
	test("builds a complete scoped ZIP with readable dates, stored credentials and an explicit coverage manifest", () => {
		const result = runMcpProbe("account-export-probe", ["complete"], 60000);
		expect(result.tableCount).toBe(71);
		expect(result.unclassified).toBe(0);
		expect(result.files).toEqual(expect.arrayContaining(["READ-ME-FIRST.txt", "manifest.json", "account/account.json", "security/security.json", "runner/runner.json", "clips/clips.json", "connections/connections.json", "support/conversations.json"]));
		expect(result.createdAt).toBe("2026-10-05T00:00:00.000Z");
		expect(result.username).toBe("password is an ordinary username");
		expect(result.clipIds).toEqual(["clip:creator:own-clip"]);
		expect(result.ownCredentialsPresent).toBe(true);
		expect(result.unavailableCredentialPreserved).toBe(true);
		expect(result.brandingBytes).toEqual([137, 80, 78, 71]);
		expect(result.consentPolicyIds).toEqual(["own-policy"]);
		expect(result.foreignDataPresent).toBe(false);
		expect(result.registeredClients).toEqual(["owned-client"]);
		expect(result.externalSupportStatus).toBe("included");
		expect(result.manifestPathsExist).toBe(true);
		expect(result.supportMessages).toEqual(["My exported support conversation"]);
		expect(result.supportSecretsPresent).toBe(false);
		expect(result.notice).toContain("Names, usernames");
		expect(result.notice).toContain("Do not reproduce credential values");
	});
	test("an unverified email cannot claim another support history", () => {
		const result = runMcpProbe("account-export-probe", ["unverified-support-email"]);
		expect(result.external.support).toEqual({ status: "included", contacts: [], conversations: [] });
	});
	test.each(["active", "revoked"])("exports own %s approvals without private client data", (mode) => {
		const result = runMcpProbe("account-export-probe", [mode]);
		expect(result.mcp).toMatchObject({ connections: [expect.objectContaining({ id: result.ownId, clientId: "client", clientName: "Custom AI", scopes: ["creator:read", "overlay:read"], active: mode === "active", revokedAt: mode === "revoked" ? result.now : null, creators: [{ creatorId: "creator", agencyOrganizationId: null }] })] });
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
		expect(result.mcp).toMatchObject({ connections: [] });
		expect(result.leaksForeignGrant).toBe(false);
	});
});
