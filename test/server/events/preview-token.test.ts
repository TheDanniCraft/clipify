/** @jest-environment node */
import { createAwardPreviewToken, hasAwardPreviewToken } from "@/auth/event-preview-token";
import { hasAwardPresenterSecret } from "@/server/events/persistence";
const event = { id: "2b7b66de-759c-4223-859d-cd933b9f7ab6", presenterDigest: "a".repeat(64) };
it("limits a read-only preview capability to its event, expiry and current presenter generation", () => {
	process.env.BETTER_AUTH_SECRET = "isolated-preview-signing-secret-not-for-production";
	const now = new Date("2026-11-09T12:00:00Z"),
		token = createAwardPreviewToken(event, now);
	expect(hasAwardPreviewToken(event, token, now)).toBe(true);
	expect(hasAwardPreviewToken({ ...event, id: "another-event" }, token, now)).toBe(false);
	expect(hasAwardPreviewToken({ ...event, presenterDigest: "b".repeat(64) }, token, now)).toBe(false);
	expect(hasAwardPreviewToken(event, token + "x", now)).toBe(false);
	expect(hasAwardPreviewToken(event, token, new Date("2026-11-16T12:00:00Z"))).toBe(false);
	expect(hasAwardPresenterSecret(event, token)).toBe(false);
});
