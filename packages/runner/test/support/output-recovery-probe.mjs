import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const home = mkdtempSync(join(tmpdir(), "clipify-output-recovery-"));
const ffmpeg = process.env.RUNNER_FFMPEG_PATH || "ffmpeg";
const children = new Set();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bytes = (path) => {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
};
async function waitFor(predicate) {
	for (let attempt = 0; attempt < 200; attempt++) {
		if (predicate()) return;
		await pause(50);
	}
	throw new Error("Loopback media observation timed out");
}
function launch(args, options = {}) {
	const child = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
	children.add(child);
	child.stderr?.resume();
	return child;
}
async function unusedPort() {
	const server = createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const port = server.address().port;
	await new Promise((resolve) => server.close(resolve));
	return port;
}
let outputs;
try {
	const compiled = join(home, "output.mjs");
	await build({ entryPoints: [fileURLToPath(new URL("../../src/output.ts", import.meta.url))], outfile: compiled, platform: "node", format: "esm", bundle: true });
	const { RunnerOutputs } = await import(pathToFileURL(compiled).href);
	const receivers = [];
	for (let index = 0; index < (process.argv.includes("--three") ? 3 : 2); index++) {
		const url = `rtmp://127.0.0.1:${await unusedPort()}/live/test`;
		const path = join(home, `receiver-${index}.flv`);
		const child = launch(["-hide_banner", "-loglevel", "error", "-y", "-listen", "1", "-i", url, "-c", "copy", "-flush_packets", "1", "-f", "flv", path]);
		receivers.push({ child, path, url });
	}
	// Only the encoder is synthetic; the fan-out and all receiver processes are real.
	const source = launch(["-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=10", "-f", "lavfi", "-i", "sine=frequency=440", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-g", "10", "-c:a", "aac", "-f", "mpegts", "pipe:1"]);
	outputs = new RunnerOutputs(
		ffmpeg,
		receivers.map((receiver, index) => ({ id: String(index), rtmpUrl: receiver.url, streamKey: null })),
		(child) => {
			children.add(child);
			child.stderr?.resume();
		},
	);
	outputs.connect(source);
	await waitFor(() => receivers.every((receiver) => bytes(receiver.path) > 4096));
	const ended = once(receivers[0].child, "close");
	receivers[0].child.kill("SIGKILL");
	await ended;
	const before = receivers.slice(1).map((receiver) => bytes(receiver.path));
	await waitFor(() => receivers.slice(1).every((receiver, index) => bytes(receiver.path) > before[index] + 4096));
	await pause(250);
	// Byte delivery and FFmpeg's periodic progress report are independent observations.
	for (let attempt = 0; attempt < 60 && outputs.snapshot?.().find((status) => status.id === "1")?.state !== "streaming"; attempt++) await pause(50);
	const statuses = outputs.snapshot?.() ?? [];
	let exhausted = false;
	if (process.argv.includes("--all-fail")) {
		const ended = once(receivers[1].child, "close");
		receivers[1].child.kill("SIGKILL");
		await ended;
		for (let attempt = 0; attempt < 400 && !exhausted; attempt++) {
			await pause(50);
			exhausted = outputs.snapshot?.().every((status) => status.state === "failed") ?? false;
		}
	}
	let recovered = false;
	let replacement;
	if (process.argv.includes("--recover")) {
		const path = join(home, "recovered.flv");
		const child = launch(["-hide_banner", "-loglevel", "error", "-y", "-listen", "1", "-i", receivers[0].url, "-c", "copy", "-flush_packets", "1", "-f", "flv", path]);
		replacement = { child, path, url: receivers[0].url };
		for (let attempt = 0; attempt < 160 && !recovered; attempt++) {
			await pause(50);
			recovered = bytes(path) > 4096;
		}
	}
	const healthyOutputStarts = [...children].filter((child) => child.spawnargs?.at(-1) === receivers[1].url && !child.spawnargs.includes("-listen")).length;
	const result = { exhausted, finalStates: outputs.snapshot?.() ?? [], outputStarts: [...children].filter((child) => !child.spawnargs?.includes("-listen") && child.spawnargs?.includes("pipe:0")).length, recovered, healthyOutputStarts, healthyContinued: true, failedState: statuses.find((status) => status.id === "0")?.state ?? null, healthyState: statuses.find((status) => status.id === "1")?.state ?? null };
	if (process.argv.includes("--decode")) {
		const sourceClosed = once(source, "close");
		source.kill("SIGTERM");
		await sourceClosed;
		await outputs.close(true);
		const live = [...receivers.slice(1), ...(replacement ? [replacement] : [])];
		for (const receiver of live) {
			if (receiver.child.exitCode !== null || receiver.child.signalCode !== null) continue;
			await Promise.race([once(receiver.child, "close"), pause(2000)]);
		}
		const decoded = live.map((receiver) => {
			try {
				return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_packets", "-show_streams", "-show_data_hash", "sha256", "-show_entries", "packet=codec_type,data_hash:stream=codec_type,codec_name,nb_read_frames", "-of", "json", receiver.path], { encoding: "utf8", timeout: 10000, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }));
			} catch {
				return { streams: [], packets: [] };
			}
		});
		result.decoded = decoded.map((media) => ({ video: media.streams.some((stream) => stream.codec_name === "h264" && Number(stream.nb_read_frames) > 0), audio: media.streams.some((stream) => stream.codec_name === "aac" && Number(stream.nb_read_frames) > 0) }));
		const hashes = decoded.map((media) => new Set(media.packets.filter((packet) => packet.codec_type === "video").map((packet) => packet.data_hash)));
		result.sameEncodedContent = [...hashes[0]].some((hash) => hash && hashes.every((set) => set.has(hash)));
		result.healthyStarts = receivers.slice(1).map((receiver) => [...children].filter((child) => child.spawnargs?.at(-1) === receiver.url && !child.spawnargs.includes("-listen")).length);
		result.encoderStarts = [...children].filter((child) => child.spawnargs?.includes("libx264")).length;
		result.allProcessesClosed = [...children].every((child) => child.exitCode !== null || child.signalCode !== null);
		result.socketsReleased = true;
		for (const receiver of receivers) {
			const server = createServer();
			try {
				await new Promise((resolve, reject) => {
					server.once("error", reject);
					server.listen(Number(new URL(receiver.url).port), "127.0.0.1", resolve);
				});
			} catch {
				result.socketsReleased = false;
			} finally {
				if (server.listening) await new Promise((resolve) => server.close(resolve));
			}
		}
	}
	process.stdout.write(JSON.stringify(result) + "\n");
} finally {
	await outputs?.close(false);
	await Promise.allSettled(
		[...children].map(async (child) => {
			if (child.exitCode !== null || child.signalCode !== null) return;
			const closed = once(child, "close");
			child.kill("SIGKILL");
			await closed;
		}),
	);
	rmSync(home, { recursive: true, force: true });
}
