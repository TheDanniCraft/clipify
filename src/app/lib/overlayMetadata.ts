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
export const widgetThemeSchema = z.object({ themeTextColor: color.default(DEFAULT_WIDGET_THEME.themeTextColor), themeBackgroundColor: color.default(DEFAULT_WIDGET_THEME.themeBackgroundColor), themeAccentColor: color.default(DEFAULT_WIDGET_THEME.themeAccentColor), borderSize: z.number().finite().min(0).max(12).default(0), borderRadius: z.number().finite().min(0).max(80).default(10) });
export type WidgetTheme = z.infer<typeof widgetThemeSchema>;
export type MetadataContent = { title: string; broadcasterName?: string | null; clipCreatorName?: string | null; categoryName?: string | null };
export function overlayMetadataContent(kind: "channel" | "title" | "clipper", clip: MetadataContent) {
	const clean = (text: string | undefined | null) =>
		text
			?.replace(/[\u0000-\u001f]/g, " ")
			.trim()
			.slice(0, 200) ?? "";
	if (kind === "channel") return { primary: clean(clip.broadcasterName) || "Channel", secondary: clip.categoryName ? `Playing ${clean(clip.categoryName)}` : "Twitch channel" };
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
	const content = overlayMetadataContent(kind, clip);
	const lines = kind === "channel" ? 1 : Math.max(1, wrapOverlayText(content.primary, Math.max(1, width - 40), fontSize, 3).length);
	return Math.ceil((40 + lines * fontSize * 1.2 + (content.secondary ? fontSize * 0.72 * 1.4 : 0)) / 2) * 2;
}
export function overlayMetadataSvg(kind: "channel" | "title" | "clipper", clip: MetadataContent, width: number, height: number, fontSize: number, theme: WidgetTheme = DEFAULT_WIDGET_THEME, avatar?: string) {
	const content = overlayMetadataContent(kind, clip),
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
	const text = (line: string, x: number, y: number, font: number, bold: boolean, opacity = 1) => `<text x="${x}" y="${y}" dominant-baseline="hanging" font-family="DejaVu Sans,sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${escape(theme.themeTextColor)}" opacity="${opacity}" textLength="${Math.max(0.1, Math.min(available, textWidth(line, font)))}" lengthAdjust="spacingAndGlyphs">${escape(line)}</text>`;
	const radius = Math.min(theme.borderRadius, width / 2, height / 2),
		border = Math.min(theme.borderSize, width / 2, height / 2);
	const background = `<rect x="${border / 2}" y="${border / 2}" width="${Math.max(1, width - border)}" height="${Math.max(1, height - border)}" rx="${radius}" fill="${escape(theme.themeBackgroundColor)}" stroke="${escape(theme.themeAccentColor)}" stroke-width="${border}"/>`;
	const safeAvatar = avatar && /^(data:image\/png;base64,[a-zA-Z0-9+/=]+)$/.test(avatar);
	const portrait = avatarSize
		? `<defs><clipPath id="avatar"><circle cx="${padding + avatarSize / 2}" cy="${height / 2}" r="${avatarSize / 2}"/></clipPath></defs><circle cx="${padding + avatarSize / 2}" cy="${height / 2}" r="${avatarSize / 2}" fill="${escape(theme.themeAccentColor)}"/>${safeAvatar ? `<image href="${escape(avatar!)}" x="${padding}" y="${(height - avatarSize) / 2}" width="${avatarSize}" height="${avatarSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)"/>` : text(content.primary.slice(0, 2).toUpperCase(), padding + avatarSize * 0.18, (height - size) / 2, Math.min(size, avatarSize * 0.45), true)}`
		: "";
	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background}${portrait}${lines.map((line, index) => text(line, left, top + index * size * 1.2, size, true)).join("")}${content.secondary ? text(content.secondary, left, top + lines.length * size * 1.2, secondarySize, false, 0.8) : ""}</svg>`;
}
