import { parseAwardChatCatalog } from "@/app/lib/eventChat";
it("resolves channel overrides and 7TV aliases without accepting arbitrary image hosts", () => {
	const global = { data: [{ set_id: "subscriber", versions: [{ id: "1", image_url_2x: "https://static-cdn.jtvnw.net/global.png" }] }] },
		channel = { data: [{ set_id: "subscriber", versions: [{ id: "1", image_url_2x: "https://static-cdn.jtvnw.net/channel.png" }] }] };
	const emote = (name: string, url: string) => ({ name, data: { host: { url, files: [{ name: "2x.webp" }] } } });
	const result = parseAwardChatCatalog([global, channel], [{ emotes: [emote("peepoHappy", "//cdn.7tv.app/emote/id"), emote("unsafe", "https://evil.invalid")] }]);
	expect(result.badges["subscriber:1"]).toBe("https://static-cdn.jtvnw.net/channel.png");
	expect(result.emotes.peepoHappy).toBe("https://cdn.7tv.app/emote/id/2x.webp");
	expect(result.emotes.unsafe).toBeUndefined();
});

it("resolves an active 7TV badge and rejects badge images outside its CDN", async () => {
	const { parseAwardChatBadge } = await import("@/app/lib/eventChat");
	const response = (url: string) => ({ data: { users: { userByConnection: { style: { activeBadge: { id: "founder", name: "Founder", images: [{ url, scale: 2, mime: "image/webp" }] } } } } } });
	expect(parseAwardChatBadge(response("https://cdn.7tv.app/badge/founder/2x.webp"))).toEqual({ id: "founder", name: "Founder", url: "https://cdn.7tv.app/badge/founder/2x.webp" });
	expect(parseAwardChatBadge(response("https://evil.invalid/badge.webp"))).toBeNull();
	expect(parseAwardChatBadge({ data: { users: { userByConnection: null } } })).toBeNull();
});
