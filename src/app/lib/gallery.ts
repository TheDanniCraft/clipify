import type { Gallery, GalleryLayout, GalleryLiveSort, GallerySource, GalleryTimeWindow, TwitchClip } from "@types";
import { FREE_PLAYLIST_CLIP_LIMIT } from "@lib/constants";

export const FREE_GALLERY_LIMIT = 1;
// Keep the Free live-gallery allowance aligned with the clips a Free curated
// playlist can contain. A creator should not lose usable clips merely by
// switching the same showcase from curated to live mode.
export const FREE_GALLERY_LIVE_LIMIT = FREE_PLAYLIST_CLIP_LIMIT;
export const PRO_GALLERY_LIVE_LIMIT = 100;

const COLOR_PATTERN = /^(?:#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;
const FREE_SORTS = new Set<GalleryLiveSort>(["newest", "most_viewed"]);
const FREE_WINDOWS = new Set<GalleryTimeWindow>(["today", "7d", "30d", "all"]);

export type GalleryPatch = Partial<Omit<Gallery, "id" | "ownerId" | "createdAt" | "updatedAt">>;

const clamp = (value: number | null | undefined, minimum: number, maximum: number, fallback: number) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback;
};

const strings = (value: string[] | null | undefined) => Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean))).slice(0, 100);

const color = (value: string | null | undefined, fallback: string) => (value && COLOR_PATTERN.test(value.trim()) ? value.trim() : fallback);

function contrastRatio(left: string, right: string) {
	const luminance = (hex: string) => {
		const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((value) => Number.parseInt(value, 16) / 255).map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	if (!/^#[0-9a-f]{6}$/i.test(left) || !/^#[0-9a-f]{6}$/i.test(right)) return Number.POSITIVE_INFINITY;
	const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
	return (bright + 0.05) / (dark + 0.05);
}

export function closestFreeTimeWindow(start: Date | null, end: Date | null, now = new Date()): GalleryTimeWindow {
	if (!start) return "all";
	const until = end && end < now ? end : now;
	const days = Math.max(0, (until.getTime() - start.getTime()) / 86_400_000);
	if (days <= 1) return "today";
	if (days <= 14) return "7d";
	if (days <= 60) return "30d";
	return "all";
}

export function normalizeGalleryPatch(current: Gallery, patch: GalleryPatch, isPro: boolean): GalleryPatch {
	const nextSource: GallerySource = patch.source === "live" || patch.source === "curated" ? patch.source : current.source;
	const nextLayout: GalleryLayout = ["grid", "list", "carousel"].includes(String(patch.layout)) ? (patch.layout as GalleryLayout) : current.layout;
	const merged = { ...current, ...patch };
	const normalized: GalleryPatch = {
		name: String(merged.name).trim().slice(0, 120) || current.name,
		published: Boolean(merged.published),
		source: nextSource,
		playlistId: nextSource === "curated" ? merged.playlistId : null,
		layout: nextLayout,
		gridAuto: Boolean(merged.gridAuto),
		gridMobileColumns: clamp(merged.gridMobileColumns, 1, 2, 1),
		gridTabletColumns: clamp(merged.gridTabletColumns, 2, 4, 3),
		gridDesktopColumns: clamp(merged.gridDesktopColumns, 2, 6, 4),
		listDensity: merged.listDensity === "compact" ? "compact" : "comfortable",
		carouselMobileCards: clamp(merged.carouselMobileCards, 1, 2, 1),
		carouselTabletCards: clamp(merged.carouselTabletCards, 1, 4, 2),
		carouselDesktopCards: clamp(merged.carouselDesktopCards, 1, 6, 3),
		carouselShowNavigation: Boolean(merged.carouselShowNavigation),
		carouselShowIndicators: Boolean(merged.carouselShowIndicators),
		showTitle: Boolean(merged.showTitle),
		showCreator: Boolean(merged.showCreator),
		showViews: Boolean(merged.showViews),
		showDuration: Boolean(merged.showDuration),
		showCreatedAt: Boolean(merged.showCreatedAt),
		liveSort: isPro && merged.liveSort === "stable_random" ? "stable_random" : FREE_SORTS.has(merged.liveSort) ? merged.liveSort : "newest",
		liveTimeWindow: isPro && merged.liveTimeWindow === "custom" ? "custom" : FREE_WINDOWS.has(merged.liveTimeWindow) ? merged.liveTimeWindow : "30d",
		liveCustomStart: isPro && merged.liveTimeWindow === "custom" ? merged.liveCustomStart : null,
		liveCustomEnd: isPro && merged.liveTimeWindow === "custom" ? merged.liveCustomEnd : null,
		liveResultLimit: clamp(merged.liveResultLimit, 1, isPro ? PRO_GALLERY_LIVE_LIMIT : FREE_GALLERY_LIVE_LIMIT, 12),
		includeCategories: isPro ? strings(merged.includeCategories) : [],
		excludeCategories: isPro ? strings(merged.excludeCategories) : [],
		minimumViews: isPro ? clamp(merged.minimumViews, 0, 1_000_000_000, 0) : 0,
		minimumDuration: isPro ? clamp(merged.minimumDuration, 0, 3600, 0) : 0,
		maximumDuration: isPro ? clamp(merged.maximumDuration, 0, 3600, 0) : 0,
		titleBlacklist: isPro ? strings(merged.titleBlacklist) : [],
		creatorAllowlist: isPro ? strings(merged.creatorAllowlist) : [],
		creatorBlocklist: isPro ? strings(merged.creatorBlocklist) : [],
	};

	if (nextSource === "curated") {
		normalized.liveCustomStart = null;
		normalized.liveCustomEnd = null;
		if (current.source !== nextSource) {
			normalized.liveSort = "newest";
			normalized.liveTimeWindow = "30d";
			normalized.liveResultLimit = 12;
			normalized.includeCategories = [];
			normalized.excludeCategories = [];
			normalized.minimumViews = 0;
			normalized.minimumDuration = 0;
			normalized.maximumDuration = 0;
			normalized.titleBlacklist = [];
			normalized.creatorAllowlist = [];
			normalized.creatorBlocklist = [];
		}
	}

	if (isPro) {
		normalized.theme = ["light", "dark", "system"].includes(String(merged.theme)) ? merged.theme : "system";
		normalized.accentColor = color(merged.accentColor, "#7C3AED");
		normalized.backgroundMode = merged.backgroundMode === "solid" ? "solid" : "transparent";
		normalized.backgroundColor = color(merged.backgroundColor, "#000000");
		normalized.cardSurfaceColor = color(merged.cardSurfaceColor, "#18181B");
		normalized.textColor = color(merged.textColor, "#FFFFFF");
		normalized.cardRadius = clamp(merged.cardRadius, 0, 32, 16);
		normalized.gap = clamp(merged.gap, 4, 48, 16);
		normalized.thumbnailTreatment = merged.thumbnailTreatment === "contain" ? "contain" : "cover";
		normalized.modalBackdrop = color(merged.modalBackdrop, "rgba(0,0,0,0.72)");
		normalized.desktopModalWidth = clamp(merged.desktopModalWidth, 640, 1440, 960);
		if (contrastRatio(normalized.textColor as string, normalized.cardSurfaceColor as string) < 3) {
			normalized.textColor = contrastRatio("#FFFFFF", normalized.cardSurfaceColor as string) >= contrastRatio("#000000", normalized.cardSurfaceColor as string) ? "#FFFFFF" : "#000000";
		}
	}

	return normalized;
}

function stableHash(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function resolveLiveGalleryClips(gallery: Gallery, clips: TwitchClip[], now = new Date()): TwitchClip[] {
	let start: Date | null = null;
	let end: Date = now;
	if (gallery.liveTimeWindow === "today") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	if (gallery.liveTimeWindow === "7d") start = new Date(now.getTime() - 7 * 86_400_000);
	if (gallery.liveTimeWindow === "30d") start = new Date(now.getTime() - 30 * 86_400_000);
	if (gallery.liveTimeWindow === "custom") {
		start = gallery.liveCustomStart;
		end = gallery.liveCustomEnd ?? now;
	}

	const includes = new Set(gallery.includeCategories.map((value) => value.toLowerCase()));
	const excludes = new Set(gallery.excludeCategories.map((value) => value.toLowerCase()));
	const allowedCreators = new Set(gallery.creatorAllowlist.map((value) => value.toLowerCase()));
	const blockedCreators = new Set(gallery.creatorBlocklist.map((value) => value.toLowerCase()));
	const blockedTitles = gallery.titleBlacklist.map((value) => value.toLowerCase());

	const filtered = clips.filter((clip) => {
		const created = Date.parse(clip.created_at);
		if (!Number.isFinite(created) || (start && created < start.getTime()) || created > end.getTime()) return false;
		if (clip.view_count < gallery.minimumViews || clip.duration < gallery.minimumDuration) return false;
		if (gallery.maximumDuration > 0 && clip.duration > gallery.maximumDuration) return false;
		const game = clip.game_id.toLowerCase();
		if (includes.size > 0 && !includes.has(game)) return false;
		if (excludes.has(game)) return false;
		const creator = clip.creator_name.toLowerCase();
		if (allowedCreators.size > 0 && !allowedCreators.has(creator)) return false;
		if (blockedCreators.has(creator)) return false;
		const title = clip.title.toLowerCase();
		return !blockedTitles.some((term) => title.includes(term));
	});

	filtered.sort((left, right) => {
		if (gallery.liveSort === "most_viewed") return right.view_count - left.view_count || right.created_at.localeCompare(left.created_at);
		if (gallery.liveSort === "stable_random") return stableHash(`${gallery.id}:${left.id}`) - stableHash(`${gallery.id}:${right.id}`);
		return right.created_at.localeCompare(left.created_at);
	});
	return filtered.slice(0, gallery.liveResultLimit);
}

export function downgradeGalleryPatch(gallery: Gallery, keepPublished: boolean): GalleryPatch {
	return {
		published: keepPublished ? gallery.published : false,
		liveResultLimit: Math.min(gallery.liveResultLimit, FREE_GALLERY_LIVE_LIMIT),
		liveSort: FREE_SORTS.has(gallery.liveSort) ? gallery.liveSort : "newest",
		liveTimeWindow: gallery.liveTimeWindow === "custom" ? closestFreeTimeWindow(gallery.liveCustomStart, gallery.liveCustomEnd) : gallery.liveTimeWindow,
		liveCustomStart: null,
		liveCustomEnd: null,
		includeCategories: [],
		excludeCategories: [],
		minimumViews: 0,
		minimumDuration: 0,
		maximumDuration: 0,
		titleBlacklist: [],
		creatorAllowlist: [],
		creatorBlocklist: [],
		theme: "system",
		accentColor: "#7C3AED",
		backgroundMode: "transparent",
		backgroundColor: "#000000",
		cardSurfaceColor: "#18181B",
		textColor: "#FFFFFF",
		cardRadius: 16,
		gap: 16,
		thumbnailTreatment: "cover",
		modalBackdrop: "rgba(0,0,0,0.72)",
		desktopModalWidth: 960,
	};
}
