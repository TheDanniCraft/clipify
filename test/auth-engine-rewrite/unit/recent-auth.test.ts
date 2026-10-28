import { isRecentAuthRequired, withSensitiveActionResult } from "@/auth/recent-auth";

test.each([new Error("RECENT_AUTH_REQUIRED"), { code: "SESSION_NOT_FRESH" }, { body: { code: "SESSION_NOT_FRESH" } }, new Error("AUTHENTICATION_REQUIRED")])("recognizes expected verification requirements %j", (error) => {
	expect(isRecentAuthRequired(error)).toBe(true);
});
test("keeps expected verification and rate limits serializable while preserving genuine errors", async () => {
	await expect(
		withSensitiveActionResult(async () => {
			throw new Error("RECENT_AUTH_REQUIRED");
		}),
	).resolves.toEqual({ success: false, code: "REAUTHENTICATION_REQUIRED" });
	await expect(
		withSensitiveActionResult(async () => {
			throw new Error("EXPORT_RATE_LIMITED");
		}),
	).resolves.toEqual({ success: false, code: "EXPORT_RATE_LIMITED" });
	await expect(withSensitiveActionResult(async () => ({ recovered: true }))).resolves.toEqual({ success: true, recovered: true });
	await expect(
		withSensitiveActionResult(async () => {
			throw new Error("DATABASE_FAILED");
		}),
	).rejects.toThrow("DATABASE_FAILED");
	expect(isRecentAuthRequired(null)).toBe(false);
	expect(isRecentAuthRequired(new Error("OWNER_REQUIRED"))).toBe(false);
});
