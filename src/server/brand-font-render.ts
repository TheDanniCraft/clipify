import "server-only";
import sharp from "sharp";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { readBoundedResponse } from "@lib/clipExport";
import { overlayMetadataSvg, brandFontSchema, type CreatorBrand, type MetadataContent, type OverlayText, type WidgetTheme } from "@lib/overlayMetadata";
// Pango retains font paths: keep them stable across jobs and evict only idle files.
type FontFiles = { regular: string; bold: string };
type FontEntry = { pending: Promise<FontFiles>; uses: number };
const fonts = new Map<string, FontEntry>();
const removing = new Map<string, Promise<void>>();
let fontRoot: Promise<string> | undefined;
function rootDirectory() {
	if (!fontRoot)
		fontRoot = mkdtemp(join(tmpdir(), "clipify-brand-fonts-")).then((root) => {
			process.once("exit", () => rmSync(root, { recursive: true, force: true }));
			return root;
		});
	return fontRoot;
}
async function downloadFont(family: string, signal: AbortSignal) {
	const response = await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:400,700`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), redirect: "manual", headers: { "User-Agent": "Clipify/1.0" } });
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error("font_unavailable");
	}
	const css = new TextDecoder().decode(await readBoundedResponse(response, 32768, signal));
	const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
	const download = async (weight: number) => {
		const block = blocks.find((item) => new RegExp(`font-weight:\\s*${weight}\\s*;`).test(item)) ?? blocks.find((item) => /font-weight:\s*400\s*;/.test(item));
		const match = block?.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/s\/[A-Za-z0-9/_.-]+\.ttf)\)/);
		if (!match) throw new Error("font_unavailable");
		const file = await fetch(match[1], { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), redirect: "manual" });
		if (!file.ok || Number(file.headers.get("content-length")) > 2097152) {
			await file.body?.cancel();
			throw new Error("font_unavailable");
		}
		const bytes = Buffer.from(await readBoundedResponse(file, 2097152, signal));
		if (bytes.length < 12 || (bytes.readUInt32BE(0) !== 0x00010000 && bytes.toString("ascii", 0, 4) !== "OTTO")) throw new Error("font_unavailable");
		return bytes;
	};
	const [regular, bold] = await Promise.all([download(400), download(700)]);
	return { regular, bold };
}
async function withFont<T>(family: string, signal: AbortSignal, render: (files: FontFiles) => Promise<T>): Promise<T> {
	let entry = fonts.get(family);
	if (!entry) {
		if (fonts.size >= 8) {
			const idle = Array.from(fonts).find(([, value]) => value.uses === 0);
			if (!idle) throw new Error("font_unavailable");
			fonts.delete(idle[0]);
			const cleanup = idle[1].pending
				.then(async (files) => {
					await Promise.all([rm(files.regular, { force: true }), rm(files.bold, { force: true })]);
				})
				.catch(() => {});
			removing.set(idle[0], cleanup);
			void cleanup.finally(() => {
				if (removing.get(idle[0]) === cleanup) removing.delete(idle[0]);
			});
		}
		const pending = (async () => {
			await removing.get(family);
			const [data, root] = await Promise.all([downloadFont(family, signal), rootDirectory()]);
			const key = createHash("sha256").update(family).digest("hex");
			const paths = { regular: join(root, `${key}-400.ttf`), bold: join(root, `${key}-700.ttf`) };
			await Promise.all([writeFile(paths.regular, data.regular), writeFile(paths.bold, data.bold)]);
			return paths;
		})();
		entry = { pending, uses: 0 };
		fonts.set(family, entry);
		const owned = entry;
		void pending.catch(() => {
			if (fonts.get(family) === owned) fonts.delete(family);
		});
	}
	entry.uses++;
	try {
		return await render(await entry.pending);
	} finally {
		entry.uses--;
	}
}
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
/** Rasterize from the same scene used by the editor; font files never enter FFmpeg syntax. */
export async function renderBrandWidget(kind: "channel" | "title" | "clipper", clip: MetadataContent, width: number, height: number, size: number, theme: WidgetTheme & Partial<Pick<CreatorBrand, "fontFamily" | "fontSource">>, signal: AbortSignal, avatar?: string) {
	const font = brandFontSchema.parse({ fontFamily: theme.fontFamily, fontSource: theme.fontSource });
	try {
		const render = async ({ regular, bold }: FontFiles) => {
			const texts: OverlayText[] = [];
			const scene = overlayMetadataSvg(kind, clip, width, height, size, theme, avatar, (text) => {
				texts.push(text);
				return "";
			});
			const rgba = await sharp({ create: { width: 1, height: 1, channels: 4, background: theme.themeTextColor } })
				.raw()
				.toBuffer();
			const color = `#${rgba.subarray(0, 3).toString("hex")}`;
			const overlays = await Promise.all(
				texts
					.filter((t) => t.line)
					.map(async (text) => {
						const left = Math.max(0, Math.round(text.x)),
							top = Math.max(0, Math.round(text.y));
						const png = await sharp({ text: { text: `<span foreground="${color}" alpha="${Math.round((rgba[3] / 255) * text.opacity * 65535)}">${escape(text.line)}</span>`, font: `${font.fontFamily} ${text.bold ? "Bold " : ""}${text.size}`, fontfile: text.bold ? bold : regular, rgba: true, dpi: 72 } })
							.png()
							.toBuffer();
						return {
							input: await sharp(png)
								.resize({ width: Math.max(1, Math.min(width - left, Math.round(text.width))), height: Math.max(1, Math.min(height - top, Math.ceil(text.size * 1.2))), fit: "inside" })
								.png()
								.toBuffer(),
							left,
							top,
						};
					}),
			);
			if (kind === "channel" && overlays.length) {
				const bodyLeft = Math.max(...overlays.map((layer) => layer.left));
				const body = overlays.filter((layer) => layer.left === bodyLeft);
				const heights = await Promise.all(body.map(async (layer) => (await sharp(layer.input).metadata()).height ?? 0));
				const top = Math.min(...body.map((layer) => layer.top));
				const bottom = Math.max(...body.map((layer, index) => layer.top + heights[index]));
				const offset = Math.round((height - (bottom - top)) / 2 - top);
				for (const layer of body) layer.top += offset;
			}

			signal.throwIfAborted();
			return sharp(Buffer.from(scene), { limitInputPixels: 1000000 }).composite(overlays).png().toBuffer();
		};
		if (font.fontSource === "builtin") {
			const name = font.fontFamily.replaceAll(" ", "");
			return await render({ regular: join(process.cwd(), "public/fonts/brand", `${name}.ttf`), bold: join(process.cwd(), "public/fonts/brand", `${name}-Bold.ttf`) });
		}
		return await withFont(font.fontFamily, signal, render);
	} catch {
		signal.throwIfAborted();
		throw new Error("font_unavailable");
	}
}

export async function validateBrandFont(font: Pick<CreatorBrand, "fontFamily" | "fontSource">, signal: AbortSignal) {
	if (font.fontSource === "google") await withFont(font.fontFamily, signal, async () => {});
}
