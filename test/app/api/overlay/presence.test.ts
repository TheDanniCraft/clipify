/** @jest-environment node */
import { POST } from "@/app/api/overlay/presence/route";

const authorize = jest.fn();
const record = jest.fn();
const rateLimit = jest.fn();
const capture = jest.fn();
jest.mock("@/server/overlays", () => ({ requireOverlaySecretAccessInternal: (...args: unknown[]) => authorize(...args) }));
jest.mock("@lib/overlayPresenceServer", () => ({ recordOverlayPresence: (...args: unknown[]) => record(...args) }));
jest.mock("@actions/rateLimit", () => ({ tryRateLimit: (...args: unknown[]) => rateLimit(...args) }));
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: (...args: unknown[]) => capture(...args) }));
const body = { overlayId: "11111111-1111-4111-8111-111111111111", instanceId: "22222222-2222-4222-8222-222222222222", sequence: 1, active: true };
const request = (payload: unknown = body, secret = "secret") => new Request("https://clipify.us/api/overlay/presence", { method: "POST", headers: secret ? { authorization: `Bearer ${secret}` } : {}, body: JSON.stringify(payload) });
beforeEach(() => {
	jest.clearAllMocks();
	authorize.mockResolvedValue({ status: "active" });
	rateLimit.mockResolvedValue({ success: true });
	record.mockResolvedValue(undefined);
});

it("accepts authenticated source reports through the current runtime policy", async () => {
	expect((await POST(request())).status).toBe(204);
	expect(authorize).toHaveBeenCalledWith(body.overlayId, "secret");
	expect(record).toHaveBeenCalledWith(body);
	expect(rateLimit.mock.calls[0][0].identifier).not.toContain("secret");
});
it("rejects missing and invalid secrets and runtime access denial", async () => {
	expect((await POST(request(body, ""))).status).toBe(401);
	authorize.mockResolvedValue(null);
	expect((await POST(request())).status).toBe(401);
	expect(record).not.toHaveBeenCalled();
});
it("rejects paused overlays", async () => {
	authorize.mockResolvedValue({ status: "paused" });
	expect((await POST(request())).status).toBe(403);
	expect(record).not.toHaveBeenCalled();
});
it.each([
	{ ...body, active: "true" },
	{ ...body, sequence: 0 },
	{ ...body, sequence: 1.5 },
	{ ...body, instanceId: "invalid" },
	{ ...body, overlayId: "invalid" },
	{ ...body, extra: true },
])("rejects invalid report %j", async (payload) => {
	expect((await POST(request(payload))).status).toBe(400);
	expect(authorize).not.toHaveBeenCalled();
	expect(record).not.toHaveBeenCalled();
});
it("rejects malformed and oversized JSON", async () => {
	const malformed = new Request("https://clipify.us/api/overlay/presence", { method: "POST", headers: { authorization: "Bearer secret" }, body: "{" });
	expect((await POST(malformed)).status).toBe(400);
	expect((await POST(request("x".repeat(1025)))).status).toBe(413);
});
it("rate limits before authorizing or writing", async () => {
	rateLimit.mockResolvedValue({ success: false });
	const response = await POST(request());
	expect(response.status).toBe(429);
	expect(response.headers.get("Retry-After")).toBe("60");
	expect(authorize).not.toHaveBeenCalled();
	expect(record).not.toHaveBeenCalled();
});
it("reports unexpected storage errors", async () => {
	record.mockRejectedValue(new Error("database unavailable"));
	expect((await POST(request())).status).toBe(500);
	expect(capture).toHaveBeenCalled();
});
