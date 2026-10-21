/** @jest-environment node */
import { fetchStreamingChannel, updateStreamingMetadata, ProviderRequestError } from "@/server/runner/provider-api";
const original = global.fetch;
afterEach(() => {
	global.fetch = original;
	jest.restoreAllMocks();
});
function response(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
test("PC-2 obtains Twitch identity from token and never a browser supplied broadcaster ID", async () => {
	const fetcher = jest.fn().mockResolvedValueOnce(response({ data: [{ id: "42", display_name: "DanniCraft" }] }));
	global.fetch = fetcher;
	expect(await fetchStreamingChannel("twitch", "token", "client")).toEqual({ id: "42", name: "DanniCraft" });
	expect(fetcher.mock.calls[0][0]).toBe("https://api.twitch.tv/helix/users");
});
test("PC-4 sends only configured Twitch metadata", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
	global.fetch = fetcher;
	await updateStreamingMetadata({ provider: "twitch", accessToken: "token", clientId: "client", channelId: "42" }, { title: "Holiday", categoryId: "509658" });
	expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ title: "Holiday", game_id: "509658" });
});
test("provider denial is typed and excludes response body or tokens", async () => {
	global.fetch = jest.fn().mockResolvedValue(response({ message: "secret-token" }, 401));
	await expect(fetchStreamingChannel("twitch", "secret-token", "client")).rejects.toMatchObject({ code: "RECONNECT_REQUIRED", message: "Reconnect this channel to continue." });
	expect(ProviderRequestError).toBeDefined();
});
test("oversized provider responses are rejected", async () => {
	global.fetch = jest.fn().mockResolvedValue(response({ data: "x".repeat(300000) }));
	await expect(fetchStreamingChannel("twitch", "token", "client")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
});

test("PC-2 refresh preserves an offline token when the provider does not rotate it", async () => {
	const { refreshStreamingTokens } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(response({ access_token: "new-access", expires_in: 3600 }));
	expect(await refreshStreamingTokens("youtube", { clientId: "client", clientSecret: "secret", refreshToken: "existing-refresh" })).toMatchObject({ accessToken: "new-access", refreshToken: "existing-refresh" });
});
test.each([undefined, "New description"])("PC-4 YouTube title update preserves existing snippet fields and optional description %s", async (description) => {
	const fetcher = jest
		.fn()
		.mockResolvedValueOnce(response({ items: [{ snippet: { title: "Previous", categoryId: "20", description: "Existing description", tags: ["community"], defaultLanguage: "en" } }] }))
		.mockResolvedValueOnce(response({ id: "video" }));
	global.fetch = fetcher;
	await updateStreamingMetadata({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" }, { title: "Vacation", ...(description ? { description } : {}) }, "video");
	expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ id: "video", snippet: { title: "Vacation", categoryId: "20", description: description ?? "Existing description", tags: ["community"], defaultLanguage: "en" } });
});
test("PC-4 ambiguous YouTube bindings never select an arbitrary video", async () => {
	const { findYoutubeBroadcast } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(
		response({
			items: [
				{ id: "one", contentDetails: { boundStreamId: "stream" }, status: { lifeCycleStatus: "ready" } },
				{ id: "two", contentDetails: { boundStreamId: "stream" }, status: { lifeCycleStatus: "ready" } },
			],
		}),
	);
	await expect(findYoutubeBroadcast({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" }, "stream")).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE" });
});
test("PC-4 YouTube ignores completed broadcasts when resolving the selected stream", async () => {
	const { findYoutubeBroadcast } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(
		response({
			items: [
				{ id: "old", contentDetails: { boundStreamId: "stream" }, status: { lifeCycleStatus: "complete" } },
				{ id: "current", contentDetails: { boundStreamId: "stream" }, status: { lifeCycleStatus: "ready" } },
			],
		}),
	);
	expect(await findYoutubeBroadcast({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" }, "stream")).toBe("current");
});
test("PC-2 YouTube stream key selection is explicit and belongs to the connected channel", async () => {
	const { fetchStreamingKey } = await import("@/server/runner/provider-api");
	const body = { items: [{ id: "stream", snippet: { title: "My key" }, cdn: { ingestionInfo: { streamName: "private-key" } } }] };
	global.fetch = jest.fn().mockImplementation(async () => response(body));
	const context = { provider: "youtube" as const, accessToken: "token", clientId: "client", channelId: "channel" };
	expect(await fetchStreamingKey(context, "stream")).toBe("private-key");
	await expect(fetchStreamingKey(context, "foreign")).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE" });
});
test("PC-6 YouTube live eligibility failures explain the prerequisite instead of asking for another login", async () => {
	const { fetchYoutubeStreams } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(response({ error: { errors: [{ reason: "liveStreamingNotEnabled" }] } }, 403));
	await expect(fetchYoutubeStreams({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" })).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE", message: "Enable live streaming on this channel and try again." });
});
test("PC-6 an invalid offline grant asks for reconnecting instead of endlessly retrying", async () => {
	const { refreshStreamingTokens } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(response({ error: "invalid_grant" }, 400));
	await expect(refreshStreamingTokens("youtube", { clientId: "client", clientSecret: "secret", refreshToken: "revoked" })).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
});
test("PC-6 network failures and malformed success bodies return only safe retry messages", async () => {
	global.fetch = jest.fn().mockRejectedValueOnce(new Error("private-token")).mockResolvedValueOnce(new Response("not JSON")).mockResolvedValueOnce(new Response(null));
	for (let index = 0; index < 3; index++) await expect(fetchStreamingChannel("twitch", "token", "client")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", message: "The streaming service is unavailable. Please try again." });
});
test("PC-6 malformed legacy refresh cannot become usable tokens", async () => {
	const { refreshStreamingTokens } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(response({}));
	await expect(refreshStreamingTokens("twitch", { clientId: "client", clientSecret: "secret", refreshToken: "refresh" })).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
});

test("PC-4 category search encodes user input and returns only category identity", async () => {
	const { searchTwitchCategories } = await import("@/server/runner/provider-api");
	const fetcher = jest.fn().mockResolvedValue(response({ data: [{ id: "509658", name: "Just Chatting", box_art_url: "ignored" }] }));
	global.fetch = fetcher;
	const context = { provider: "twitch" as const, accessToken: "token", clientId: "client", channelId: "42" };
	expect(await searchTwitchCategories(context, "Game & Art")).toEqual([{ id: "509658", name: "Just Chatting" }]);
	expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("query")).toBe("Game & Art");
	expect(await searchTwitchCategories({ ...context, provider: "youtube" }, "Game")).toEqual([]);
	expect(fetcher).toHaveBeenCalledTimes(1);
	global.fetch = jest.fn().mockResolvedValue(response({ data: [{ id: "bad", name: "Invalid" }] }));
	await expect(searchTwitchCategories(context, "Game")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
});
test("PC-4 a missing YouTube broadcast cannot update a video", async () => {
	global.fetch = jest.fn();
	await expect(updateStreamingMetadata({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" }, { title: "Title" })).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE" });
	expect(global.fetch).not.toHaveBeenCalled();
});
test("PC-6 invalid channel and broadcast responses are unavailable rather than arbitrary identities", async () => {
	const { findYoutubeBroadcast, fetchStreamingKey } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockImplementation(async () => response({}));
	await expect(fetchStreamingChannel("twitch", "token", "client")).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE" });
	await expect(findYoutubeBroadcast({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" }, "stream")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
	await expect(fetchStreamingKey({ provider: "twitch", accessToken: "token", clientId: "client", channelId: "42" })).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE" });
	await expect(fetchStreamingKey({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" }, "stream")).rejects.toMatchObject({ code: "CHANNEL_UNAVAILABLE" });
});
test("PC-6 unreadable error responses and denied stream changes keep provider details private", async () => {
	global.fetch = jest
		.fn()
		.mockResolvedValueOnce(new Response("not JSON", { status: 500 }))
		.mockResolvedValueOnce(response({ error: { errors: [{ reason: "forbidden" }] } }, 403));
	await expect(fetchStreamingChannel("twitch", "token", "client")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
	await expect(fetchStreamingChannel("youtube", "token", "client")).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
});
test("PC-6 provider quota exhaustion is retryable and never requests another login", async () => {
	const { fetchYoutubeStreams } = await import("@/server/runner/provider-api");
	global.fetch = jest.fn().mockResolvedValue(response({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403));
	await expect(fetchYoutubeStreams({ provider: "youtube", accessToken: "token", clientId: "client", channelId: "channel" })).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
});
