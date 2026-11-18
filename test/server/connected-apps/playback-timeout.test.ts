/** @jest-environment node */
jest.mock("server-only", () => ({}));
const token = jest.fn();
const reserve = jest.fn();
jest.mock("@/server/tokens", () => ({ getAccessTokenResultInternal: (...args: unknown[]) => token(...args) }));
jest.mock("@/server/clip-download-limit", () => ({ reserveTwitchClipDownloadRequest: (...args: unknown[]) => reserve(...args) }));
jest.mock("@lib/instanceHealth", () => ({ incrementClipFetchFallback: jest.fn(), incrementClipFetchFallbackReason: jest.fn(), incrementClipFetchRateLimited: jest.fn(), incrementClipFetchV1: jest.fn(), incrementClipFetchV2: jest.fn(), recordTwitchRateLimit: jest.fn() }));
jest.mock("@lib/operationalHealth", () => ({ operationalCount: jest.fn() }));
import axios from "axios";
import { resolveTwitchClipPlaybackUrl } from "@/server/clip-playback-resolver";

beforeEach(() => {
	jest.restoreAllMocks();
	token.mockReset();
	reserve.mockReset().mockResolvedValue({ allowed: true });
});

test("bounds the authenticated Twitch playback request", async () => {
	token.mockResolvedValue({ token: { accessToken: "token", scope: ["channel:manage:clips"] } });
	const get = jest.spyOn(axios, "get").mockResolvedValue({ status: 200, headers: {}, data: { data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/a.mp4" }] } } as never);
	await expect(resolveTwitchClipPlaybackUrl("ClipA", "creator")).resolves.toContain("twitchcdn.net");
	expect(get).toHaveBeenCalledWith("https://api.twitch.tv/helix/clips/downloads", expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 10_000 }));
});

test("bounds the GraphQL fallback with the caller's cancellation signal", async () => {
	token.mockResolvedValue({ token: null, reason: "missing" });
	const parent = new AbortController();
	const post = jest.spyOn(axios, "post").mockResolvedValue({ data: [{ data: { clip: { videoQualities: [{ quality: "1080", sourceURL: "https://production.assets.clips.twitchcdn.net/a.mp4" }], playbackAccessToken: { signature: "signature", value: "token" } } } }] } as never);
	await expect(resolveTwitchClipPlaybackUrl("ClipA", "creator", parent.signal)).resolves.toContain("twitchcdn.net");
	const request = post.mock.calls[0]?.[2];
	expect(request).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 10_000 }));
	parent.abort();
	expect(request?.signal?.aborted).toBe(true);
});
