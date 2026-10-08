import "server-only";
import { z } from "zod";
import { overlayPatchSchema } from "@/server/mcp/schemas";
import { OverlayType, PlaybackMode, type Overlay } from "@types";
const FONT_URL_DELIMITER = "||url||";
const ALLOWED_FONT_CSS_HOSTS = new Set(["fonts.googleapis.com"]);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_PATTERN = /^rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const HSL_COLOR_PATTERN = /^hsla?\(\s*(?:360|3[0-5]\d|[12]?\d?\d)(?:\.\d+)?\s*,\s*(?:100|[1-9]?\d)(?:\.\d+)?%\s*,\s*(?:100|[1-9]?\d)(?:\.\d+)?%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;

function clampInteger(value: number | null | undefined, min: number, max: number, fallback: number) {
	return Math.round(Math.max(min, Math.min(max, value ?? fallback)));
}

export function normalizeCreatorFilters(values: string[] | null | undefined) {
	return Array.from(new Set((values ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean)));
}

function sanitizeThemeFontFamilyValue(value: string | null | undefined) {
	if (value === null || value === undefined) return "inherit";
	const trimmed = value.trim();
	if (!trimmed) return "inherit";
	if (trimmed.length > 200) return "inherit";
	if (trimmed.includes(FONT_URL_DELIMITER)) return "inherit";
	if (!/^[-,./\s"'0-9A-Za-z]+$/.test(trimmed)) return "inherit";
	return trimmed;
}

function sanitizeThemeFontUrl(value: string | null | undefined) {
	if (value === null || value === undefined) return "";
	const trimmed = value.trim();
	if (!trimmed) return "";

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "https:") return "";
		if (!ALLOWED_FONT_CSS_HOSTS.has(parsed.hostname.toLowerCase())) return "";
		return parsed.toString();
	} catch {
		return "";
	}
}

function sanitizeThemeFontSetting(value: string | null | undefined) {
	const raw = (value ?? "").trim();
	if (!raw) return "inherit";

	if (!raw.includes(FONT_URL_DELIMITER)) {
		return sanitizeThemeFontFamilyValue(raw);
	}

	const [rawFamily, rawUrl] = raw.split(FONT_URL_DELIMITER);
	const family = sanitizeThemeFontFamilyValue(rawFamily);
	const safeUrl = sanitizeThemeFontUrl(rawUrl);
	if (!safeUrl) return family;
	return `${family}${FONT_URL_DELIMITER}${safeUrl}`;
}

function sanitizeCssColor(value: string | null | undefined, fallback: string) {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return fallback;
	if (trimmed.toLowerCase() === "transparent") return "transparent";
	if (HEX_COLOR_PATTERN.test(trimmed) || RGB_COLOR_PATTERN.test(trimmed) || HSL_COLOR_PATTERN.test(trimmed)) return trimmed;
	return fallback;
}

export function buildOverlayUpdatePayload(next: Overlay, advancedAllowed: boolean) {
	// Only assign playlistId when the overlay type is set to Playlist to ensure data consistency
	const playlistId = next.type === OverlayType.Playlist ? (next.playlistId ?? null) : null;
	const base = {
		name: next.name,
		status: next.status,
		type: next.type,
		playlistId,
		updatedAt: new Date(),
	};
	if (!advancedAllowed) return base;

	const playbackMode = (() => {
		if (next.type !== OverlayType.Playlist && next.playbackMode === PlaybackMode.Order) return PlaybackMode.Random;
		return next.playbackMode;
	})();

	return {
		...base,
		rewardId: next.rewardId ?? null,
		minClipDuration: next.minClipDuration,
		maxClipDuration: next.maxClipDuration,
		maxDurationMode: next.maxDurationMode,
		blacklistWords: next.blacklistWords,
		categoriesOnly: next.categoriesOnly ?? [],
		categoriesBlocked: next.categoriesBlocked ?? [],
		minClipViews: next.minClipViews,
		playbackMode,
		preferCurrentCategory: !!next.preferCurrentCategory,
		clipCreatorsOnly: normalizeCreatorFilters(next.clipCreatorsOnly),
		clipCreatorsBlocked: normalizeCreatorFilters(next.clipCreatorsBlocked),
		clipPackSize: Math.max(25, Math.min(500, next.clipPackSize ?? 100)),
		playerVolume: Math.max(0, Math.min(100, next.playerVolume ?? 50)),
		showChannelInfo: !!next.showChannelInfo,
		showClipInfo: !!next.showClipInfo,
		showTimer: !!next.showTimer,
		showProgressBar: !!next.showProgressBar,
		overlayInfoFadeOutSeconds: Math.max(0, Math.min(30, next.overlayInfoFadeOutSeconds ?? 6)),
		themeFontFamily: sanitizeThemeFontSetting(next.themeFontFamily),
		themeTextColor: sanitizeCssColor(next.themeTextColor, "#FFFFFF"),
		themeAccentColor: sanitizeCssColor(next.themeAccentColor, "#7C3AED"),
		themeBackgroundColor: sanitizeCssColor(next.themeBackgroundColor, "rgba(10,10,10,0.65)"),
		progressBarStartColor: sanitizeCssColor(next.progressBarStartColor, "#26018E"),
		progressBarEndColor: sanitizeCssColor(next.progressBarEndColor, "#8D42F9"),
		borderSize: Math.max(0, Math.min(32, next.borderSize ?? 0)),
		borderRadius: Math.max(0, Math.min(48, next.borderRadius ?? 10)),
		effectScanlines: !!next.effectScanlines,
		effectStatic: !!next.effectStatic,
		effectCrt: !!next.effectCrt,
		channelInfoX: clampInteger(next.channelInfoX, 0, 100, 0),
		channelInfoY: clampInteger(next.channelInfoY, 0, 100, 0),
		clipInfoX: clampInteger(next.clipInfoX, 0, 100, 100),
		clipInfoY: clampInteger(next.clipInfoY, 0, 100, 100),
		timerX: clampInteger(next.timerX, 0, 100, 100),
		timerY: clampInteger(next.timerY, 0, 100, 0),
		channelScale: clampInteger(next.channelScale, 50, 250, 100),
		clipScale: clampInteger(next.clipScale, 50, 250, 100),
		timerScale: clampInteger(next.timerScale, 50, 250, 100),
	};
}

/** Browser reward selection is separate from the deliberately narrower MCP protocol. */
export const browserOverlayPatchSchema = z
	.object({
		...overlayPatchSchema.shape,
		rewardId: z.string().min(1).max(255).nullable().optional(),
		themeFontFamily: z.string().max(2048).optional(),
	})
	.strict()
	.refine((patch) => Object.keys(patch).length > 0, "At least one configuration field is required");
