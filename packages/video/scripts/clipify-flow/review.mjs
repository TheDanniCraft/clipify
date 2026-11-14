import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { FLOW_CUES, FLOW_DURATION, FLOW_FPS, T } from "../../src/compositions/clipify-flow/timeline.ts";

const target = "out/clipify-flow.mp4";
const directory = "out/flow-review";
mkdirSync(`${directory}/frames`, { recursive: true });
mkdirSync(`${directory}/seconds`, { recursive: true });
mkdirSync(`${directory}/details`, { recursive: true });
function run(args) {
	const result = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 32 * 1024 * 1024 });
	if (result.status !== 0) throw Error(result.stderr.toString());
	return result.stderr.toString();
}
const probe = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", target]);
if (probe.status !== 0) throw Error(probe.stderr.toString());
const metadata = JSON.parse(probe.stdout.toString());
const silence = run(["-i", target, "-vn", "-af", "silencedetect=noise=-45dB:d=0.04", "-f", "null", "-"]);
writeFileSync(`${directory}/silence.log`, silence);
// Reconstruct the stacked output independently from the source frame and compare
// camera and gameplay together. The source trim is 210 frames, so 270 -> 480.
run(["-i", "public/clipify-flow/media/backstab-source.mp4", "-filter_complex", "[0:v]select='eq(n,480)',split=2[c][g];[c]crop=224:126:1044:32,scale=342:192[c1];[g]crop=592:720:344:0,scale=342:416[g1];[c1][g1]vstack", "-frames:v", "1", `${directory}/expected-mobile.png`]);
run(["-i", target, "-vf", "select='eq(n,270)',crop=342:608:1400:350", "-frames:v", "1", `${directory}/actual-mobile.png`]);
const cropMatch = run(["-i", `${directory}/actual-mobile.png`, "-i", `${directory}/expected-mobile.png`, "-lavfi", "ssim", "-f", "null", "-"]);
writeFileSync(`${directory}/crop-match.log`, cropMatch);
const ssim = Number(cropMatch.match(/All:([\d.]+)/)?.[1]);
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const bodyEnd = 44 + (T.endStart / FLOW_FPS) * 48000 * 4;
const musicMatches = hash("public/clipify-flow/audio/approved-music-only.wav") === hash("public/clipify-rebuilt/audio/music-only.wav") && readFileSync("public/clipify-flow/audio/music-only.wav").subarray(44, bodyEnd).equals(readFileSync("public/clipify-flow/audio/approved-music-only.wav").subarray(44, bodyEnd));
const logoMatches = hash("public/clipify-flow/media/clipify-logo.svg") === hash("../../src/app/icon.svg");
run(["-loglevel", "error", "-i", target, "-vf", "scale=960:540", "-fps_mode", "passthrough", `${directory}/frames/frame-%04d.png`]);
run(["-loglevel", "error", "-i", target, "-vf", "scale=320:180,tile=6x5", "-fps_mode", "passthrough", `${directory}/seconds/second-%02d.png`]);
const details = [6, 18, 42, 130, 170, 210, 218, 224, 240, 252, 270, 276, 320, T.stream, T.next, T.next + 12, T.nextLand, 468, 480, 504, 540, 576, 600, 648, 672, 684, 700, 732, 780, 839, T.endStart, T.endContentOut, T.endHold, 900, FLOW_DURATION - 1];
run(["-loglevel", "error", "-i", target, "-vf", `select='${details.map((n) => `eq(n,${n})`).join("+")}'`, "-fps_mode", "passthrough", `${directory}/details/detail-%02d.png`]);
writeFileSync(`${directory}/detail-frames.json`, JSON.stringify(details, null, 2));
writeFileSync(`${directory}/cues.csv`, "frame,seconds,cue\n" + FLOW_CUES.map((c) => `${c.frame},${(c.frame / 30).toFixed(3)},${c.type}`).join("\n") + "\n");
const report = { metadata, musicMatchesPreviousContinuousBed: musicMatches, officialLogoMatches: logoMatches, cropSourceOutputSsimAtFrame270: ssim, unintendedSilence: silence.includes("silence_start"), frameExport: "Every frame at 960×540; 31 one-second contact sheets; selected detail PNGs at native 1920×1080", detailFrames: details, timeline: T };
writeFileSync(`${directory}/checks.json`, JSON.stringify(report, null, 2) + "\n");
const fail = !musicMatches || !logoMatches || silence.includes("silence_start") || !(ssim > 0.9);
console.log(JSON.stringify({ musicMatches, logoMatches, cropSourceOutputSsim: ssim, noAudioGaps: !silence.includes("silence_start"), totalVideoFrames: metadata.streams[0].nb_frames, result: fail ? "CHECK FAILED" : "PASS" }));
if (fail) process.exitCode = 1;
