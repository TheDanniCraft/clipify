/** @jest-environment node */
export {};
const token = jest.fn(),
	request = jest.fn();
jest.mock("@/server/tokens", () => ({ getAccessTokenInternal: (...args: unknown[]) => token(...args) }));
let clipValidation: any;
try {
	clipValidation = require("@/server/resources/clip-validation");
} catch {}
const clip = (id: string) => ({ id, title: "Fixture clip", duration: 12, broadcaster_id: "123", created_at: "2026-10-04T00:00:00Z", url: "https://clips.twitch.tv/" + id, secret: "private-provider-secret" });
describe("trusted provider clip validation", () => {
	const originalFetch = global.fetch;
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = request;
		process.env.TWITCH_CLIENT_ID = "fixture-client";
		token.mockResolvedValue({ accessToken: "fixture-provider-token" });
	});
	afterAll(() => {
		global.fetch = originalFetch;
	});
	test("validates requested identities, preserves caller order and strips private fields", async () => {
		expect(clipValidation?.resolveValidatedPlaylistClips).toEqual(expect.any(Function));
		request.mockResolvedValue(new Response(JSON.stringify({ data: [clip("ClipSecond"), clip("ClipFirst")] }), { status: 200 }));
		const result = await clipValidation.resolveValidatedPlaylistClips("owner", ["ClipFirst", "ClipSecond"]);
		expect(result.map((item: any) => item.id)).toEqual(["ClipFirst", "ClipSecond"]);
		expect(JSON.stringify(result)).not.toMatch(/private-provider-secret|secret|accessToken/);
		expect(token).toHaveBeenCalledWith("owner");
		const [url, options] = request.mock.calls[0];
		expect(new URL(url).origin).toBe("https://api.twitch.tv");
		expect(new URL(url).searchParams.getAll("id")).toEqual(["ClipFirst", "ClipSecond"]);
		expect(options.headers.Authorization).toBe("Bearer fixture-provider-token");
		expect(options.signal).toBeInstanceOf(AbortSignal);
		expect(options.redirect).toBe("error");
	});
	test("missing creator credentials do not call the provider", async () => {
		expect(clipValidation?.resolveValidatedPlaylistClips).toEqual(expect.any(Function));
		token.mockResolvedValue(null);
		await expect(clipValidation.resolveValidatedPlaylistClips("owner", ["ClipFirst"])).rejects.toThrow("SERVICE_UNAVAILABLE");
		expect(request).not.toHaveBeenCalled();
	});
	test.each([
		["missing", []],
		["unexpected", [clip("OtherClip")]],
		["duplicate", [clip("ClipFirst"), clip("ClipFirst")]],
		["invalid", [{ ...clip("ClipFirst"), duration: -1 }]],
	])("%s provider metadata fails closed", async (_, values) => {
		expect(clipValidation?.resolveValidatedPlaylistClips).toEqual(expect.any(Function));
		request.mockResolvedValue(new Response(JSON.stringify({ data: values }), { status: 200 }));
		await expect(clipValidation.resolveValidatedPlaylistClips("owner", ["ClipFirst"])).rejects.toThrow("INVALID_INPUT");
	});
	test("provider failure is a safe retryable error", async () => {
		expect(clipValidation?.resolveValidatedPlaylistClips).toEqual(expect.any(Function));
		request.mockResolvedValue(new Response("private upstream failure", { status: 503 }));
		await expect(clipValidation.resolveValidatedPlaylistClips("owner", ["ClipFirst"])).rejects.toThrow("SERVICE_UNAVAILABLE");
	});
	test("batches at most 100 identifiers per provider request", async () => {
		expect(clipValidation?.resolveValidatedPlaylistClips).toEqual(expect.any(Function));
		request.mockImplementation(async (url: string) => new Response(JSON.stringify({ data: new URL(url).searchParams.getAll("id").map(clip) }), { status: 200 }));
		const ids = Array.from({ length: 101 }, (_, i) => `Clip${i}`);
		const result = await clipValidation.resolveValidatedPlaylistClips("owner", ids);
		expect(result).toHaveLength(101);
		expect(request).toHaveBeenCalledTimes(2);
		expect(new URL(request.mock.calls[0][0]).searchParams.getAll("id")).toHaveLength(100);
	});
});
