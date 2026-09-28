export const EMAIL_OTP_POLICY = {
	storage: "hashed",
	expiresInSeconds: 10 * 60,
	allowedAttempts: 3,
	resendStrategy: "rotate",
} as const;

export type PasskeyLifecycleState = "available" | "unavailable" | "removed" | "replayed" | "counter_regressed" | "failing";

export function passkeyFallback(state: PasskeyLifecycleState): "passkey" | "email-otp" {
	return state === "available" ? "passkey" : "email-otp";
}
