/** @jest-environment node */
jest.mock("@/server/events/participant", () => ({ getEventParticipant: jest.fn(async () => ({ authUserId: "viewer", twitchId: "123" })) }));
jest.mock("@/server/events/uploads", () => ({ acceptAwardUpload: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/server/rate-limit", () => ({ consumeAppRateLimit: jest.fn(async () => ({ success: true })) }));
import { POST } from "@/app/api/events/[eventId]/upload/route";
import { acceptAwardUpload } from "@/server/events/uploads";
const eventId = "11111111-1111-4111-8111-111111111111",
	categoryId = "22222222-2222-4222-8222-222222222222";
function request(origin = "https://clipify.example") {
	return new Request(`https://clipify.example/api/events/${eventId}/upload?category=${categoryId}`, { method: "POST", headers: { Origin: origin, "Content-Type": "image/png", "X-Upload-Size": "16", "X-Upload-Title": encodeURIComponent("Bestes Bild") }, body: new Uint8Array(16) });
}
it("rejects cross-origin uploads before storage or participant side effects", async () => {
	expect((await POST(request("https://foreign.example"), { params: Promise.resolve({ eventId }) })).status).toBe(403);
	expect(acceptAwardUpload).not.toHaveBeenCalled();
});
it("uses verified participant identity and bounded upload metadata", async () => {
	const response = await POST(request(), { params: Promise.resolve({ eventId }) });
	expect(response.status).toBe(200);
	expect(acceptAwardUpload).toHaveBeenCalledWith("viewer", eventId, categoryId, expect.objectContaining({ size: 16, title: "Bestes Bild", mime: "image/png" }), expect.anything(), expect.anything());
});

it("recognizes the public same-origin host behind the deployment proxy", async () => {
	const original = request();
	const headers = new Headers(original.headers);
	headers.set("host", "clipify.example");
	headers.set("x-forwarded-proto", "https");
	const proxied = new Request(`http://internal-next:3000/api/events/${eventId}/upload?category=${categoryId}`, { method: "POST", headers, body: new Uint8Array(16) });
	expect((await POST(proxied, { params: Promise.resolve({ eventId }) })).status).toBe(200);
});

jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: jest.fn(async () => ({ kind: "session", authUserId: "team-actor", sessionId: "session", authenticatedAt: new Date() })) }));
jest.mock("@/server/events/public-read", () => ({ readPublicAwardEvent: jest.fn(async () => ({ ok: true, event: { ownerId: "actual-host" } })) }));
it("uses the verified team actor and stored event owner for a team upload", async () => {
	const { getEventParticipant } = await import("@/server/events/participant");
	jest.mocked(getEventParticipant).mockClear();
	const original = request();
	const response = await POST(new Request(`${original.url}&mode=team`, original), { params: Promise.resolve({ eventId }) });
	expect(response.status).toBe(200);
	expect(acceptAwardUpload).toHaveBeenLastCalledWith("team-actor", eventId, categoryId, expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ ownerId: "actual-host", principal: expect.objectContaining({ authUserId: "team-actor" }) }));
	expect(getEventParticipant).not.toHaveBeenCalled();
});
