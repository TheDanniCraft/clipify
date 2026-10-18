import type { Locator } from "@playwright/test";
import { execFileSync } from "node:child_process";

const decodedFrames = new Map<string, Buffer>();
const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const luminance = (rgb: number[]) => 0.2126 * linear(rgb[0] / 255) + 0.7152 * linear(rgb[1] / 255) + 0.0722 * linear(rgb[2] / 255);

/** Actual DOM/CSS plus the exact controlled provider response; no canvas/security override. */
export async function measureRunnerAttribution(badge: Locator, fromVideo: boolean) {
	const measured = await badge.evaluate((element, videoBackground) => {
		const text = element.querySelector<HTMLElement>("span")!;
		const block = text.parentElement!;
		const logo = element.firstElementChild!;
		const root = element.closest<HTMLElement>("[data-runner-presentation-generation]")!;
		const color = (value: string) => (value.match(/\d*\.?\d+/g) ?? []).map(Number);
		const textStyle = getComputedStyle(block);
		let source: { url: string; width: number; height: number; x: number; y: number; cropWidth: number; cropHeight: number } | null = null;
		if (videoBackground) {
			const video = [...root.querySelectorAll("video")].find((candidate) => !candidate.paused && candidate.readyState >= 2);
			if (!video) throw new Error("Readability fixture has no decoded playing video");
			const frame = video.getBoundingClientRect(),
				textBox = block.getBoundingClientRect();
			const x = Math.max(0, Math.floor(((textBox.left - frame.left) * video.videoWidth) / frame.width));
			const y = Math.max(0, Math.floor(((textBox.top - frame.top) * video.videoHeight) / frame.height));
			source = { url: video.currentSrc, width: video.videoWidth, height: video.videoHeight, x, y, cropWidth: Math.max(1, Math.min(video.videoWidth - x, Math.ceil((textBox.width * video.videoWidth) / frame.width))), cropHeight: Math.max(1, Math.min(video.videoHeight - y, Math.ceil((textBox.height * video.videoHeight) / frame.height))) };
		}
		const box = element.getBoundingClientRect();
		const surface = root.getBoundingClientRect();
		const embedding = element.ownerDocument.defaultView!.frameElement;
		const visualScale = embedding ? embedding.getBoundingClientRect().width / innerWidth : 1;
		return {
			source,
			backing: color(getComputedStyle(element).backgroundColor),
			foreground: color(textStyle.color),
			standbyBackground: color(getComputedStyle(root).backgroundColor).slice(0, 3),
			font: Number.parseFloat(textStyle.fontSize),
			lineHeight: Number.parseFloat(textStyle.lineHeight),
			logoWidth: logo.getBoundingClientRect().width,
			logoHeight: logo.getBoundingClientRect().height,
			textOpacity: Number(textStyle.opacity),
			logoOpacity: Number(getComputedStyle(logo).opacity),
			left: box.left,
			right: box.right,
			top: box.top,
			bottom: box.bottom,
			viewportWidth: innerWidth,
			viewportHeight: innerHeight,
			surfaceWidth: surface.width,
			surfaceHeight: surface.height,
			visualScale,
		};
	}, fromVideo);
	const contrast = (frame: number[]) => {
		const alpha = measured.backing[3] ?? 1;
		const opacity = measured.textOpacity * (measured.foreground[3] ?? 1);
		const plate = frame.map((channel, i) => measured.backing[i] * alpha + channel * (1 - alpha));
		const ink = plate.map((channel, i) => measured.foreground[i] * opacity + channel * (1 - opacity));
		const a = luminance(plate),
			b = luminance(ink);
		return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	};
	let minimumContrast = Infinity,
		rawMin = 255,
		rawMax = 0;
	const sample = (rgb: number[]) => {
		rawMin = Math.min(rawMin, ...rgb);
		rawMax = Math.max(rawMax, ...rgb);
		minimumContrast = Math.min(minimumContrast, contrast(rgb));
	};
	if (measured.source) {
		const source = measured.source,
			url = new URL(source.url);
		if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !/^\/clip\/RunnerPresentation_[a-f0-9-]{36}\.mp4$/.test(url.pathname)) throw new Error("Readability decoder accepts only its owned loopback media fixture");
		let pixels = decodedFrames.get(source.url);
		if (!pixels) {
			const response = await badge.page().request.get(source.url);
			if (response.status() !== 200) throw new Error("Controlled readability media response unavailable");
			pixels = execFileSync("ffmpeg", ["-v", "error", "-threads", "1", "-i", "pipe:0", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { input: await response.body(), maxBuffer: 8_000_000 });
			if (pixels.length !== source.width * source.height * 3) throw new Error("Controlled decoded frame differs from Chrome intrinsic dimensions");
			decodedFrames.set(source.url, pixels);
		}
		for (let y = source.y; y < source.y + source.cropHeight; y += 3) {
			for (let x = source.x; x < source.x + source.cropWidth; x += 3) {
				const i = (y * source.width + x) * 3;
				sample([pixels[i], pixels[i + 1], pixels[i + 2]]);
			}
		}
	} else sample(measured.standbyBackground);
	return { ...measured, minimumContrast, rawMin, rawMax };
}
