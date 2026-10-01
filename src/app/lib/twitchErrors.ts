export const REWARD_NOT_FOUND = "REWARD_NOT_FOUND";

export type TwitchOAuthErrorCode = "TWITCH_CONSENT_DECLINED" | "TWITCH_STATE_EXPIRED" | "TWITCH_CALLBACK_FAILED" | "TWITCH_IDENTITY_CONFLICT" | "TWITCH_PROVIDER_ERROR";

const mappedErrors: Record<string, { code: TwitchOAuthErrorCode; retryable: boolean }> = {
	access_denied: { code: "TWITCH_CONSENT_DECLINED", retryable: false },
	state_not_found: { code: "TWITCH_STATE_EXPIRED", retryable: false },
	state_invalid: { code: "TWITCH_STATE_EXPIRED", retryable: false },
	state_mismatch: { code: "TWITCH_STATE_EXPIRED", retryable: false },
	invalid_code: { code: "TWITCH_CALLBACK_FAILED", retryable: true },
	account_already_linked_to_different_user: { code: "TWITCH_IDENTITY_CONFLICT", retryable: false },
};

export function mapTwitchOAuthError(source: { error?: unknown; error_description?: unknown }) {
	const originatingCode = typeof source.error === "string" ? source.error : "unknown_provider_error";
	const mapped = mappedErrors[originatingCode] ?? { code: "TWITCH_PROVIDER_ERROR" as const, retryable: true };
	const rawDescription = typeof source.error_description === "string" ? source.error_description : "";
	const providerDescription = mappedErrors[originatingCode] && !/(token|secret|password|authorization|cookie)\s*=/i.test(rawDescription) ? rawDescription.slice(0, 240) : originatingCode;
	return { ...mapped, providerDescription };
}
