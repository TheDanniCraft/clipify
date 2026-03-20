import { isPreview, isCoolify, getBaseUrl, safeReturnUrl } from "@/app/actions/utils";

describe("actions/utils", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("isPreview", () => {
        it("returns true if IS_PREVIEW is true", async () => {
            process.env.IS_PREVIEW = "true";
            expect(await isPreview()).toBe(true);
        });

        it("returns false if IS_PREVIEW is false or missing", async () => {
            process.env.IS_PREVIEW = "false";
            expect(await isPreview()).toBe(false);
            delete process.env.IS_PREVIEW;
            expect(await isPreview()).toBe(false);
        });
    });

    describe("isCoolify", () => {
        it("returns true if any env var starts with COOLIFY_", async () => {
            process.env.COOLIFY_APP_ID = "123";
            expect(await isCoolify()).toBe(true);
        });

        it("returns false if no env var starts with COOLIFY_", async () => {
            Object.keys(process.env).forEach(key => {
                if (key.startsWith("COOLIFY_")) delete process.env[key];
            });
            expect(await isCoolify()).toBe(false);
        });
    });

    describe("getBaseUrl", () => {
        it("uses COOLIFY_URL if provided", async () => {
            process.env.COOLIFY_URL = "test.clipify.us";
            const url = await getBaseUrl();
            expect(url.toString()).toBe("https://test.clipify.us/");
        });

        it("handles comma separated COOLIFY_URL", async () => {
            process.env.COOLIFY_URL = "primary.us, secondary.us";
            const url = await getBaseUrl();
            expect(url.toString()).toBe("https://primary.us/");
        });

        it("uses localhost in development", async () => {
            delete process.env.COOLIFY_URL;
            Object.assign(process.env, { NODE_ENV: "development" });
            const url = await getBaseUrl();
            expect(url.toString()).toBe("http://localhost:3000/");
        });

        it("uses default production url", async () => {
            delete process.env.COOLIFY_URL;
            Object.assign(process.env, { NODE_ENV: "production" });
            const url = await getBaseUrl();
            expect(url.toString()).toBe("https://clipify.us/");
        });

        it("strips port and uses https if isCoolify is true", async () => {
            process.env.COOLIFY_URL = "cool.us:8080";
            process.env.COOLIFY_something = "true";
            const url = await getBaseUrl();
            expect(url.toString()).toBe("https://cool.us/");
        });
    });

    describe("safeReturnUrl", () => {
        it("returns the url if it starts with /", async () => {
            expect(await safeReturnUrl("/dashboard")).toBe("/dashboard");
        });

        it("returns null if it is absolute or malformed", async () => {
            expect(await safeReturnUrl("https://google.com")).toBeNull();
            expect(await safeReturnUrl("//malicious.com")).toBeNull();
            expect(await safeReturnUrl("")).toBeNull();
            expect(await safeReturnUrl(null)).toBeNull();
        });

        it("handles array input", async () => {
            expect(await safeReturnUrl(["/first", "/second"])).toBe("/first");
        });
    });
});
