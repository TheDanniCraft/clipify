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
