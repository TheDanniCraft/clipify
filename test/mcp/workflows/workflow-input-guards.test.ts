/** @jest-environment node */
import { workflowOperation, workflowRetry } from "@/server/resources/workflow";
jest.mock("@/db/client", () => ({ db: {} }));
const principal = { kind: "oauth", authUserId: "actor", grantId: "grant", generation: 1, clientId: "client" };
test("shared backend rejects malformed input before opening a transaction or invoking a mutation", async () => {
	const transaction = jest.fn(),
		operation = jest.fn();
	await expect(workflowOperation(principal as any, "create_gallery", { creatorId: "creator", name: "Gallery", retryKey: "key", unexpected: "field" }, operation, { transaction } as any)).rejects.toThrow("INVALID_INPUT");
	expect(transaction).not.toHaveBeenCalled();
	expect(operation).not.toHaveBeenCalled();
});
test.each([{ kind: "invalid" }, { grantId: undefined }, { generation: 0 }, { clientId: undefined }])("retained retries refuse incomplete OAuth binding %j before storage", async (change) => {
	const select = jest.fn(),
		operation = jest.fn();
	const context = { principal: { ...principal, ...change }, creatorId: "creator", tx: { select } };
	await expect(workflowRetry(context as any, "create_gallery", { retryKey: "key" }, operation)).rejects.toThrow("AUTHENTICATION_REQUIRED");
	expect(select).not.toHaveBeenCalled();
	expect(operation).not.toHaveBeenCalled();
});
test("retained retries require a key before invoking storage or the resource effect", async () => {
	const select = jest.fn(),
		operation = jest.fn();
	await expect(workflowRetry({ principal, creatorId: "creator", tx: { select } } as any, "create_gallery", {}, operation)).rejects.toThrow("INVALID_INPUT");
	expect(select).not.toHaveBeenCalled();
	expect(operation).not.toHaveBeenCalled();
});

test("trusted session retry delegates once without retaining an OAuth replay identity", async () => {
	const select = jest.fn(),
		operation = jest.fn(async () => ({ id: "session-resource" }));
	const result = await workflowRetry({ principal: { kind: "session", authUserId: "actor" }, creatorId: "creator", tx: { select } } as any, "create_gallery", {}, operation);
	expect(result).toEqual({ id: "session-resource" });
	expect(operation).toHaveBeenCalledTimes(1);
	expect(select).not.toHaveBeenCalled();
});

test.each([
	{ selectors: { playlistId: "playlist-resource" }, expectedId: "playlist-resource" },
	{ selectors: { overlayId: "overlay-resource" }, expectedId: "overlay-resource" },
])("retained workflow replay binds the existing selected resource %j", async ({ selectors, expectedId }) => {
	const read: any = { from: () => read, where: () => read, limit: async () => [] };
	const values = jest.fn(async () => undefined);
	const operation = jest.fn(async () => ({ configurationRevision: 2 }));
	const tx = { select: () => read, insert: jest.fn(() => ({ values })) };
	const result = await workflowRetry({ principal, creatorId: "creator", tx } as any, "configure_stream_session", { retryKey: "owned-retry", ...selectors }, operation);
	expect(result).toEqual({ configurationRevision: 2 });
	expect(operation).toHaveBeenCalledTimes(1);
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ resourceId: expectedId, creatorId: "creator", grantId: "grant", grantGeneration: 1, authUserId: "actor", clientId: "client", safeResponse: result }));
});

test("an unidentifiable workflow result never persists a replay record", async () => {
	const read: any = { from: () => read, where: () => read, limit: async () => [] };
	const insert = jest.fn();
	await expect(workflowRetry({ principal, creatorId: "creator", tx: { select: () => read, insert } } as any, "configure_stream_session", { retryKey: "owned-retry" }, async () => ({ configurationRevision: 2 }))).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect(insert).not.toHaveBeenCalled();
});
