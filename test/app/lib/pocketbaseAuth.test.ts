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
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await import("@/app/lib/pocketbaseAuth");
		const first = await mod.getPocketBaseAuthToken();
		const second = await mod.getPocketBaseAuthToken();

		expect(first).toBe("jwt-token");
		expect(second).toBe("jwt-token");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("reuses one in-flight auth request for concurrent callers", async () => {
		process.env.POCKETBASE_EMAIL = "ops@clipify.us";
		process.env.POCKETBASE_PASSWORD = "secret";

		let resolveFetch: ((value: { ok: boolean; json: () => Promise<{ token: string }> }) => void) | undefined;
		const fetchMock = jest.fn(
			() =>
				new Promise<{ ok: boolean; json: () => Promise<{ token: string }> }>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		(global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

		const mod = await import("@/app/lib/pocketbaseAuth");
		const firstPromise = mod.getPocketBaseAuthToken();
		const secondPromise = mod.getPocketBaseAuthToken();

		expect(fetchMock).toHaveBeenCalledTimes(1);

		resolveFetch?.({
			ok: true,
			json: async () => ({ token: "jwt-token" }),
		});

		await expect(firstPromise).resolves.toBe("jwt-token");
		await expect(secondPromise).resolves.toBe("jwt-token");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
