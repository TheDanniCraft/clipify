/** @jest-environment node */
let clips: any;
try {
	clips = require("@/server/resources/clip-references");
} catch {}
describe("TDD-US2-REF Twitch reference resolution", () => {
	test.each(["MinecraftClip", "https://clips.twitch.tv/MinecraftClip", "https://www.twitch.tv/creator/clip/MinecraftClip?filter=clips"])("normalizes %s", (value) => {
		expect(clips?.parseClipReference).toEqual(expect.any(Function));
		expect(clips.parseClipReference(value)).toBe("MinecraftClip");
	});
	test.each(["https://evil.example/MinecraftClip", "https://clips.twitch.tv.evil.example/MinecraftClip", "https://user:password@clips.twitch.tv/MinecraftClip", "https://www.twitch.tv/creator", "http://clips.twitch.tv/MinecraftClip", "a title with spaces"])("rejects unsafe or ambiguous reference %s", (value) => {
		expect(clips?.parseClipReference).toEqual(expect.any(Function));
		expect(() => clips.parseClipReference(value)).toThrow("INVALID_INPUT");
	});
});

export {};
