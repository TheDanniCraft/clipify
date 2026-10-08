/** @jest-environment node */
export {};
const authorize = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeTrustedCreatorOperation: (...args: unknown[]) => authorize(...args) }));
let mutation: any;
try {
	mutation = require("@/server/resources/mutation");
} catch {}
const now = new Date("2026-10-05T00:00:00Z");
const principal: any = { kind: "oauth", authUserId: "actor", authenticatedAt: now, clientId: "client", grantId: "79e6c5a3-5368-4813-9780-49d22d99175f", generation: 1, scopes: ["overlay:create"], creators: [{ creatorId: "owner", agencyOrganizationId: null }], tokenExpiresAt: new Date(now.getTime() + 60_000), resource: "https://clipify.example/mcp", issuer: "https://clipify.example/api/auth" };
const grant = { id: principal.grantId, authUserId: "actor", clientId: "client", generation: 1, scopes: ["overlay:create"], active: true, revokedAt: null, expiresAt: new Date(now.getTime() + 60_000), resource: principal.resource, issuer: principal.issuer };
function client(row: Record<string, unknown> = grant) {
	const result: any = { from: jest.fn(() => result), where: jest.fn(() => result), limit: jest.fn(() => result), orderBy: jest.fn(() => result), for: jest.fn(async () => [row]) };
	return { select: jest.fn(() => result), result };
}
describe("mutation reauthorization after waiting for locks", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		authorize.mockResolvedValue({ allowed: true, creator: { id: "owner" } });
	});
	test("valid grant locks and rechecks current backend access", async () => {
		expect(mutation?.authorizeLockedMutation).toEqual(expect.any(Function));
		const tx = client();
		const decision = await mutation.authorizeLockedMutation(principal, "owner", "overlay:create", tx, now);
		expect(decision.creator.id).toBe("owner");
		expect(tx.result.for).toHaveBeenCalledWith("update");
		expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ principal, creatorId: "owner", permission: "overlay:create", client: tx }));
	});
	test.each([{ active: false }, { revokedAt: now }, { generation: 2 }, { authUserId: "other" }, { clientId: "other" }, { resource: "https://other.example/mcp" }, { issuer: "https://other.example/auth" }, { scopes: [] }, { expiresAt: now }])("changed or revoked locked grant %j cannot mutate", async (change) => {
		expect(mutation?.authorizeLockedMutation).toEqual(expect.any(Function));
		await expect(mutation.authorizeLockedMutation(principal, "owner", "overlay:create", client({ ...grant, ...change }), now)).rejects.toThrow("AUTHENTICATION_REQUIRED");
		expect(authorize).not.toHaveBeenCalled();
	});
	test("token expiring while queued is rejected even when grant remains active", async () => {
		expect(mutation?.authorizeLockedMutation).toEqual(expect.any(Function));
		await expect(mutation.authorizeLockedMutation({ ...principal, tokenExpiresAt: now }, "owner", "overlay:create", client(), now)).rejects.toThrow("AUTHENTICATION_REQUIRED");
	});
	test("current backend denial remains authoritative despite locked approved grant", async () => {
		expect(mutation?.authorizeLockedMutation).toEqual(expect.any(Function));
		authorize.mockResolvedValue({ allowed: false });
		await expect(mutation.authorizeLockedMutation(principal, "owner", "overlay:create", client(), now)).rejects.toThrow("ACCESS_DENIED");
	});
	test("grant expiry reached while waiting for creator lock rejects before authorization", async () => {
		expect(mutation?.authorizeLockedMutation).toEqual(expect.any(Function));
		jest.useFakeTimers().setSystemTime(now);
		try {
			const tx = client();
			tx.result.for
				.mockImplementationOnce(async () => [grant])
				.mockImplementationOnce(async () => {
					jest.setSystemTime(new Date(now.getTime() + 61_000));
					return [{ creatorId: "owner" }];
				});
			await expect(mutation.authorizeLockedMutation({ ...principal, tokenExpiresAt: new Date(now.getTime() + 120_000) }, "owner", "overlay:create", tx)).rejects.toThrow("AUTHENTICATION_REQUIRED");
			expect(authorize).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});
});
