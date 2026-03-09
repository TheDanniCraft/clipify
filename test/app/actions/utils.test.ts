import { getBaseUrl, isCoolify, isPreview, safeReturnUrl } from "@/app/actions/utils";

describe("actions/utils", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("detects preview mode case-insensitively", async () => {
		process.env.IS_PREVIEW = "TrUe";
		await expect(isPreview()).resolves.toBe(true);
		process.env.IS_PREVIEW = "false";
		await expect(isPreview()).resolves.toBe(false);
	});

	it("detects coolify by env var prefix", async () => {
		delete process.env.COOLIFY_URL;
		delete process.env.COOLIFY_TEST;
		await expect(isCoolify()).resolves.toBe(false);
		process.env.COOLIFY_TEST = "1";
		await expect(isCoolify()).resolves.toBe(true);
	});

	it("resolves base URL from COOLIFY_URL and normalizes hostname", async () => {
		process.env.COOLIFY_URL = "my-app.example.com:8443,backup.example.com";
		const result = await getBaseUrl();
		expect(result.toString()).toBe("https://my-app.example.com/");
	});

	it("falls back to localhost in development", async () => {
		delete process.env.COOLIFY_URL;
		process.env = { ...process.env, NODE_ENV: "development" };
		const result = await getBaseUrl();
		expect(result.toString()).toBe("http://localhost:3000/");
	});

	it("falls back to production URL outside development", async () => {
		delete process.env.COOLIFY_URL;
		process.env = { ...process.env, NODE_ENV: "production" };
		const result = await getBaseUrl();
		expect(result.toString()).toBe("https://clipify.us/");
	});

	it("accepts only safe relative return URLs", async () => {
		await expect(safeReturnUrl("/dashboard")).resolves.toBe("/dashboard");
		await expect(safeReturnUrl(["/overlay/abc"])).resolves.toBe("/overlay/abc");
		await expect(safeReturnUrl("https://evil.test")).resolves.toBeNull();
		await expect(safeReturnUrl("//evil.test")).resolves.toBeNull();
		await expect(safeReturnUrl("dashboard")).resolves.toBeNull();
		await expect(safeReturnUrl(undefined)).resolves.toBeNull();
	});
});
