/** @jest-environment node */

describe("account data export token", () => {
	const originalSecret = process.env.BETTER_AUTH_SECRET;

	beforeEach(() => {
		process.env.BETTER_AUTH_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
	});

	afterAll(() => {
		if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
		else process.env.BETTER_AUTH_SECRET = originalSecret;
	});

	it("binds an expiring token to the requesting identity", async () => {
		const { createAccountDataExportToken, verifyAccountDataExportToken } = await import("@/auth/account-data-export-token");
		const now = new Date("2026-10-02T12:00:00.000Z");
		const token = createAccountDataExportToken({ authUserId: "auth-1", creatorId: "creator-1", organizationId: "org-1", now, ttlMs: 60_000 });

		expect(verifyAccountDataExportToken(token, new Date(now.getTime() + 59_999))).toMatchObject({ authUserId: "auth-1", creatorId: "creator-1", organizationId: "org-1" });
		expect(verifyAccountDataExportToken(token, new Date(now.getTime() + 60_000))).toBeNull();
	});

	it("rejects tampered and malformed tokens", async () => {
		const { createAccountDataExportToken, verifyAccountDataExportToken } = await import("@/auth/account-data-export-token");
		const token = createAccountDataExportToken({ authUserId: "auth-1", creatorId: "creator-1", organizationId: "org-1" });
		const [payload, signature] = token.split(".");

		expect(verifyAccountDataExportToken(`${payload}x.${signature}`)).toBeNull();
		expect(verifyAccountDataExportToken("not-a-token")).toBeNull();
	});
});
