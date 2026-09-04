export function isMemberCardId(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function memberCardPath(cardId: string): string {
	return `/members/${encodeURIComponent(cardId)}`;
}

export function memberCardImagePath(cardId: string): string {
	return `/api/member-card/public/${encodeURIComponent(cardId)}`;
}

// Avatars originate from Twitch. Never let the image renderer fetch arbitrary
// destinations from stored profile data.
export function memberAvatarUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "static-cdn.jtvnw.net" && !url.username && !url.password && !url.port ? url.href : null;
	} catch {
		return null;
	}
}
