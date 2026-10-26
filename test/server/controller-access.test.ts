/** @jest-environment node */
export {};

const select = jest.fn();
const authorizeTrustedCreatorOperation = jest.fn();

jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => select(...args) } }));
jest.mock("@/auth/authorize-operation", () => ({ authorizeTrustedCreatorOperation: (...args: unknown[]) => authorizeTrustedCreatorOperation(...args) }));

describe("controller session access", () => {
	const identity = { authUserId: "editor", sessionId: "session-1", expiresAt: Date.now() + 60_000 };

	beforeEach(() => {
		jest.clearAllMocks();
		select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ userId: "editor", createdAt: new Date(), activeOrganizationId: "org-1" }] }) }) });
		authorizeTrustedCreatorOperation.mockResolvedValue({ allowed: true });
	});

	it("rejects expired controller tokens before querying the session", async () => {
		const { hasCurrentControllerAccess } = await import("@/server/controller-access");
		await expect(hasCurrentControllerAccess("owner", { ...identity, expiresAt: Date.now() - 1 })).resolves.toBe(false);
		expect(select).not.toHaveBeenCalled();
	});

	it("rejects revoked sessions", async () => {
		select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
		const { hasCurrentControllerAccess } = await import("@/server/controller-access");
		await expect(hasCurrentControllerAccess("owner", identity)).resolves.toBe(false);
		expect(authorizeTrustedCreatorOperation).not.toHaveBeenCalled();
	});

	it("rechecks current overlay control authorization", async () => {
		authorizeTrustedCreatorOperation.mockResolvedValue({ allowed: false });
		const { hasCurrentControllerAccess } = await import("@/server/controller-access");
		await expect(hasCurrentControllerAccess("owner", identity)).resolves.toBe(false);
		expect(authorizeTrustedCreatorOperation).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "owner", resourceOwnerId: "owner", permission: "overlay:control", principal: expect.objectContaining({ authUserId: "editor", sessionId: "session-1" }) }));
	});
});
