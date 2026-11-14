import { generateSoundtrack } from "../moments-preview/generate-soundtrack.mjs";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { FLOW_DURATION, FLOW_FPS, FLOW_CUES, T } from "../../src/compositions/clipify-flow/timeline.ts";

const directory = "public/clipify-flow/audio";
if (!existsSync(`${directory}/approved-mix.wav`) || !existsSync(`${directory}/approved-music-only.wav`)) {
	generateSoundtrack({ frames: T.endHold, directory: `${directory}/approved-source`, trailer: true, continuous: true, cues: FLOW_CUES.filter((c) => c.frame < T.endStart) });
	copyFileSync(`${directory}/approved-source/mix.wav`, `${directory}/approved-mix.wav`);
	copyFileSync(`${directory}/approved-source/music-only.wav`, `${directory}/approved-music-only.wav`);
}
// Keep the accepted body sample-for-sample, then continue the same procedural
// score before its former fade-out. Never loop a faded compressed soundtrack.
generateSoundtrack({ frames: FLOW_DURATION, directory: `${directory}/extended`, trailer: true, continuous: true, cues: FLOW_CUES });
const rate = 48000;
const first = (T.endStart * rate) / FLOW_FPS;
const last = (T.endContentOut * rate) / FLOW_FPS;
for (const [name, approved] of [
	["mix", "approved-mix"],
	["music-only", "approved-music-only"],
]) {
	const baseline = readFileSync(`${directory}/${approved}.wav`);
	const extended = readFileSync(`${directory}/extended/${name}.wav`);
	if (baseline.readUInt32LE(24) !== rate || baseline.length !== 44 + ((T.endHold * rate) / FLOW_FPS) * 4) throw Error("The approved 28.8-second PCM source is required");
	const output = Buffer.from(extended);
	for (let i = 0; i < last; i++) {
		const blend = Math.max(0, Math.min(1, (i - first) / (last - first)));
		for (let channel = 0; channel < 2; channel++) {
			const offset = 44 + i * 4 + channel * 2;
			output.writeInt16LE(Math.round(baseline.readInt16LE(offset) * (1 - blend) + extended.readInt16LE(offset) * blend), offset);
		}
	}
	if (!output.subarray(44, 44 + first * 4).equals(baseline.subarray(44, 44 + first * 4))) throw Error("Approved soundtrack body changed");
	writeFileSync(`${directory}/${name}.wav`, output);
}
console.log("Preserved the approved first 28 seconds; continued the same score through the end screen.");
