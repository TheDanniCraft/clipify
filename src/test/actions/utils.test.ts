import * as utils from "@actions/utils";

describe("utils.ts", () => {
	const OLD_ENV = process.env;

	beforeEach(() => {
		jest.resetModules();
		process.env = { ...OLD_ENV };
	});

	afterEach(() => {
		process.env = OLD_ENV;
	});

	describe("isPreview", () => {
		it("returns true when IS_PREVIEW is 'true'", async () => {
			process.env.IS_PREVIEW = "true";
			await expect(utils.isPreview()).resolves.toBe(true);
		});

		it("returns true when IS_PREVIEW is 'TRUE' (case-insensitive)", async () => {
			process.env.IS_PREVIEW = "TRUE";
			await expect(utils.isPreview()).resolves.toBe(true);
		});

		it("returns false when IS_PREVIEW is not 'true'", async () => {
			process.env.IS_PREVIEW = "false";
			await expect(utils.isPreview()).resolves.toBe(false);
		});

		it("returns false when IS_PREVIEW is undefined", async () => {
			delete process.env.IS_PREVIEW;
			await expect(utils.isPreview()).resolves.toBe(false);
		});
	});

	describe("isCoolify", () => {
		it("returns true if any env key starts with COOLIFY_", async () => {
			process.env.COOLIFY_TEST = "1";
			await expect(utils.isCoolify()).resolves.toBe(true);
		});

		it("returns false if no env key starts with COOLIFY_", async () => {
			delete process.env.COOLIFY_TEST;
			await expect(utils.isCoolify()).resolves.toBe(false);
		});
	});

	describe("getBaseUrl", () => {
		it("returns localhost url if COOLIFY_URL is not set and not coolify", async () => {
			delete process.env.COOLIFY_URL;
			delete process.env.COOLIFY_TEST;
			const url = await utils.getBaseUrl();
			expect(url.href).toBe("http://localhost:3000/");
		});

		it("prepends https:// if COOLIFY_URL is missing protocol", async () => {
			process.env.COOLIFY_URL = "mydomain.com:8080";
			delete process.env.COOLIFY_TEST;
			const url = await utils.getBaseUrl();
			expect(url.href).toBe("https://mydomain.com/");
		});

		it("returns https://hostname if running inside coolify", async () => {
			process.env.COOLIFY_URL = "http://mycoolify.com:1234";
			process.env.COOLIFY_TEST = "1";
			const url = await utils.getBaseUrl();
			expect(url.href).toBe("https://mycoolify.com/");
		});

		it("returns https://hostname if running inside coolify and COOLIFY_URL missing protocol", async () => {
			process.env.COOLIFY_URL = "mycoolify.com:1234";
			process.env.COOLIFY_TEST = "1";
			const url = await utils.getBaseUrl();
			expect(url.href).toBe("https://mycoolify.com/");
		});
	});
});
