/** @jest-environment node */
jest.mock("server-only", () => ({}));
const authorize = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeTrustedCreatorOperation: (...args: unknown[]) => authorize(...args) }));
import { listMcpActivity, recordMcpCallActivity } from "@/server/mcp/activity";
import type { QueryClient } from "@/db/client";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
const creatorId = "c033cc97-2257-4a6c-804d-6114fb448bc0";
const principal = { kind: "oauth", authUserId: "actor", clientId: "client", grantId: "grant", generation: 1 } as TrustedCreatorPrincipal;
beforeEach(() => {
	jest.resetAllMocks();
	authorize.mockResolvedValue({ allowed: true, creator: { username: "Creator" } });
});
function projectionClient(records: unknown[]) {
	const chain = { from: jest.fn(), leftJoin: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn().mockResolvedValue(records) };
	for (const name of ["from", "leftJoin", "where", "orderBy"] as const) chain[name].mockReturnValue(chain);
	return { select: jest.fn().mockReturnValue(chain) } as unknown as QueryClient;
}
test.each([null, "constructor", "unrecognized_tool"])("legacy tool %p and private reason project only safe fallback labels", async (tool) => {
	const row = { id: "e6f91065-fc8b-4cdd-b0a2-aeffe5391ef4", occurredAt: "2026-10-06T00:00:00.000Z", actorId: "actor", actorName: null, clientId: null, clientName: null, tool, outcome: "error", reason: "private database detail" };
	const result = await listMcpActivity(principal, { creatorId }, projectionClient([row]));
	expect(result.items[0]).toMatchObject({ actor: { id: "actor", name: "Deleted account" }, client: { id: null, name: "Unavailable app" }, tool: "unavailable_tool", reason: null });
	expect(result.nextCursor).toBeNull();
	expect(JSON.stringify(result)).not.toContain("private database detail");
});
test("empty authorized activity is a terminal page", async () => {
	expect(await listMcpActivity(principal, { creatorId }, projectionClient([]))).toEqual({ items: [], nextCursor: null });
});
test.each(["success", "denied", "error"] as const)("%s activity does not fabricate a resource target", async (outcome) => {
	const values = jest.fn().mockResolvedValue(undefined);
	const client = { insert: jest.fn().mockReturnValue({ values }) } as unknown as QueryClient;
	await recordMcpCallActivity(principal, { outcome }, client);
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "actor", targetType: "mcp_connection", targetId: null, action: "sensitive-integration:mcp.unavailable_tool", outcome, metadata: { clientId: "client", grantId: "grant", generation: 1 } }));
});
test.each([
	{ ...principal, kind: "session" },
	{ ...principal, clientId: undefined },
	{ ...principal, grantId: undefined },
])("incomplete attribution %# cannot persist activity", async (identity) => {
	const client = { insert: jest.fn() } as unknown as QueryClient;
	await expect(recordMcpCallActivity(identity as TrustedCreatorPrincipal, { outcome: "error" }, client)).rejects.toThrow("AUTHENTICATION_REQUIRED");
	expect(client.insert).not.toHaveBeenCalled();
});
