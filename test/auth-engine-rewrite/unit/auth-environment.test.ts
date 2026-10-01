import { requiredAuthSetting } from "@/auth/environment";

describe("Better Auth environment boundaries", () => {
	it("requires secrets when the application runs normally", () => {
		expect(() => requiredAuthSetting("BETTER_AUTH_SECRET", undefined, {}, ["node", "server.js"])).toThrow("BETTER_AUTH_SECRET must be injected by Infisical");
	});

	it("uses non-secret placeholders only during a controlled build", () => {
		expect(requiredAuthSetting("BETTER_AUTH_SECRET", undefined, { CLIPIFY_BUILD_PHASE: "1" }, ["node", "next", "build"])).toBe("schema-generation-only-secret-at-least-32-characters");
		expect(requiredAuthSetting("TWITCH_CLIENT_ID", undefined, { CLIPIFY_BUILD_PHASE: "1" }, ["node", "next", "build"])).toBe("schema-generation-twitch_client_id");
	});

	it("prefers injected values over controlled placeholders", () => {
		expect(requiredAuthSetting("BETTER_AUTH_SECRET", undefined, { BETTER_AUTH_SECRET: "injected-secret", CLIPIFY_BUILD_PHASE: "1" }, ["node", "next", "build"])).toBe("injected-secret");
	});
});
