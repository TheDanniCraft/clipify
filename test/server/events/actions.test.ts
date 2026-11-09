jest.mock("server-only", () => ({}));
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: jest.fn() }));
jest.mock("@/server/events/persistence", () => ({ createAwardEvent: jest.fn(), listAwardEvents: jest.fn(), readAwardEvent: jest.fn(), updateAwardEvent: jest.fn() }));
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { createAwardEvent } from "@/server/events/persistence";
import { createEventAction } from "@/app/actions/events";
it("rejects unauthenticated event creation at the action boundary", async () => {
	jest.mocked(getVerifiedSessionPrincipal).mockResolvedValue(null);
	expect(await createEventAction("host", {})).toMatchObject({ ok: false, code: "AUTHENTICATION_REQUIRED" });
	expect(createAwardEvent).not.toHaveBeenCalled();
});
it("uses the server principal rather than client-provided authority", async () => {
	const principal = { kind: "session" as const, authUserId: "actual", authenticatedAt: new Date(), sessionId: "s" };
	jest.mocked(getVerifiedSessionPrincipal).mockResolvedValue(principal);
	jest.mocked(createAwardEvent).mockResolvedValue({ ok: false, code: "INVALID_INPUT" });
	await createEventAction("host", { authUserId: "fake" });
	expect(createAwardEvent).toHaveBeenCalledWith(principal, "host", { authUserId: "fake" });
});

jest.mock("@/server/events/participant", () => ({ getEventParticipant: jest.fn() }));
jest.mock("@/server/events/public-read", () => ({ readPublicAwardEvent: jest.fn() }));
jest.mock("@/server/events/sources", () => ({ resolveAwardSource: jest.fn() }));
jest.mock("@/server/events/submissions", () => ({ submitAwardCandidate: jest.fn(), ownAwardSubmissions: jest.fn() }));
import { getEventParticipant } from "@/server/events/participant";
import { submitEventAction } from "@/app/actions/events";
it("requires a verified Twitch participant before accepting nominations", async () => {
	jest.mocked(getEventParticipant).mockResolvedValue(null);
	expect(await submitEventAction("event", "category", { authUserId: "forged" })).toMatchObject({ ok: false, code: "AUTHENTICATION_REQUIRED" });
});
