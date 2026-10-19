/** @jest-environment node */
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: jest.fn() }));
jest.mock("@/server/runner/provider-connections", () => ({ completeStreamingConnection: jest.fn() }));
import { GET } from "@/app/runner/connect/[provider]/callback/route";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { completeStreamingConnection } from "@/server/runner/provider-connections";
beforeEach(() => jest.clearAllMocks());
test("PC-6 callback refuses logged-out exchanges", async () => {
	jest.mocked(getVerifiedSessionPrincipal).mockResolvedValue(null);
	const result = await GET(new Request("https://clipify.us/runner/connect/twitch/callback?code=secret&state=nonce"), { params: Promise.resolve({ provider: "twitch" }) });
	expect(completeStreamingConnection).not.toHaveBeenCalled();
	expect(await result.text()).not.toContain("secret");
	expect(result.headers.get("cache-control")).toContain("no-store");
});
test("PC-6 callback emits only a connection result to same-origin opener with restrictive CSP", async () => {
	jest.mocked(getVerifiedSessionPrincipal).mockResolvedValue({ kind: "session", authUserId: "auth", sessionId: "session", authenticatedAt: new Date() });
	jest.mocked(completeStreamingConnection).mockResolvedValue({ success: true, connection: { id: "connection", provider: "twitch", channelName: "name" } });
	const result = await GET(new Request("https://clipify.us/runner/connect/twitch/callback?code=secret&state=nonce"), { params: Promise.resolve({ provider: "twitch" }) });
	const body = await result.text();
	expect(body).toContain("runner-provider-connection");
	expect(body).toContain("connection");
	expect(body).not.toContain("secret");
	expect(result.headers.get("content-security-policy")).toContain("default-src 'none'");
});
test.each(["unknown", "twitch"])("PC-6 %s cancellation or invalid provider does not exchange a code", async (provider) => {
	jest.mocked(getVerifiedSessionPrincipal).mockResolvedValue({ kind: "session", authUserId: "auth", sessionId: "session", authenticatedAt: new Date() });
	const result = await GET(new Request(`https://clipify.us/runner/connect/${provider}/callback?error=access_denied`), { params: Promise.resolve({ provider }) });
	expect(completeStreamingConnection).not.toHaveBeenCalled();
	expect(await result.text()).toContain("Could not connect");
});
test("PC-6 missing callback values, rejected state and provider failures produce a safe result", async () => {
	jest.mocked(getVerifiedSessionPrincipal).mockResolvedValue({ kind: "session", authUserId: "auth", sessionId: "session", authenticatedAt: new Date() });
	jest.mocked(completeStreamingConnection).mockResolvedValueOnce({ success: false, code: "INVALID_INPUT", error: "Expired" });
	const response = await GET(new Request("https://clipify.us/runner/connect/twitch/callback"), { params: Promise.resolve({ provider: "twitch" }) });
	expect(completeStreamingConnection).toHaveBeenCalledWith(expect.anything(), "twitch", "", "");
	expect(await response.text()).toContain("Could not connect");
	jest.mocked(completeStreamingConnection).mockRejectedValueOnce(new Error("private provider response"));
	const failure = await GET(new Request("https://clipify.us/runner/connect/twitch/callback?state=state&code=code"), { params: Promise.resolve({ provider: "twitch" }) });
	const body = await failure.text();
	expect(body).not.toContain("private provider response");
	expect(body).toContain("Could not connect");
});
