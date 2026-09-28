/** @jest-environment node */
import { TWITCH_REQUIRED_SCOPES, TwitchProviderContractError, validateTwitchProfile } from "@/auth/providers/twitch";
import { mapTwitchOAuthError } from "@/app/lib/twitchErrors";

const validProfile = {
	sub: "twitch-000001",
	preferred_username: "fixture_creator",
	email: "creator@example.invalid",
	email_verified: true,
	picture: "https://example.invalid/avatar.png",
};

describe("TDD-US2-002 Twitch OAuth contract", () => {
	it("accepts the required scopes and verified Twitch identity", () => {
		expect(validateTwitchProfile(validProfile, [...TWITCH_REQUIRED_SCOPES])).toMatchObject({ subject: validProfile.sub, emailVerified: true });
	});

	it.each([
		["declined consent", { error: "access_denied", error_description: "User declined authorization" }, "TWITCH_CONSENT_DECLINED"],
		["expired state", { error: "state_not_found", error_description: "State cookie expired" }, "TWITCH_STATE_EXPIRED"],
		["callback failure", { error: "invalid_code", error_description: "Authorization code expired" }, "TWITCH_CALLBACK_FAILED"],
		["conflicting identity", { error: "account_already_linked_to_different_user", error_description: "Account conflict" }, "TWITCH_IDENTITY_CONFLICT"],
	])("maps %s to a stable retry-safe error", (_label, source, expectedCode) => {
		expect(mapTwitchOAuthError(source)).toEqual({ code: expectedCode, retryable: expectedCode === "TWITCH_CALLBACK_FAILED", providerDescription: source.error_description });
	});

	it("rejects insufficient Twitch scopes and preserves the originating scope set", () => {
		try {
			validateTwitchProfile(validProfile, ["openid"]);
			throw new Error("expected validation failure");
		} catch (error) {
			expect(error).toBeInstanceOf(TwitchProviderContractError);
			expect(error).toMatchObject({ code: "TWITCH_INSUFFICIENT_SCOPES", details: { grantedScopes: ["openid"], missingScopes: expect.arrayContaining(["user:read:email"]) } });
		}
	});

	it.each([
		["missing subject", { ...validProfile, sub: "" }, "TWITCH_PROFILE_INVALID"],
		["missing email", { ...validProfile, email: "" }, "TWITCH_PROFILE_INVALID"],
		["unverified email", { ...validProfile, email_verified: false }, "TWITCH_EMAIL_UNVERIFIED"],
	])("rejects %s without producing a partial identity", (_label, profile, expectedCode) => {
		expect(() => validateTwitchProfile(profile, [...TWITCH_REQUIRED_SCOPES])).toThrow(expect.objectContaining({ code: expectedCode }));
	});

	it("redacts unknown provider details while retaining a non-secret originating code", () => {
		expect(mapTwitchOAuthError({ error: "provider_internal", error_description: "token=super-secret" })).toEqual({
			code: "TWITCH_PROVIDER_ERROR",
			retryable: true,
			providerDescription: "provider_internal",
		});
	});
});
