import { z } from "zod";
const cdn = z.url().refine((value) => {
	try {
		return ["static-cdn.jtvnw.net", "cdn.7tv.app"].includes(new URL(value).hostname) && new URL(value).protocol === "https:";
	} catch {
		return false;
	}
});
export type AwardChatCatalog = { badges: Record<string, string>; emotes: Record<string, string>; warnings: string[] };
export function parseAwardChatCatalog(badgeSets: unknown[], emoteSets: unknown[]): AwardChatCatalog {
	const result: AwardChatCatalog = { badges: {}, emotes: {}, warnings: [] };
	const badges = z.object({ data: z.array(z.object({ set_id: z.string().max(100), versions: z.array(z.object({ id: z.string().max(100), image_url_2x: cdn })).max(1000) })).max(1000) });
	for (const input of badgeSets) {
		const data = badges.safeParse(input).data;
		if (data) for (const set of data.data) for (const version of set.versions) result.badges[`${set.set_id}:${version.id}`] = version.image_url_2x;
	}
	const emotes = z.object({ emotes: z.array(z.object({ name: z.string().max(100), data: z.object({ host: z.object({ url: z.string().max(500), files: z.array(z.object({ name: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/) })).max(50) }) }) })).max(5000) });
	for (const input of emoteSets) {
		const data = emotes.safeParse(input).data;
		if (data)
			for (const emote of data.emotes) {
				const file = emote.data.host.files.find((file) => file.name === "2x.webp") ?? emote.data.host.files.find((file) => file.name.endsWith(".webp"));
				if (!file) continue;
				const url = cdn.safeParse(`${emote.data.host.url.startsWith("//") ? "https:" : ""}${emote.data.host.url}/${file.name}`);
				if (url.success) result.emotes[emote.name] = url.data;
			}
	}
	return result;
}

export type AwardChatBadge = { id: string; name: string; url: string };
export function parseAwardChatBadge(input: unknown): AwardChatBadge | null {
	const badge = z.object({ id: z.string().max(100), name: z.string().max(100), images: z.array(z.object({ url: z.string().max(1000), scale: z.number(), mime: z.string() })).max(30) });
	const response = z.object({ data: z.object({ users: z.object({ userByConnection: z.object({ style: z.object({ activeBadge: badge.nullable() }) }).nullable() }) }) }).safeParse(input);
	const value = response.data?.data.users.userByConnection?.style.activeBadge;
	if (!value) return null;
	const image = [...value.images].sort((a, b) => Math.abs(a.scale - 2) - Math.abs(b.scale - 2)).find((image) => /^image\/(webp|avif|png|gif)$/.test(image.mime) && cdn.safeParse(image.url).success && new URL(image.url).hostname === "cdn.7tv.app");
	return image ? { id: value.id, name: value.name, url: image.url } : null;
}

export const awardChatMessageSchema = z.object({
	broadcaster_user_id: z.string().max(200),
	chatter_user_id: z
		.string()
		.regex(/^\d{1,30}$/)
		.optional(),
	message_id: z.string().max(200),
	chatter_user_login: z.string().max(100),
	chatter_user_name: z.string().max(100),
	color: z
		.string()
		.regex(/^#[0-9a-f]{6}$/i)
		.or(z.literal("")),
	message: z.object({
		text: z.string().max(2000),
		fragments: z
			.array(
				z.object({
					type: z.string().max(30),
					text: z.string().max(2000),
					emote: z
						.object({ id: z.string().regex(/^[A-Za-z0-9_:-]{1,150}$/) })
						.nullable()
						.optional(),
				}),
			)
			.max(100),
	}),
	badges: z.array(z.object({ set_id: z.string().max(100), id: z.string().max(100) })).max(30),
});
export type AwardChatMessage = { id: string; userId?: string; sevenTvBadge?: AwardChatBadge; login: string; name: string; color: string; text: string; fragments: z.infer<typeof awardChatMessageSchema>["message"]["fragments"]; badges: z.infer<typeof awardChatMessageSchema>["badges"]; at: number };
