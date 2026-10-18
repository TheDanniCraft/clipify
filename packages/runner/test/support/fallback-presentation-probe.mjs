import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { once } from "node:events";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { nativeChromePath } from "./native-media.mjs";

// Private device credentials arrive on stdin, never in argv or retained logs.
let input = "";
for await (const chunk of process.stdin) input += chunk;
const assignment = JSON.parse(input);
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "clipify-fallback-presentation-"));
const cache = join(packageRoot, "node_modules/.cache/clipify-native-tests");
mkdirSync(cache, { recursive: true });
const compiled = mkdtempSync(join(cache, "fallback-presentation-"));
const ffmpeg = process.env.RUNNER_FFMPEG_PATH || "ffmpeg";
const children = new Set();
let engine,
	stopProxy,
	closing = false,
	cleanupPromise;
const receiverFiles = [0, 1, 2].map((index) => join(directory, `phase-${index}.flv`));
const receiverClosed = [0, 1, 2].map(() => {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, message, budget = 20000) {
	const end = Date.now() + budget;
	while (Date.now() < end) {
		const result = await predicate();
		if (result) return result;
		await delay(50);
	}
	throw new Error(message);
}
function start(args) {
	const child = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
	children.add(child);
	let diagnostics = "";
	child.stderr.on("data", (data) => {
		diagnostics = (diagnostics + data).slice(-3000);
	});
	child.once("close", () => children.delete(child));
	child.diagnostics = () => diagnostics;
	return child;
}
function listening(port) {
	// Observe the Linux browser job's listener without consuming FFmpeg's one
	// accepted RTMP connection with a readiness TCP probe.
	return readFileSync("/proc/net/tcp", "utf8")
		.split("\n")
		.some((line) => {
			const fields = line.trim().split(/\s+/);
			return fields[3] === "0A" && parseInt(fields[1]?.split(":")[1] ?? "", 16) === port;
		});
}
async function sparePort() {
	const server = createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const port = server.address().port;
	await new Promise((resolve) => server.close(resolve));
	return port;
}
function frame(path, attributionBox) {
	try {
		if (statSync(path).size < 4096) return null;
		const frames = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", "fps=1,scale=320:180", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { timeout: 5000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
		const pixels = frames.subarray(-320 * 180 * 3);
		if (pixels.length !== 320 * 180 * 3) return null;
		let white = 0,
			attributionWhite = 0,
			red = 0,
			blue = 0;
		for (let index = 0; index < pixels.length; index += 3) {
			const [r, g, b] = pixels.subarray(index, index + 3);
			if (r > 200 && g > 200 && b > 200) {
				white++;
				const pixel = index / 3,
					x = (pixel % 320) / 320,
					y = Math.floor(pixel / 320) / 180;
				if (attributionBox && x >= attributionBox.left && x <= attributionBox.right && y >= attributionBox.top && y <= attributionBox.bottom) attributionWhite++;
			}
			if (r > 180 && g < 80 && b < 80) red++;
			if (b > r + 20 && b > g) blue++;
		}
		let diagnosticFrame = null;
		if (blue > 30000 || red > 50000) {
			const diagnostics = join(process.cwd(), "test-results/native-encoded-diagnostic", String(process.pid));
			mkdirSync(diagnostics, { recursive: true });
			diagnosticFrame = join(diagnostics, `phase-${receiverFiles.indexOf(path)}.png`);
			const png = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "320x180", "-i", "pipe:0", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"], { input: pixels, timeout: 5000, maxBuffer: 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
			writeFileSync(diagnosticFrame, png);
		}
		return { whitePixels: white, attributionWhitePixels: attributionWhite, redPixels: red, bluePixels: blue, decodedFrames: frames.length / (320 * 180 * 3), diagnosticFrame };
	} catch {
		return null;
	}
}
async function cleanup() {
	if (cleanupPromise) return cleanupPromise;
	closing = true;
	cleanupPromise = (async () => {
		for (const child of children) child.kill("SIGTERM");
		await engine?.stop();
		await stopProxy?.();
		const { wss } = require("puppeteer-stream");
		const captureServer = await wss;
		await new Promise((resolve) => captureServer.close(resolve));
		await Promise.all(
			[...children].map(async (child) => {
				if (child.exitCode !== null || child.signalCode !== null) return;
				const closed = once(child, "close");
				const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
				try {
					await closed;
				} finally {
					clearTimeout(timer);
				}
			}),
		);
		rmSync(directory, { recursive: true, force: true });
		rmSync(compiled, { recursive: true, force: true });
	})();
	return cleanupPromise;
}
process.once("SIGTERM", () => {
	void cleanup().finally(() => process.exit(1));
});

try {
	const dependencies = join(compiled, "dependencies.mjs"),
		os = join(compiled, "os.mjs");
	writeFileSync(dependencies, `export async function ensureDependencies(){return {chromePath:${JSON.stringify(nativeChromePath())},ffmpegPath:${JSON.stringify(ffmpeg)}}}`);
	writeFileSync(os, `import * as os from 'node:os';export * from 'node:os';export const homedir=()=>${JSON.stringify(directory)};export const tmpdir=()=>${JSON.stringify(directory)};export default {...os,homedir,tmpdir};`);
	await build({
		entryPoints: [join(packageRoot, "src/engine.ts")],
		outfile: join(compiled, "engine.mjs"),
		platform: "node",
		target: "node24",
		format: "esm",
		bundle: true,
		packages: "external",
		plugins: [
			{
				name: "isolated-installed-media",
				setup(builder) {
					builder.onResolve({ filter: /^\.\/downloader$/ }, () => ({ path: dependencies }));
					builder.onResolve({ filter: /^os$/ }, () => ({ path: os }));
				},
			},
		],
	});
	const { Engine, stopTCPProxy } = await import(new URL(`file://${join(compiled, "engine.mjs")}`));
	stopProxy = stopTCPProxy;
	const port = await sparePort(),
		destination = `rtmp://127.0.0.1:${port}/live/fixture`;
	const receivers = [];
	function receiver(index) {
		const child = start(["-hide_banner", "-loglevel", "error", "-y", "-listen", "1", "-i", destination, "-c", "copy", "-flush_packets", "1", "-f", "flv", receiverFiles[index]]);
		receivers[index] = child;
		child.once("close", () => {
			receiverClosed[index].resolve();
			if (!closing && index < 2) receiver(index + 1);
		});
	}
	receiver(0);
	await until(() => listening(port), "First output receiver did not listen", 5000);
	engine = new Engine(assignment.overlayId, destination, assignment.overlaySecret, "", 15, "720p", assignment.checkBlockedStartup ? "24_7" : "failsafe", assignment.apiBase, assignment.runnerToken, { executionGeneration: assignment.executionGeneration, presentationSessionId: assignment.sessionId });
	let observedLayout = null;
	const observeLayout = async () => {
		if (!engine.page) return;
		try {
			const nextLayout = await engine.page.evaluate(() => ({ status: document.querySelector("[data-runner-layout-status]")?.getAttribute("data-runner-layout-status"), generation: document.querySelector("[data-runner-presentation-generation]")?.getAttribute("data-runner-presentation-generation"), panels: document.querySelectorAll("[data-player-overlay]").length }));
			if (!observedLayout || observedLayout.status !== "blocked" || (nextLayout.status === "blocked" && nextLayout.panels > observedLayout.panels)) observedLayout = nextLayout;
		} catch {
			/* A previously closed page has no additional observation. */
		}
	};
	if (assignment.checkBlockedStartup) {
		// Observe before either capture or browser cleanup removes playing panels.
		const stopCapture = engine.stopCloudLoopStream.bind(engine);
		engine.stopCloudLoopStream = async (...args) => {
			await observeLayout();
			return stopCapture(...args);
		};
		const closeBrowser = engine.stopChromiumBackground.bind(engine);
		engine.stopChromiumBackground = async () => {
			await observeLayout();
			return closeBrowser();
		};
	}
	const accepted = (await engine.start()) !== false;
	if (assignment.checkBlockedStartup) {
		if (accepted)
			await until(async () => {
				await observeLayout();
				return observedLayout?.status === "blocked";
			}, "Configured playing layout did not reach its actual blocked state");
		const startup = {
			accepted,
			encoderOpened: Boolean(engine.ffmpeg),
			receivedBytes: (() => {
				try {
					return statSync(receiverFiles[0]).size;
				} catch {
					return 0;
				}
			})(),
			observedLayout,
			status: engine.ffmpegStatus,
		};
		await cleanup();
		process.stdout.write(JSON.stringify({ startup }) + "\n");
	} else {
		if (!accepted) throw new Error("Assigned presentation was refused");
		const publisher = () => start(["-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "color=c=red:s=320x180:r=15", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "8", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-pix_fmt", "yuv420p", "-c:a", "aac", "-f", "flv", "rtmp://127.0.0.1:1935/live/fixture"]);
		const firstInput = publisher();
		const firstInputClosed = once(firstInput, "close");
		const live = await until(() => {
			const value = frame(receiverFiles[0]);
			return value?.redPixels > 50000 ? value : null;
		}, "Live source did not arrive at the actual output");
		await firstInputClosed;
		await receiverClosed[0].promise;
		await until(() => engine.page.evaluate(() => Array.from(document.querySelectorAll("video")).some((video) => !video.paused && video.currentTime > 0.2)), "Fallback did not play a real selected clip");
		// The current encoded phase must exist before measuring collision-adaptive placement.
		await until(() => frame(receiverFiles[1])?.bluePixels > 30000, "Fallback clip did not arrive before attribution measurement");
		const attribution = await engine.page.evaluate(() => {
			const node = document.querySelector('[data-runner-attribution="true"]');
			if (!node) return { visible: false, box: null };
			const rect = node.getBoundingClientRect(),
				style = getComputedStyle(node);
			return { visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && node.textContent.includes("Livestream powered") && node.textContent.includes("by Clipify.us"), box: { left: rect.left / innerWidth, right: rect.right / innerWidth, top: rect.top / innerHeight, bottom: rect.bottom / innerHeight } };
		});
		const fallback = await until(() => {
			const value = frame(receiverFiles[1], attribution.box);
			return value?.bluePixels > 30000 ? { ...value, attributionVisible: attribution.visible, attributionBox: attribution.box } : null;
		}, "Fallback clip did not arrive at the encoded output");
		fallback.afterAttributionBox = await engine.page.evaluate(() => {
			const rect = document.querySelector('[data-runner-attribution="true"]')?.getBoundingClientRect();
			return rect ? { left: rect.left / innerWidth, right: rect.right / innerWidth, top: rect.top / innerHeight, bottom: rect.bottom / innerHeight } : null;
		});
		const secondInput = publisher();
		const returned = await until(() => {
			const value = frame(receiverFiles[2]);
			return value?.redPixels > 50000 ? value : null;
		}, "Returning live source did not replace generated output");
		secondInput.kill("SIGTERM");
		const dimensions = receiverFiles.map((path) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", path], { encoding: "utf8", timeout: 5000 })).streams[0]);
		await cleanup();
		process.stdout.write(JSON.stringify({ live, fallback, returned, dimensions, authenticatedPresentation: true, realPlayback: true }) + "\n");
	}
} catch (error) {
	await cleanup();
	process.stderr.write((error instanceof Error ? error.message : "Fallback presentation probe failed") + "\n");
	process.exitCode = 1;
}
