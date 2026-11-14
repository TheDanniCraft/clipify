/** @jest-environment node */
const publicView = jest.fn(),
	previewView = jest.fn(),
	principal = jest.fn(),
	review = jest.fn();
jest.mock("@/server/events/public-read", () => ({ readPublicAwardEvent: (...args: unknown[]) => publicView(...args) }));
jest.mock("@/server/events/preview", () => ({ readAwardPreview: (...args: unknown[]) => previewView(...args) }));
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: () => principal() }));
jest.mock("@/server/events/review", () => ({ readAwardReview: (...args: unknown[]) => review(...args) }));
import { canPlayAwardClip } from "@/server/events/clip-playback";
const eventId = "11111111-1111-4111-8111-111111111111";
const content = { kind: "clip", reference: "ClipOne", creatorId: "host" };
beforeEach(() => {
	jest.resetAllMocks();
	publicView.mockResolvedValue({ ok: false });
	previewView.mockResolvedValue({ ok: false });
	principal.mockResolvedValue(null);
});
it("permits only a clip present in the public projection and owned by this creator", async () => {
	publicView.mockResolvedValue({ ok: true, event: { ownerId: "host", categories: [{ candidates: [{ content }] }] } });
	expect(await canPlayAwardClip("ClipOne", "host", eventId)).toBe(true);
	expect(await canPlayAwardClip("Other", "host", eventId)).toBe(false);
	expect(await canPlayAwardClip("ClipOne", "foreign", eventId)).toBe(false);
});
it("checks preview expiry and revocation without falling back to public or team access", async () => {
	expect(await canPlayAwardClip("ClipOne", "host", eventId, "expired")).toBe(false);
	expect(publicView).not.toHaveBeenCalled();
	expect(principal).not.toHaveBeenCalled();
	previewView.mockResolvedValue({ ok: true, event: { ownerId: "host", categories: [{ candidates: [{ content }] }] } });
	expect(await canPlayAwardClip("ClipOne", "host", eventId, "valid")).toBe(true);
});
it("allows team review clips only after the existing review permission check", async () => {
	principal.mockResolvedValue({ id: "editor" });
	review.mockResolvedValue({ ok: true, candidates: [{ content }], event: { frozenResults: {} } });
	expect(await canPlayAwardClip("ClipOne", "host", eventId)).toBe(true);
	review.mockResolvedValue({ ok: false });
	expect(await canPlayAwardClip("ClipOne", "host", eventId)).toBe(false);
	expect(await canPlayAwardClip("ClipOne", "host", "invalid")).toBe(false);
});
