import { isMemberCardId, memberAvatarUrl, memberCardImagePath, memberCardPath } from "@lib/memberCardLinks";

const id = "025dcf9a-10f5-47ad-a6f0-cbe1151b6fbc";
describe("member card links", () => {
	it("uses a UUID for page and image links", () => {
		expect(isMemberCardId(id)).toBe(true);
		expect(memberCardPath(id)).toBe(`/members/${id}`);
		expect(memberCardImagePath(id)).toBe(`/api/member-card/public/${id}`);
	});
	it.each(["clipper", "12345678", "", "../account", id + "'"])("rejects non-UUID lookup %s", (value) => {
		expect(isMemberCardId(value)).toBe(false);
	});
	it("allows the Twitch avatar CDN", () => {
		expect(memberAvatarUrl("https://static-cdn.jtvnw.net/avatar.png")).toBe("https://static-cdn.jtvnw.net/avatar.png");
	});
	it.each(["http://static-cdn.jtvnw.net/avatar.png", "https://localhost/avatar.png", "https://static-cdn.jtvnw.net.evil.test/a.png", "https://name:password@static-cdn.jtvnw.net/a.png", "https://static-cdn.jtvnw.net:444/a.png", "", null])("rejects an unsafe avatar source %s", (value) => {
		expect(memberAvatarUrl(value)).toBeNull();
	});
});
