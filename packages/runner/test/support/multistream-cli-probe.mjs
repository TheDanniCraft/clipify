import { createRequire, syncBuiltinESMExports } from "node:module";
import { createInterface } from "node:readline";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { build } from "esbuild";
import { nativeChromePath } from "./native-media.mjs";
import { prepareNativeTestShims } from "./native-test-shims.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const home = mkdtempSync(join(tmpdir(), "clipify-multistream-"));
const cache = join(root, "node_modules/.cache/clipify-native-tests");
mkdirSync(cache, { recursive: true });
const compiled = mkdtempSync(join(cache, "multistream-"));
const ffmpeg = process.env.RUNNER_FFMPEG_PATH || "ffmpeg";
const chrome = nativeChromePath();
const providers = JSON.parse(process.argv[2]);
const mappedProviders = new Set();
const receivers = [],
	products = new Set();
let cli,
	expectedGeneration,
	expectedAdmission,
	pollTimer,
	captures = 0,
	encoders = 0,
	closing = false;
const emit = (value) => process.stdout.write("CLIPIFY_MEDIA:" + JSON.stringify(value) + "\n");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function port() {
	const server = createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const value = server.address().port;
	await new Promise((resolve) => server.close(resolve));
	return value;
}
function decoded(path, final = false) {
	return new Promise((resolve) => {
		if (!existsSync(path) || statSync(path).size < 1024) return resolve({ frames: 0, green: false });
		execFile(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", "scale=1:1:flags=area", "-pix_fmt", "rgb24", "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"], { encoding: "buffer", timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
			const data = stdout || Buffer.alloc(0);
			const rgb = [...data.subarray(-3)];
			resolve({ rgb, complete: !error, frames: final && error ? 0 : Math.floor(data.length / 3), green: data.length >= 3 && rgb[1] > 150 && rgb[0] < 80 && rgb[2] < 80 });
		});
	});
}
async function audio(path) {
	return new Promise((resolve) =>
		execFile("ffprobe", ["-v", "error", "-count_packets", "-show_entries", "stream=codec_type,codec_name,nb_read_packets", "-of", "json", path], { timeout: 10000 }, (error, stdout) => {
			if (error) return resolve(false);
			try {
				resolve(JSON.parse(stdout).streams.some((stream) => stream.codec_type === "audio" && stream.codec_name === "aac" && Number(stream.nb_read_packets) > 0));
			} catch {
				resolve(false);
			}
		}),
	);
}
async function cleanup() {
	if (closing) return;
	closing = true;
	clearInterval(pollTimer);
	if (cli) await Promise.allSettled(Object.values(cli.activeEngines).map((engine) => engine.stop()));
	await Promise.allSettled(
		[...products, ...receivers.map((receiver) => receiver.child)].map(async (child) => {
			if (child.exitCode !== null || child.signalCode !== null) return;
			const ended = once(child, "close");
			child.kill("SIGTERM");
			const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
			try {
				await ended;
			} finally {
				clearTimeout(timer);
			}
		}),
	);
	rmSync(compiled, { recursive: true, force: true });
	rmSync(home, { recursive: true, force: true });
}
process.once("SIGTERM", () => void cleanup().then(() => process.exit(0)));
try {
	for (const [index, provider] of providers.entries()) {
		const base = `rtmp://127.0.0.1:${await port()}/live`;
		const streamKey = provider === "custom" ? "" : `private-media-target-${index}`;
		const transportUrl = provider === "custom" ? `${base}/keyless` : base;
		const rtmpUrl = provider === "youtube" ? "rtmp://a.rtmp.youtube.com/live2" : provider === "twitch" ? "rtmp://live.twitch.tv/app" : transportUrl;
		const path = join(home, `receiver-${index}.flv`);
		const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-listen", "1", "-i", streamKey ? `${transportUrl}/${streamKey}` : transportUrl, "-c", "copy", "-flush_packets", "1", "-f", "flv", path], { stdio: ["ignore", "ignore", "pipe"] });
		const receiver = { provider, rtmpUrl, transportUrl, streamKey, path, child, failure: "" };
		child.stderr.on("data", (data) => {
			receiver.failure = (receiver.failure + String(data)).slice(-2000);
		});
		receivers.push(receiver);
	}
	const { dependencies, os } = prepareNativeTestShims(compiled, { chromePath: chrome, ffmpegPath: ffmpeg, home: home });
	const logger = join(compiled, "logger.mjs"),
		keyring = join(compiled, "keyring.mjs");
	writeFileSync(logger, "export const ConsoleUI=new Proxy({},{get:()=>()=>{}})");
	writeFileSync(keyring, "export class Entry{constructor(){throw new Error('Isolated fixture keyring unavailable')}}");
	const source = readFileSync(join(root, "src/index.ts"), "utf8"),
		entry = "main().catch(console.error);";
	if (source.split(entry).length !== 2) throw new Error("Ambiguous native CLI adapter");
	// Identical production helper bodies; only interactive startup is replaced with exports.
	const adapted = source.replace(entry, "export {pollHeartbeat,startExecutionWatchdog,stopActiveEngines,activeEngines,freeControllers,freeJournals};");
	await build({
		stdin: { contents: adapted, sourcefile: join(root, "src/index.ts"), resolveDir: join(root, "src"), loader: "ts" },
		outfile: join(compiled, "cli.mjs"),
		platform: "node",
		target: "node24",
		format: "esm",
		bundle: true,
		packages: "external",
		plugins: [
			{
				name: "isolated-media-infrastructure",
				setup(builder) {
					builder.onResolve({ filter: /^\.\/(?:dependencies|downloader)$/ }, () => ({ path: dependencies }));
					builder.onResolve({ filter: /^(?:node:)?os$/ }, (args) => (args.importer === os ? { path: "node:os", external: true } : { path: os }));
					builder.onResolve({ filter: /^\.\/logger$/ }, () => ({ path: logger }));
					builder.onResolve({ filter: /^@napi-rs\/keyring$/ }, () => ({ path: keyring }));
				},
			},
		],
	});
	const childProcess = require("node:child_process"),
		originalSpawn = childProcess.spawn;
	childProcess.spawn = (...args) => {
		// Preserve provider URLs through validation, signing and the real CLI. Only
		// the external encoder transport is redirected to controlled RTMP sinks.
		if (args[0] === ffmpeg && Array.isArray(args[1])) {
			args[1] = args[1].map((argument) => {
				if (typeof argument !== "string" || !/^rtmps?:\/\//.test(argument)) return argument;
				const receiver = receivers.find((target) => target.provider !== "custom" && argument === `${target.rtmpUrl}/${target.streamKey}`);
				const destination = receiver ? `${receiver.transportUrl}/${receiver.streamKey}` : argument;
				if (new URL(destination).hostname !== "127.0.0.1") throw new Error("Unexpected external media output");
				if (receiver) mappedProviders.add(receiver.provider);
				return destination;
			});
		}
		const child = originalSpawn(...args);
		products.add(child);
		child.once("close", () => products.delete(child));
		if (args[0] === chrome) captures++;
		if (args[1]?.includes("libx264")) encoders++;
		return child;
	};
	syncBuiltinESMExports();
	emit({ type: "ready", destinations: receivers.map(({ provider, rtmpUrl, streamKey }, index) => ({ provider, rtmpUrl, streamKey, name: `Media destination ${index + 1}` })), sourcePrefixPreserved: adapted.slice(0, source.indexOf(entry)) === source.slice(0, source.indexOf(entry)) });
	for await (const line of createInterface({ input: process.stdin })) {
		const message = JSON.parse(line);
		if (message.action === "start") {
			expectedGeneration = message.generation;
			expectedAdmission = message.admissionId;
			process.env.RUNNER_EXECUTION_PUBLIC_KEYS = JSON.stringify(message.keys);
			cli = await import(new URL(`file://${join(compiled, "cli.mjs")}`));
			cli.startExecutionWatchdog();
			const poll = () => cli.pollHeartbeat(message.token, message.apiBase, message.runnerId);
			await poll();
			pollTimer = setInterval(() => void poll(), 10000);
			// Each bounded Chromium startup attempt may spend up to 30 seconds in
			// navigation. Allow retries to complete under full-suite CPU pressure;
			// the outer journey still bounds startup, playback, drain and cleanup.
			const deadline = Date.now() + 100000;
			let clipStarted = false;
			while (Date.now() < deadline) {
				const snapshots = await Promise.all(Object.values(cli.activeEngines).map((engine) => engine.page?.evaluate(() => window.clipifyRunnerPresentation?.snapshot().clips.some((clip) => clip.started && !clip.ended) ?? false).catch(() => false)));
				clipStarted = snapshots.some(Boolean);
				if (clipStarted && receivers.some((receiver) => existsSync(receiver.path) && statSync(receiver.path).size > 1024)) break;
				await pause(100);
			}
			const receiverStates = receivers.map((receiver) => ({ provider: receiver.provider, bytes: existsSync(receiver.path) ? statSync(receiver.path).size : 0, exitCode: receiver.child.exitCode, signalCode: receiver.child.signalCode, failure: receiver.failure.replace(/rtmps?:\/\/\S+/g, "[redacted]") }));
			emit({
				type: "playing",
				started: clipStarted && receiverStates.some((receiver) => receiver.bytes > 1024),
				clipStarted,
				captures,
				encoders,
				providerTransportReroutes: mappedProviders.size,
				receivers: receiverStates,
				engines: Object.values(cli.activeEngines).map((engine) => ({ isRunning: engine.isRunning, ffmpegStatus: engine.ffmpegStatus, hasPage: Boolean(engine.page) })),
			});
		} else if (message.action === "drain") {
			await cli.pollHeartbeat(message.token, message.apiBase, message.runnerId);
			const deadline = Date.now() + 35000;
			let markerReleased = false;
			const outputsClosed = () =>
				Array.from(cli.freeJournals.values()).some((journal) => {
					const record = journal.get(expectedAdmission);
					return record?.executionGeneration === expectedGeneration && record.state === "stopped" && record.allOutputsClosed === true;
				});
			while (!outputsClosed() && Date.now() < deadline) {
				if (!markerReleased) {
					const frames = await Promise.all(receivers.map((receiver) => decoded(receiver.path)));
					if (frames.every((frame) => frame.green)) for (const engine of Object.values(cli.activeEngines)) if (engine.page) markerReleased = (await engine.page.evaluate(() => window.releaseFinalMarker())) === true || markerReleased;
				}
				await pause(500);
			}
			const terminalObserved = outputsClosed();
			await cli.pollHeartbeat(message.token, message.apiBase, message.runnerId);
			clearInterval(pollTimer);
			await pause(200);
			const frames = await Promise.all(receivers.map((receiver) => decoded(receiver.path, true)));
			const sounds = await Promise.all(receivers.map((receiver) => audio(receiver.path)));
			emit({ type: "result", captures, encoders, providerTransportReroutes: mappedProviders.size, markerReleased, terminalObserved, destinations: frames.map((frame, index) => ({ ...frame, audio: sounds[index] })), allProcessesClosed: products.size === 0 && receivers.every((receiver) => receiver.child.exitCode !== null || receiver.child.signalCode !== null) });
			break;
		} else if (message.action === "shutdown") break;
	}
} finally {
	await cleanup();
}
