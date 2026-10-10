/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/server/notifications/twitch-account-access", () => ({ markInvalidTwitchRefresh: jest.fn() }));
import { markInvalidTwitchRefresh } from "@/server/notifications/twitch-account-access";
jest.mock("@better-auth/core/oauth2", () => ({ refreshAccessTokenRequest: jest.fn(async () => ({ body: "fixture-request", headers: {} })), getOAuth2Tokens: jest.fn((tokens) => tokens) }));
jest.mock("@/auth/environment", () => ({ requiredAuthSetting: () => "fixture-setting" }));
import { refreshTwitchAccessToken } from "@/auth/providers/twitch-refresh";
const originalFetch = global.fetch;
beforeEach(() => {
	jest.useRealTimers();
	jest.clearAllMocks();
	global.fetch = jest.fn();
});
afterEach(() => {
	jest.useRealTimers();
	jest.clearAllMocks();
	global.fetch = originalFetch;
});
const valid = { access_token: "fixture-access", refresh_token: "fixture-refresh", expires_in: 3600 };
test("valid refresh stays on the pinned provider endpoint and preserves validated tokens", async () => {
	(fetch as jest.Mock).mockResolvedValue(Response.json(valid));
	expect(await refreshTwitchAccessToken("fixture-old-refresh")).toEqual(valid);
	expect(fetch).toHaveBeenCalledWith("https://id.twitch.tv/oauth2/token", expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) }));
});
test.each([null, [], { ...valid, access_token: " " }, { ...valid, refresh_token: 42 }, { ...valid, expires_in: 0 }, { ...valid, expires_in: 1.5 }, { ...valid, expires_in: Number.MAX_SAFE_INTEGER }].map((body) => ({ body })))("invalid token response %p stays a safe provider failure", async ({ body }) => {
	(fetch as jest.Mock).mockResolvedValue(Response.json(body));
	await expect(refreshTwitchAccessToken("fixture-refresh")).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
});
test("missing body is rejected", async () => {
	(fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 200 }));
	await expect(refreshTwitchAccessToken("fixture-refresh")).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
});
test("oversized declared response swallows rejected cancellation", async () => {
	const body = new ReadableStream({
		cancel() {
			return Promise.reject(new Error("fixture cancellation"));
		},
	});
	(fetch as jest.Mock).mockResolvedValue(new Response(body, { headers: { "content-length": String(64 * 1024 + 1) } }));
	await expect(refreshTwitchAccessToken("fixture-refresh")).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
	await Promise.resolve();
});
test("oversized streamed response swallows rejected reader cancellation", async () => {
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(64 * 1024 + 1));
		},
		cancel() {
			return Promise.reject(new Error("fixture cancellation"));
		},
	});
	(fetch as jest.Mock).mockResolvedValue(new Response(body));
	await expect(refreshTwitchAccessToken("fixture-refresh")).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
	await Promise.resolve();
});
test("bounded deadline aborts stalled transport without real waiting", async () => {
	jest.useFakeTimers();
	let signal: AbortSignal | undefined;
	(fetch as jest.Mock).mockImplementation((_url, init) => {
		signal = init.signal;
		return new Promise(() => {});
	});
	const pending = refreshTwitchAccessToken("fixture-refresh");
	const assertion = expect(pending).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
	await jest.advanceTimersByTimeAsync(10000);
	await assertion;
	expect(signal?.aborted).toBe(true);
	expect(jest.getTimerCount()).toBe(0);
});

test.each([400, 401])("only explicit invalid refresh responses (%s) mark the account for disablement", async (status) => {
	(fetch as jest.Mock).mockResolvedValue(Response.json({ message: "Invalid refresh token", status }, { status }));
	await expect(refreshTwitchAccessToken("fixture")).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
	expect(markInvalidTwitchRefresh).toHaveBeenCalledTimes(1);
});
test.each([429, 500, 503])("provider failure %s does not disable the account", async (status) => {
	(fetch as jest.Mock).mockResolvedValue(Response.json({ message: "Unavailable" }, { status }));
	await expect(refreshTwitchAccessToken("fixture")).rejects.toThrow("PROVIDER_REFRESH_UNAVAILABLE");
	expect(markInvalidTwitchRefresh).not.toHaveBeenCalled();
});
