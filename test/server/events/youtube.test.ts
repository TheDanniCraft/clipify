jest.mock("server-only", () => ({}));
jest.mock("@/server/events/connections", () => ({ eventGoogleToken: jest.fn(async () => ({ accessToken: "creator-google-token", connection: { identityId: "UChost" } })) }));
jest.mock("@/server/runner/provider-api", () => ({ requestProviderJson: jest.fn() }));
import { requestProviderJson } from "@/server/runner/provider-api";
import { parseAwardYoutubeReference, resolveAwardYoutube, searchAwardYoutube } from "@/server/events/youtube";
const video = { id: "abcdefghijk", snippet: { title: "Video of the year", channelId: "UChost", channelTitle: "Host", publishedAt: "2026-03-01T12:00:00Z", thumbnails: { high: { url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" } } }, statistics: { viewCount: "120" }, contentDetails: { duration: "PT1H2M3S" }, status: { privacyStatus: "public", embeddable: true } };
it.each(["https://youtu.be/abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk", "https://youtube.com/shorts/abcdefghijk"])("parses supported YouTube URL %s", (url) => expect(parseAwardYoutubeReference(url)).toBe("abcdefghijk"));
it.each(["https://youtube.com.evil.test/watch?v=abcdefghijk", "javascript:abcdefghijk", "https://youtube.com/watch?v=short"])("rejects invalid YouTube reference %s", (url) => expect(() => parseAwardYoutubeReference(url)).toThrow("INVALID_INPUT"));
it("resolves metadata from the connected host channel without exposing credentials", async () => {
	jest.mocked(requestProviderJson).mockResolvedValue({ items: [video] });
	expect(await resolveAwardYoutube("host", "https://youtu.be/abcdefghijk")).toMatchObject({ kind: "youtube", reference: "abcdefghijk", title: video.snippet.title, views: 120, duration: 3723 });
});
it.each([{ snippet: { ...video.snippet, channelId: "UCother" } }, { status: { privacyStatus: "private", embeddable: true } }, { status: { privacyStatus: "public", embeddable: false } }])("rejects foreign or nonpublic/unplayable videos %j", async (change) => {
	jest.mocked(requestProviderJson).mockResolvedValue({ items: [{ ...video, ...change }] });
	await expect(resolveAwardYoutube("host", "abcdefghijk")).rejects.toThrow("INVALID_INPUT");
});
it("searches only the connected channel and returns full video metadata", async () => {
	jest
		.mocked(requestProviderJson)
		.mockResolvedValueOnce({ items: [{ id: { videoId: video.id } }] })
		.mockResolvedValueOnce({ items: [video] });
	expect(await searchAwardYoutube("host", "year")).toHaveLength(1);
	const url = new URL(jest.mocked(requestProviderJson).mock.calls.at(-2)![0]);
	expect(url.searchParams.get("channelId")).toBe("UChost");
	expect(url.searchParams.get("type")).toBe("video");
});
