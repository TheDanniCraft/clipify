/** Preserve real public Twitch CDN images; never generate a replacement URL. */
export function publicTwitchImageUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol === "https:" && !url.username && !url.password && (url.hostname.endsWith(".jtvnw.net") || url.hostname.endsWith(".twitchcdn.net"))) return url.href;
	} catch {
		return null;
	}
	return null;
}
