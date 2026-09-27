import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ADD_CLIPIFY_CLICK_FRAME, BOMB_IMPACT_FRAME, CHANNEL_POINTS_CLICK_FRAME, CLIP_CHAT_REVEAL_FRAMES, CLIPIFY_SHOWCASE_DURATION_IN_FRAMES, CLIPIFY_SHOWCASE_FPS, END_RESOLVE_FRAME, FEATURE_CARD_FRAMES, POSITIVE_REACTION_FRAMES, RESET_VIEWER_GAIN_FRAMES, REWARD_CLICK_FRAME, REWARD_IMPACT_FRAME, REWARD_REACTION_FRAMES, VIEWER_GAIN_FRAMES, VIEWER_LOSS_FRAMES } from "../../src/compositions/clipify-showcase/timeline.ts";

const SAMPLE_RATE = 48_000;
const FPS = CLIPIFY_SHOWCASE_FPS;
const DURATION = CLIPIFY_SHOWCASE_DURATION_IN_FRAMES / FPS;
const LENGTH = SAMPLE_RATE * DURATION;
const left = new Float64Array(LENGTH);
const right = new Float64Array(LENGTH);
let seed = 0x434c4950;

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const random = () => {
	seed ^= seed << 13;
	seed ^= seed >>> 17;
	seed ^= seed << 5;
	return ((seed >>> 0) % 1_000_000) / 1_000_000;
};
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);
const frameTime = (frame) => frame / FPS;

const mix = (index, value, pan = 0) => {
	if (index < 0 || index >= LENGTH) return;
	const angle = ((pan + 1) * Math.PI) / 4;
	left[index] += value * Math.cos(angle);
	right[index] += value * Math.sin(angle);
};

const synth = ({ start, duration, frequency, gain, pan = 0, attack = 0.02, release = 0.2, brightness = 0.3, glide = 0, wobble = 0 }) => {
	const first = Math.floor(start * SAMPLE_RATE);
	const count = Math.floor(duration * SAMPLE_RATE);
	for (let i = 0; i < count; i++) {
		const t = i / SAMPLE_RATE;
		const position = t / duration;
		const envelope = clamp(t / attack) * clamp((duration - t) / release);
		const freq = frequency * (1 + glide * (position - 0.5));
		const phase = TAU * freq * t + Math.sin(TAU * 3.2 * t) * wobble;
		const tone = Math.sin(phase) + Math.sin(phase * 2.002) * brightness * 0.45 + Math.sin(phase * 3.006) * brightness * 0.18;
		mix(first + i, tone * envelope * gain, pan);
	}
};

const pad = (start, duration, notes, gain = 0.035) => {
	for (const [index, midi] of notes.entries()) {
		synth({ start, duration, frequency: note(midi), gain, pan: (index - 1) * 0.42, attack: 0.75, release: 1.1, brightness: 0.42, wobble: 0.035 });
		synth({ start, duration, frequency: note(midi) * 1.006, gain: gain * 0.45, pan: (1 - index) * 0.52, attack: 0.9, release: 1.2, brightness: 0.18 });
	}
};

const pluck = (start, midi, gain = 0.075, pan = 0) => {
	const duration = 0.42;
	const first = Math.floor(start * SAMPLE_RATE);
	const count = Math.floor(duration * SAMPLE_RATE);
	const frequency = note(midi);
	for (let i = 0; i < count; i++) {
		const t = i / SAMPLE_RATE;
		const envelope = Math.exp(-t * 9.2) * clamp(t / 0.006);
		const phase = TAU * frequency * t;
		const value = Math.sin(phase) + 0.36 * Math.sin(phase * 2.01) + 0.14 * Math.sin(phase * 4.02);
		mix(first + i, value * envelope * gain, pan);
	}
};

const kick = (start, gain = 0.32) => {
	const duration = 0.42;
	const first = Math.floor(start * SAMPLE_RATE);
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const phase = TAU * (47 * t + (55 * (1 - Math.exp(-t * 22))) / 22);
		mix(first + i, Math.sin(phase) * Math.exp(-t * 10.5) * gain, 0);
	}
};

const snare = (start, gain = 0.11) => {
	const duration = 0.2;
	const first = Math.floor(start * SAMPLE_RATE);
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const noise = random() * 2 - 1;
		const body = Math.sin(TAU * 185 * t) * 0.3;
		mix(first + i, (noise * 0.7 + body) * Math.exp(-t * 18) * gain, (random() - 0.5) * 0.18);
	}
};

const hat = (start, gain = 0.035, pan = 0) => {
	const duration = 0.075;
	const first = Math.floor(start * SAMPLE_RATE);
	let previous = 0;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const noise = random() * 2 - 1;
		const high = noise - previous * 0.82;
		previous = noise;
		mix(first + i, high * Math.exp(-t * 45) * gain, pan);
	}
};

const whoosh = (start, duration = 0.55, gain = 0.075, direction = 1) => {
	const first = Math.floor(start * SAMPLE_RATE);
	let low = 0;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const position = t / duration;
		low += (random() * 2 - 1 - low) * (0.025 + position * 0.16);
		mix(first + i, low * Math.sin(Math.PI * position) ** 1.5 * gain, direction * (position * 1.5 - 0.75));
	}
};

const riser = (start, duration, gain = 0.12) => {
	const first = Math.floor(start * SAMPLE_RATE);
	let low = 0;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const position = t / duration;
		low += (random() * 2 - 1 - low) * (0.008 + position * 0.22);
		const tone = Math.sin(TAU * (90 * t + 270 * position ** 3));
		mix(first + i, (low * 0.65 + tone * 0.35) * position ** 1.7 * gain, Math.sin(position * Math.PI * 2) * 0.45);
	}
};

const impact = (start, gain = 0.5) => {
	kick(start, gain * 0.9);
	synth({ start, duration: 1.6, frequency: 43.65, gain: gain * 0.32, attack: 0.004, release: 1.4, brightness: 0.12, glide: -0.35 });
	const first = Math.floor(start * SAMPLE_RATE);
	for (let i = 0; i < 0.7 * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		mix(first + i, (random() * 2 - 1) * Math.exp(-t * 7.5) * gain * 0.2, 0);
	}
};

const click = (start, pitch = 950, gain = 0.11) => synth({ start, duration: 0.09, frequency: pitch, gain, attack: 0.001, release: 0.075, brightness: 0.6, glide: -0.2 });
const dun = (start, midi, gain = 0.16) => {
	synth({ start, duration: 0.62, frequency: note(midi), gain, attack: 0.004, release: 0.54, brightness: 0.22, glide: -0.22 });
};
const failureTone = (start, midi, duration = 0.34, gain = 0.095) => {
	synth({ start, duration, frequency: note(midi), gain, attack: 0.008, release: duration * 0.82, brightness: 0.12 });
	synth({ start, duration, frequency: note(midi - 12), gain: gain * 0.28, attack: 0.01, release: duration * 0.86, brightness: 0.05 });
};
const chime = (start, midi, gain = 0.055, duration = 0.48, pan = 0) => {
	synth({ start, duration, frequency: note(midi), gain, pan, attack: 0.004, release: duration * 0.82, brightness: 0.46 });
	synth({ start, duration: duration * 0.82, frequency: note(midi + 12), gain: gain * 0.26, pan: -pan, attack: 0.004, release: duration * 0.7, brightness: 0.22 });
};

const messageTick = (start, pan = 0) => {
	pluck(start, 76, 0.032, pan);
	synth({ start, duration: 0.16, frequency: note(88), gain: 0.018, pan: -pan, attack: 0.002, release: 0.13, brightness: 0.25, glide: -0.08 });
};

const uiPop = (start, midi, pan = 0) => {
	pluck(start, midi, 0.05, pan);
	synth({ start, duration: 0.2, frequency: note(midi - 12), gain: 0.025, pan, attack: 0.002, release: 0.16, brightness: 0.12, glide: -0.12 });
};

const reactionPop = (start, pan = 0) => {
	synth({ start, duration: 0.16, frequency: 176, gain: 0.034, pan, attack: 0.001, release: 0.14, brightness: 0.08, glide: -0.48 });
	synth({ start: start + 0.012, duration: 0.09, frequency: 410, gain: 0.013, pan: -pan * 0.5, attack: 0.001, release: 0.075, brightness: 0.12, glide: -0.62 });
};

const achievement = (start) => {
	impact(start, 0.2);
	[60, 64, 67, 72].forEach((midi, index) => {
		synth({ start: start + index * 0.025, duration: 1.65, frequency: note(midi), gain: 0.038, pan: (index - 1.5) * 0.24, attack: 0.025, release: 1.35, brightness: 0.3 });
	});
	synth({ start: start + 0.42, duration: 1.35, frequency: note(79), gain: 0.042, pan: 0.16, attack: 0.015, release: 1.1, brightness: 0.5, wobble: 0.025 });
	uiPop(start + 0.78, 84, -0.18);
};

// One continuous score: restrained while live, uneasy while viewers leave,
// then the same pulse opens into a playful major groove when Clipify lands.
pad(0, 4.9, [41, 48, 56], 0.026);
for (const beat of [0.35, 1.85, 3.35]) {
	kick(beat, 0.16);
}
whoosh(3.55, 0.5, 0.055, 1);

// Static break: two tight groups of three losses, with a pause between them.
// Every descending note and low hit lands on an actual viewer-count change.
pad(3.55, 8.35, [45, 52, 57], 0.018);
const viewerLossNotes = [64, 62, 60, 57, 55, 52];
VIEWER_LOSS_FRAMES.forEach((frame, index) => {
	const time = frameTime(frame);
	failureTone(time, viewerLossNotes[index], index === VIEWER_LOSS_FRAMES.length - 1 ? 0.82 : 0.34, 0.105 + index * 0.004);
	kick(time, 0.1 + index * 0.008);
});

// The pointer clicks "Add Clipify" before the logo drops and turns the existing
// pulse bright; the groove deliberately continues through the next title card.
click(frameTime(ADD_CLIPIFY_CLICK_FRAME), 880, 0.13);
riser(frameTime(ADD_CLIPIFY_CLICK_FRAME), 1.35, 0.14);
impact(frameTime(BOMB_IMPACT_FRAME), 0.62);
whoosh(frameTime(BOMB_IMPACT_FRAME) + 0.03, 1.35, 0.075, 1);
RESET_VIEWER_GAIN_FRAMES.forEach((frame, index) => chime(frameTime(frame), [72, 74, 76, 79, 81, 84][index], 0.027, 0.24, index % 2 ? 0.18 : -0.18));
const progression = [
	[48, 55, 64],
	[44, 51, 60],
	[53, 60, 69],
	[46, 53, 62],
];
for (let block = 0; block < 10; block++) pad(11.72 + block * 3, 3.18, progression[block % progression.length], block < 6 ? 0.034 : 0.038);
for (let time = 11.75, step = 0; time < 38.5; time += 0.5, step++) {
	if (step % 2 === 0) kick(time, time < 30.5 ? 0.24 : 0.2);
	else snare(time, time < 30.5 ? 0.085 : 0.067);
	hat(time + 0.25, time < 30.5 ? 0.025 : 0.019, step % 2 ? -0.5 : 0.5);
}
const arp = [65, 68, 72, 73, 72, 68, 63, 67];
for (let time = 12, index = 0; time < 30.5; time += 0.25, index++) pluck(time, arp[index % arp.length], 0.035 + Math.min(0.015, (time - 12) * 0.001), index % 2 ? 0.38 : -0.38);

// Chat, reaction bubbles, and viewer growth each have distinct cues. Reaction
// pops are deliberately non-musical; upward chimes are reserved for +1 viewer.
CLIP_CHAT_REVEAL_FRAMES.forEach((frame, index) => messageTick(frameTime(frame), index % 2 ? 0.28 : -0.28));
POSITIVE_REACTION_FRAMES.forEach((frame, index) => reactionPop(frameTime(frame), index % 2 ? 0.34 : -0.34));
VIEWER_GAIN_FRAMES.forEach((frame, index) => chime(frameTime(frame), [77, 81, 84, 88][index], 0.052, 0.46, index % 2 ? 0.3 : -0.3));

// Community reward: clicks, redemption, clip swap, and the longer reaction run
// are frame-synced.
click(frameTime(CHANNEL_POINTS_CLICK_FRAME), 720, 0.12);
click(frameTime(REWARD_CLICK_FRAME), 1080, 0.14);
impact(frameTime(REWARD_IMPACT_FRAME), 0.22);
whoosh(frameTime(REWARD_IMPACT_FRAME) + 0.02, 0.62, 0.07, -1);
REWARD_REACTION_FRAMES.forEach((frame, index) => messageTick(frameTime(frame), index % 2 ? 0.24 : -0.22));

// Feature cards use short, tactile confirmations instead of broad washes.
FEATURE_CARD_FRAMES.forEach((frame, index) => uiPop(frameTime(frame), [72, 76, 79][index], index === 1 ? 0 : index ? 0.24 : -0.24));

// End card: a warm, simultaneous success chord with one resolving shimmer.
// It reads as "achieved" rather than a cheap staircase or a theatrical ta-da.
pad(38.5, 6.5, [41, 48, 53, 56], 0.042);
achievement(frameTime(END_RESOLVE_FRAME));

// Gentle saturation, fades, and peak normalization.
let peak = 0;
for (let i = 0; i < LENGTH; i++) {
	const time = i / SAMPLE_RATE;
	const fade = clamp(time / 0.25) * clamp((DURATION - time) / 0.8);
	left[i] = Math.tanh(left[i] * 1.35) * fade;
	right[i] = Math.tanh(right[i] * 1.35) * fade;
	peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const scale = 0.92 / peak;
const wav = Buffer.allocUnsafe(44 + LENGTH * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + LENGTH * 4, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(LENGTH * 4, 40);
for (let i = 0; i < LENGTH; i++) {
	wav.writeInt16LE(Math.round(clamp(left[i] * scale, -1, 1) * 32767), 44 + i * 4);
	wav.writeInt16LE(Math.round(clamp(right[i] * scale, -1, 1) * 32767), 46 + i * 4);
}

const output = resolve("public/clipify-showcase/audio/clipify-trailer-original.wav");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, wav);
console.log(`Generated ${output} (${DURATION}s, stereo, ${SAMPLE_RATE}Hz)`);
