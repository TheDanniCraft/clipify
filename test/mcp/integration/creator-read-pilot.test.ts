/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/auth/session", () => ({ getAuthSession: jest.fn() }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: jest.fn(async () => ({ proAccess: true, runnerAccess: false })) }));
jest.mock("@/db/client", () => {
	const rows: unknown[][] = [];
	const db = {
		select: jest.fn(() => {
			const result = rows.shift() ?? [];
			const chain: any = {};
			for (const key of ["from", "where", "limit"]) chain[key] = () => chain;
			chain.then = (resolve: any) => Promise.resolve(result).then(resolve);
			return chain;
		}),
	};
	return { db, rows };
});
import * as operations from "@/auth/authorize-operation";
import { getAuthSession } from "@/auth/session";
const { rows } = jest.requireMock("@/db/client");
const principal = { kind: "session", authUserId: "actor", sessionId: "session", authenticatedAt: new Date(), organizationId: null };
const account = { creatorId: "creator", organizationId: "creator-org", status: "active" };
const creator = { id: "creator", username: "Safe creator", disabled: false };
function invoke(input: any) {
	return (operations as any).authorizeTrustedCreatorOperation(input);
}
describe("TDD-US1-031 shared trusted-principal creator pilot", () => {
	beforeEach(() => {
		rows.length = 0;
		jest.clearAllMocks();
	});
	test.each(["owner", "operations", "custom-reader"])("uses current %s membership without reading cookies", async (role) => {
		rows.push([account], [creator], [{ role }], role === "custom-reader" ? [{ permission: JSON.stringify({ creator: ["read"] }) }] : []);
		const result = await invoke({ principal, creatorId: "creator", permission: "creator:read" });
		expect(result.allowed).toBe(true);
		expect(result.authUserId).toBe("actor");
		expect(getAuthSession).not.toHaveBeenCalled();
	});
	test("rejects inaccessible creator", async () => {
		rows.push([account], [creator], []);
		expect(await invoke({ principal, creatorId: "creator", permission: "creator:read" })).toMatchObject({ allowed: false });
	});
	test("rejects suspended creator", async () => {
		rows.push([{ ...account, status: "suspended" }], [creator], [{ role: "owner" }], []);
		expect(await invoke({ principal, creatorId: "creator", permission: "creator:read" })).toMatchObject({ allowed: false, code: "ACCOUNT_SUSPENDED" });
	});
	test("OAuth owner cannot escape approved creator set or scope", async () => {
		const oauth = { ...principal, kind: "oauth", clientId: "client", grantId: "grant", generation: 1, scopes: ["creator:read"], creators: [{ creatorId: "other", agencyOrganizationId: null }] };
		expect(await invoke({ principal: oauth, creatorId: "creator", permission: "creator:read" })).toMatchObject({ allowed: false });
		// Supply an otherwise authorized current owner so a removed scope guard would allow the operation.
		rows.push([account], [creator], [{ role: "owner" }], []);
		expect(await invoke({ principal: { ...oauth, creators: [{ creatorId: "creator", agencyOrganizationId: null }] }, creatorId: "creator", permission: "overlay:create" })).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
	});
	test("agency permissions remain bounded by current link ceiling", async () => {
		rows.push([account], [creator], [], [{ role: "content-manager" }], [{ status: "accepted", permissionCeiling: ["overlay:read"] }], []);
		expect(await invoke({ principal: { ...principal, organizationId: "agency" }, creatorId: "creator", permission: "overlay:update" })).toMatchObject({ allowed: false });
	});
});

let creatorService: any;
try {
	creatorService = require("@/server/mcp/creators");
} catch {}
test("TDD-US1-031 creator pilot returns an allowlisted DTO", async () => {
	rows.length = 0;
	rows.push([account], [{ ...creator, email: "private@example.invalid", accessToken: "private-token", plan: "free" }], [{ role: "owner" }], []);
	expect(creatorService?.getCreatorSummary).toEqual(expect.any(Function));
	expect(await creatorService.getCreatorSummary(principal, "creator")).toEqual({ id: "creator", name: "Safe creator" });
});
