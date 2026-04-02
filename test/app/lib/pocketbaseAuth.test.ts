/** @jest-environment node */
export {};

describe("lib/pocketbaseAuth", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		process.env = { ...originalEnv };
		delete process.env.POCKETBASE_EMAIL;
		delete process.env.POCKETBASE_PASSWORD;
		process.env.POCKETBASE_URL = "https://pb.example.com";
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("authenticates with email/password and caches token", async () => {
		process.env.POCKETBASE_EMAIL = "ops@clipify.us";
		process.env.POCKETBASE_PASSWORD = "secret";

		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: "jwt-token" }),
		});
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock;

		const mod = await import("@/app/lib/pocketbaseAuth");
		const first = await mod.getPocketBaseAuthToken();
		const second = await mod.getPocketBaseAuthToken();

		expect(first).toBe("jwt-token");
		expect(second).toBe("jwt-token");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
