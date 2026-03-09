export const CACHE_MAX = 200;
export const FONT_URL_DELIMITER = "||url||";

export function trimCache(map: Map<string, unknown>) {
	if (map.size <= CACHE_MAX) return;
	const firstKey = map.keys().next().value as string | undefined;
	if (firstKey) map.delete(firstKey);
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function parseThemeFontSetting(value?: string) {
	const raw = (value ?? "").trim();
	if (!raw) return { fontFamily: "inherit", fontUrl: "" };
	if (raw.includes(FONT_URL_DELIMITER)) {
		const [family, url] = raw.split(FONT_URL_DELIMITER);
		return {
			fontFamily: family?.trim() || "inherit",
			fontUrl: url?.trim() || "",
		};
	}
	return { fontFamily: raw, fontUrl: "" };
}

export function sanitizeFontCssUrl(value?: string) {
	const raw = (value ?? "").trim();
	if (!raw) return "";
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== "https:") return "";
		if (parsed.hostname.toLowerCase() !== "fonts.googleapis.com") return "";
		return parsed.toString();
	} catch {
		return "";
	}
}

export function getSlotOpacity(slot: "a" | "b", activeSlot: "a" | "b", isCrossfading: boolean, showPlayer: boolean) {
	if (!showPlayer) return 0;
	if (activeSlot === slot) return isCrossfading ? 0 : 1;
	return isCrossfading ? 1 : 0;
}
