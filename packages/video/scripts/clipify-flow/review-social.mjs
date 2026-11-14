import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { flowLayout } from "../../src/compositions/clipify-flow/layout.ts";
import { FLOW_DURATION, FLOW_FPS, T } from "../../src/compositions/clipify-flow/timeline.ts";

const directory = "out/flow-social-review";
mkdirSync(directory, { recursive: true });
function run(command, args) {
	const r = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024 });
	if (r.status !== 0) throw Error(r.stderr.toString());
	return { stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}
const ffmpeg = (args) => run("ffmpeg", ["-hide_banner", "-y", ...args]);
const probe = (path) => JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path]).stdout);
const audioHash = (path) => ffmpeg(["-v", "error", "-i", path, "-map", "0:a:0", "-c:a", "pcm_s16le", "-f", "hash", "-"]).stdout.trim();
const referenceAudio = audioHash("out/clipify-flow.mp4");
const frames = [42, 132, 170, 218, 224, 240, 252, 270, 276, 320, 336, 360, 364, 368, 372, 376, 380, 384, 468, 504, 540, 576, 600, 648, 672, 684, 732, 780, 839, T.endStart, T.endReveal, T.endContentOut, T.endHold, 900, FLOW_DURATION - 1];
const results = [];
for (const [format, height] of [
	["vertical", 1920],
	["feed", 1350],
]) {
	const path = `out/clipify-flow-${format}.mp4`;
	const dir = `${directory}/${format}`;
	mkdirSync(dir, { recursive: true });
	const metadata = probe(path);
	const video = metadata.streams.find((s) => s.codec_type === "video");
	const audio = metadata.streams.find((s) => s.codec_type === "audio");
	const silence = ffmpeg(["-i", path, "-vn", "-af", "silencedetect=noise=-45dB:d=0.04", "-f", "null", "-"]).stderr;
	writeFileSync(`${dir}/silence.log`, silence);
	ffmpeg(["-loglevel", "error", "-i", path, "-vf", `select='${frames.map((n) => `eq(n,${n})`).join("+")}',scale=540:-1`, "-fps_mode", "passthrough", `${dir}/frame-%02d.png`]);
	ffmpeg(["-loglevel", "error", "-i", path, "-vf", "fps=1,scale=216:-1,tile=6x5", "-frames:v", "1", `${dir}/overview.png`]);
	mkdirSync(`${dir}/queue-transfer`, { recursive: true });
	ffmpeg(["-loglevel", "error", "-i", path, "-vf", "select='between(n,360,384)'", "-fps_mode", "passthrough", `${dir}/queue-transfer/frame-%02d.png`]);
	ffmpeg(["-loglevel", "error", "-i", path, "-vf", "select='between(n,360,384)',scale=288:-1,tile=5x5", "-frames:v", "1", `${dir}/queue-transfer.png`]);
	const master = probe(`out/clipify-flow-${format}-master.mov`);
	const masterVideo = master.streams.find((s) => s.codec_type === "video");
	const masterAudio = master.streams.find((s) => s.codec_type === "audio");
	ffmpeg(["-loglevel", "error", "-i", `out/clipify-flow-${format}-master.mov`, "-vf", "select='eq(n,900)'", "-frames:v", "1", `out/clipify-flow-${format}-thumbnail.png`]);
	const checks = {
		resolution: video.width === 1080 && video.height === height,
		fpsAndDuration: video.r_frame_rate === "30/1" && video.nb_frames === String(FLOW_DURATION) && Math.abs(Number(video.duration) - FLOW_DURATION / FLOW_FPS) < 0.001,
		distribution: video.codec_name === "h264" && video.color_space === "bt709" && audio.codec_name === "aac" && audio.channels === 2 && audio.sample_rate === "48000",
		approvedDecodedAudioIdentical: audioHash(path) === referenceAudio,
		noAudioGaps: !silence.includes("silence_start"),
		master: masterVideo.codec_name === "prores" && masterVideo.profile === "4444" && masterVideo.width === 1080 && masterVideo.height === height && masterVideo.color_space === "bt709" && masterAudio.codec_name === "pcm_s16le",
	};
	results.push({ format, checks, metadata, master });
}
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const feed = flowLayout("feed");
const centers = ["intro", "moment", "source", "stream", "custom", "end", "other", "portrait"].map((key) => feed[key].y + feed[key].h / 2);
const vertical = flowLayout("vertical");
const geometry = {
	feedCenterlineSpread: Math.max(...centers) - Math.min(...centers),
	feedOverviewHeightDifference: Math.abs(feed.moment.h - feed.other.h),
	feedOverviewYDifference: Math.abs(feed.moment.y - feed.other.y),
	verticalClosingYTravel: Math.abs(vertical.end.y - vertical.custom.y),
};
const geometryPass = geometry.feedCenterlineSpread < 1e-8 && geometry.feedOverviewHeightDifference === 0 && geometry.feedOverviewYDifference === 0 && geometry.verticalClosingYTravel <= 60;
const previewSlots = ["landscape", "feed", "vertical"].map((format) => {
	const l = flowLayout(format),
		b = l.autoPanel.box,
		q = l.queue;
	const rightInset = b.x + b.w - q.x - q.w;
	const bottomInset = b.y + b.h - q.y - q.h;
	return { format, rightInset, bottomInset, passed: Math.abs(rightInset - l.autoPanel.inset) < 1e-8 && Math.abs(bottomInset - l.autoPanel.inset) < 1e-8 && q.x >= b.x + l.autoPanel.inset && q.y >= b.y + l.autoPanel.inset && Math.abs(q.w / q.h - 16 / 9) < 1e-8 };
});
const previewSlotsPass = previewSlots.every((s) => s.passed);
// Compare visible source pixels, not just the output container's aspect ratio.
// Interior patches exclude the added metadata cards and title gradient.
const sourceComparisons = [];
for (const [frame, sourceFrame, source] of [
	[60, 270, "backstab"],
	[540, 204, "minecraft"],
]) {
	const comparison = ffmpeg(["-i", "out/clipify-flow-feed.mp4", "-i", `public/clipify-flow/media/${source}-source.mp4`, "-filter_complex", `[0:v]select='eq(n,${frame})',crop=800:300:100:480,setpts=PTS-STARTPTS[a];[1:v]select='eq(n,${sourceFrame})',scale=900:506,crop=800:300:28:20,setpts=PTS-STARTPTS[b];[a][b]ssim`, "-frames:v", "1", "-an", "-f", "null", "-"]).stderr;
	writeFileSync(`${directory}/source-match-${source}.log`, comparison);
	sourceComparisons.push({ frame, source, ssim: Number(comparison.match(/All:([\d.]+)/)?.[1]) });
}
const sourceProportionsPass = sourceComparisons.every((c) => c.ssim > 0.97);
const music = readFileSync("public/clipify-flow/audio/music-only.wav");
const approvedMusic = readFileSync("public/clipify-flow/audio/approved-music-only.wav");
const bodyEnd = 44 + (T.endStart / FLOW_FPS) * 48000 * 4;
const report = { frames, geometry, geometryPass, previewSlots, previewSlotsPass, sourceComparisons, sourceProportionsPass, approvedMusicBodyPreserved: hash("public/clipify-flow/audio/approved-music-only.wav") === hash("public/clipify-rebuilt/audio/music-only.wav") && music.subarray(44, bodyEnd).equals(approvedMusic.subarray(44, bodyEnd)), results };
writeFileSync(`${directory}/checks.json`, JSON.stringify(report, null, 2) + "\n");
const passed = previewSlotsPass && sourceProportionsPass && geometryPass && report.approvedMusicBodyPreserved && results.every((r) => Object.values(r.checks).every(Boolean));
console.log(JSON.stringify({ passed, geometry, previewSlots, sourceComparisons, results: results.map(({ format, checks }) => ({ format, checks })) }, null, 2));
if (!passed) process.exitCode = 1;
