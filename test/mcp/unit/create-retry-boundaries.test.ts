/** @jest-environment node */
export {};
jest.mock("server-only", () => ({}));
const authorize = jest.fn();
jest.mock("@/server/resources/mutation", () => ({ authorizeLockedMutation: (...args: unknown[]) => authorize(...args) }));
import { createWithRetry } from "@/server/resources/create-retry";
import type { TransactionClient } from "@/db/client";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
const creatorId = "78f15332-0b09-4a04-b9c3-1fe3a54757dc";
const principal = { kind: "oauth", authUserId: "actor", grantId: "grant", generation: 1, clientId: "client" } as TrustedCreatorPrincipal;
const client = { select: jest.fn(), insert: jest.fn() } as unknown as TransactionClient;
const create = jest.fn();
beforeEach(() => {
	jest.clearAllMocks();
	authorize.mockResolvedValue({ assertAuthorityCurrent: jest.fn() });
});
test.each(["create_overlay", "create_playlist"] as const)("invalid %s input cannot reach current authority or persistence", async (tool) => {
	await expect(createWithRetry(client, principal, tool, { creatorId, name: "", retryKey: "" }, create)).rejects.toThrow("INVALID_INPUT");
	expect(authorize).not.toHaveBeenCalled();
	expect(client.select).not.toHaveBeenCalled();
	expect(create).not.toHaveBeenCalled();
});
test.each([
	{ kind: "session", authUserId: "actor", sessionId: "session", authenticatedAt: new Date(0) },
	{ ...principal, grantId: undefined },
	{ ...principal, generation: undefined },
	{ ...principal, clientId: undefined },
])("incomplete retry identity %# cannot consume a retained response or create resource", async (identity) => {
	await expect(createWithRetry(client, identity as TrustedCreatorPrincipal, "create_overlay", { creatorId, name: "Overlay", retryKey: "boundary-key" }, create)).rejects.toThrow("AUTHENTICATION_REQUIRED");
	expect(client.select).not.toHaveBeenCalled();
	expect(client.insert).not.toHaveBeenCalled();
	expect(create).not.toHaveBeenCalled();
});
test("current authority denial stops before retry storage", async () => {
	authorize.mockRejectedValue(new Error("ACCESS_DENIED"));
	await expect(createWithRetry(client, principal, "create_playlist", { creatorId, name: "Playlist", retryKey: "boundary-key" }, create)).rejects.toThrow("ACCESS_DENIED");
	expect(client.select).not.toHaveBeenCalled();
	expect(create).not.toHaveBeenCalled();
});
