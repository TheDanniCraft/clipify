import { z } from "zod";
export const DEFAULT_WIDGET_THEME = { themeTextColor: "#FFFFFF", themeBackgroundColor: "rgba(10,10,10,0.65)", themeAccentColor: "#7C3AED", borderSize: 0, borderRadius: 10 } as const;
const color = z
	.string()
	.max(80)
	.refine((value) => {
		if (/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) return true;
		const match = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
		return Boolean(match && match.slice(1, 4).every((n) => Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= 255) && (match[4] === undefined || (Number.isFinite(Number(match[4])) && Number(match[4]) >= 0 && Number(match[4]) <= 1)));
	}, "Choose a valid color.");
export const widgetThemeSchema = z.object({ themeTextColor: color.default(DEFAULT_WIDGET_THEME.themeTextColor), themeBackgroundColor: color.default(DEFAULT_WIDGET_THEME.themeBackgroundColor), themeAccentColor: color.default(DEFAULT_WIDGET_THEME.themeAccentColor), borderSize: z.number().finite().min(0).max(32).default(0), borderRadius: z.number().finite().min(0).max(80).default(10) });
const brandFontFields = {
	fontFamily: z
		.string()
		.trim()
		.regex(/^[A-Za-z][A-Za-z0-9 -]{0,79}$/)
		.default("DejaVu Sans"),
	fontSource: z.enum(["builtin", "google"]).default("builtin"),
};
export const brandFontSchema = z.object(brandFontFields).refine((font) => font.fontSource === "google" || ["DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono"].includes(font.fontFamily), "Choose a supported font.");
export const creatorBrandSchema = widgetThemeSchema.extend({ ...brandFontFields, progressBarStartColor: color.default("#26018E"), progressBarEndColor: color.default("#8D42F9"), watermark: z.boolean().default(true) }).refine((brand) => brandFontSchema.safeParse(brand).success, "Choose a supported font.");
export type CreatorBrand = z.infer<typeof creatorBrandSchema>;
export type OverlayText = { line: string; x: number; y: number; size: number; bold: boolean; opacity: number; width: number };
export type WidgetTheme = z.infer<typeof widgetThemeSchema>;
export type MetadataContent = { title: string; broadcasterName?: string | null; clipCreatorName?: string | null; categoryName?: string | null; broadcasterLogin?: string | null };
export function overlayMetadataContent(kind: "channel" | "title" | "clipper", clip: MetadataContent, channelLink = false) {
	const clean = (text: string | undefined | null) =>
		text
			?.replace(/[\u0000-\u001f]/g, " ")
			.trim()
			.slice(0, 200) ?? "";
	if (kind === "channel") return { primary: clean(clip.broadcasterName) || "Channel", secondary: !channelLink ? (clip.categoryName ? `Playing ${clean(clip.categoryName)}` : "Twitch channel") : clean(clip.broadcasterLogin) ? `twitch.tv/${clean(clip.broadcasterLogin)}` : clean(clip.broadcasterName) && /^[a-zA-Z0-9_]+$/.test(clean(clip.broadcasterName)) ? `twitch.tv/${clean(clip.broadcasterName).toLowerCase()}` : "" };
	const credit = clip.clipCreatorName ? `clipped by ${clean(clip.clipCreatorName)}` : "Twitch clip";
	return kind === "title" ? { primary: clean(clip.title) || "Untitled clip", secondary: credit } : { primary: credit, secondary: "" };
}
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
function textWidth(text: string, size: number) {
	return Array.from(text).reduce((width, char) => width + size * (/[ilI.,'!:;| ]/.test(char) ? 0.3 : /[MW@#%]/.test(char) ? 0.9 : /[^\u0000-\u024f]/.test(char) ? 1 : 0.58), 0);
}
export function wrapOverlayText(text: string, width: number, size: number, maxLines = 3) {
	const words = text.trim().split(/\s+/).filter(Boolean),
		lines: string[] = [];
	let line = "";
	for (const word of words) {
		if (line && textWidth(`${line} ${word}`, size) > width) {
			lines.push(line);
			line = "";
		}
		for (const char of Array.from(word)) {
			if (textWidth(line + char, size) > width && line) {
				lines.push(line);
				line = "";
			}
			line += char;
		}
		line += " ";
	}
	if (line.trim()) lines.push(line.trim());
	const result = lines.slice(0, maxLines).map((line) => line.trim());
	if (lines.length > maxLines && result.length) {
		let tail = result[result.length - 1];
		while (tail && textWidth(tail + "…", size) > width) tail = Array.from(tail).slice(0, -1).join("");
		result[result.length - 1] = tail.trimEnd() + "…";
	}
	return result;
}
export function overlayMetadataHeight(kind: "channel" | "title" | "clipper", clip: MetadataContent, width: number, fontSize: number) {
	const content = overlayMetadataContent(kind, clip, true);
	const lines = kind === "channel" ? 1 : Math.max(1, wrapOverlayText(content.primary, Math.max(1, width - 40), fontSize, 3).length);
	return Math.ceil((40 + lines * fontSize * 1.2 + (content.secondary ? fontSize * 0.72 * 1.4 : 0)) / 2) * 2;
}
export function overlayMetadataSize(kind: "channel" | "title" | "clipper", clip: MetadataContent, fontSize: number, maxWidth: number) {
	const content = overlayMetadataContent(kind, clip, true);
	const height = overlayMetadataHeight(kind, clip, maxWidth, fontSize);
	const avatar = kind === "channel" ? height - 40 + 20 : 0;
	const width = Math.min(maxWidth, Math.ceil(Math.max(textWidth(content.primary, fontSize), textWidth(content.secondary, fontSize * 0.72)) * 1.12 + 40 + avatar));
	return { width: Math.max(40, width), height: overlayMetadataHeight(kind, clip, width, fontSize) };
}
export function overlayMetadataSvg(kind: "channel" | "title" | "clipper", clip: MetadataContent, width: number, height: number, fontSize: number, theme: WidgetTheme = DEFAULT_WIDGET_THEME, avatar?: string, renderText?: (text: OverlayText) => string, fontFamily = "DejaVu Sans") {
	const content = overlayMetadataContent(kind, clip, true),
		padding = Math.min(20, height * 0.12),
		avatarSize = kind === "channel" ? Math.max(2, Math.min(height - padding * 2, width * 0.22)) : 0;
	const left = padding + (avatarSize ? avatarSize + padding : 0),
		available = Math.max(1, width - left - padding);
	let size = Math.max(1, Math.min(fontSize, kind === "channel" ? (height - padding * 2) / 2.2 : fontSize));
	const limit = kind === "channel" ? 1 : 3;
	while (size > 14 && wrapOverlayText(content.primary, available, size, 200).length > limit) size--;
	let lines = wrapOverlayText(content.primary, available, size, limit);
	size = Math.max(1, Math.min(size, (height - padding * 2) / (lines.length * 1.2 + (content.secondary ? 1.1 : 0))));
	if (kind === "channel") size = Math.min(size, available / Math.max(1, textWidth(content.primary, 1)));
	lines = wrapOverlayText(content.primary, available, size, kind === "channel" ? 1 : 3);
	const secondarySize = Math.max(1, Math.min(size * 0.72, available / Math.max(1, textWidth(content.secondary, 1))));
	const totalHeight = lines.length * size * 1.2 + (content.secondary ? secondarySize * 1.4 : 0),
		top = Math.max(padding, (height - totalHeight) / 2);
	const text = (line: string, x: number, y: number, font: number, bold: boolean, opacity = 1) => (renderText ? renderText({ line, x, y, size: font, bold, opacity, width: available }) : `<text x="${x}" y="${y}" dominant-baseline="hanging" font-family="${escape(fontFamily)},sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${escape(theme.themeTextColor)}" opacity="${opacity}">${escape(line)}</text>`);
	const radius = Math.min(theme.borderRadius, width / 2, height / 2),
		border = Math.min(theme.borderSize, width / 2, height / 2);
	const background = `<rect x="${border / 2}" y="${border / 2}" width="${Math.max(1, width - border)}" height="${Math.max(1, height - border)}" rx="${radius}" fill="${escape(theme.themeBackgroundColor)}" stroke="${escape(theme.themeAccentColor)}" stroke-width="${border}"/>`;
	const safeAvatar = avatar && /^(data:image\/png;base64,[a-zA-Z0-9+/=]+)$/.test(avatar);
	const portrait = avatarSize
		? `<defs><clipPath id="avatar"><circle cx="${padding + avatarSize / 2}" cy="${height / 2}" r="${avatarSize / 2}"/></clipPath></defs><circle cx="${padding + avatarSize / 2}" cy="${height / 2}" r="${avatarSize / 2}" fill="${escape(theme.themeAccentColor)}"/>${safeAvatar ? `<image href="${escape(avatar!)}" x="${padding}" y="${(height - avatarSize) / 2}" width="${avatarSize}" height="${avatarSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)"/>` : text(content.primary.slice(0, 2).toUpperCase(), padding + avatarSize * 0.18, (height - size) / 2, Math.min(size, avatarSize * 0.45), true)}`
		: "";
	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background}${portrait}${lines.map((line, index) => text(line, left, top + index * size * 1.2, size, true)).join("")}${content.secondary ? text(content.secondary, left, top + lines.length * size * 1.2, secondarySize, false, 0.8) : ""}</svg>`;
}

// Keep preview and encoded watermark timing and positions identical.
export const CLIPIFY_WATERMARK = { width: 148, height: 40, inset: 16, interval: 3 } as const;
export const CLIPIFY_WATERMARK_CORNERS = [
	[1, 1],
	[0, 0.25],
	[1, 0.6],
	[0, 1],
	[1, 0],
	[0, 0.65],
] as const;
export function clipifyWatermarkPosition(seconds: number, width: number, height: number) {
	const point = CLIPIFY_WATERMARK_CORNERS[Math.floor(Math.max(0, seconds) / CLIPIFY_WATERMARK.interval) % CLIPIFY_WATERMARK_CORNERS.length];
	return { x: 16 + point[0] * Math.max(0, width - CLIPIFY_WATERMARK.width - 32), y: 16 + point[1] * Math.max(0, height - CLIPIFY_WATERMARK.height - 32) };
}
export function clipifyWatermarkExpression(axis: 0 | 1) {
	const far = axis === 0 ? "W-w-16" : "H-h-16";
	const period = CLIPIFY_WATERMARK.interval * CLIPIFY_WATERMARK_CORNERS.length;
	return CLIPIFY_WATERMARK_CORNERS.slice(0, -1).reduceRight((next, point, index) => `if(lt(mod(t,${period}),${(index + 1) * CLIPIFY_WATERMARK.interval}),16+(${far}-16)*${point[axis]},${next})`, `16+(${far}-16)*${CLIPIFY_WATERMARK_CORNERS.at(-1)![axis]}`);
}
export function clipifyWatermarkSvg() {
	return '<svg xmlns="http://www.w3.org/2000/svg" width="148" height="40" viewBox="0 0 148 40"><rect width="148" height="40" rx="12" fill="#0a0a0a" fill-opacity="0.65"/><g transform="translate(8 4) scale(0.2)"><path d="M28.1,30.8l100.3,57.7c3.1,1.8,3.1,6.2,0,7.9l-100,57.7c-3.1,1.8-6.9-.4-6.9-4l-.3-115.4c0-3.5,3.8-5.8,6.9-4Z" fill="#2a2a65"/><path d="M11.5,4.8l106.3,61.2c3.2,1.9,3.2,6.6,0,8.4L11.9,135.5c-3.2,1.9-7.3-.5-7.3-4.2l-.4-122.3c0-3.7,4-6.1,7.3-4.2Z" fill="#6355a0"/><path d="M33.6,48.2l35.6,20.5c1.2.7,1.2,2.4,0,3.1l-35.5,20.5c-1.2.7-2.7-.2-2.7-1.5v-41c-.1-1.4,1.3-2.2,2.5-1.5Z" fill="white"/></g><text x="42" y="26" font-family="DejaVu Sans,sans-serif" font-size="17" fill="white">clipify.us</text></svg>';
}

export function brandOverlayFields(brand: CreatorBrand) {
	return {
		progressBarStartColor: brand.progressBarStartColor,
		progressBarEndColor: brand.progressBarEndColor,
		themeTextColor: brand.themeTextColor,
		themeBackgroundColor: brand.themeBackgroundColor,
		themeAccentColor: brand.themeAccentColor,
		borderSize: brand.borderSize,
		borderRadius: brand.borderRadius,
		themeFontFamily: brand.fontSource === "google" ? `${brand.fontFamily}, sans-serif||url||https://fonts.googleapis.com/css2?family=${encodeURIComponent(brand.fontFamily)}:wght@400;700&display=swap` : brand.fontFamily,
	};
}
