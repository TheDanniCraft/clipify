import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CLIPIFY_PULSE_DURATION_IN_FRAMES, CLIPIFY_PULSE_FPS, PULSE_CUE_FRAMES } from "../../src/compositions/clipify-pulse/timeline.ts";

const SAMPLE_RATE = 48_000;
const FPS = CLIPIFY_PULSE_FPS;
const DURATION = CLIPIFY_PULSE_DURATION_IN_FRAMES / FPS;
const LENGTH = Math.floor(SAMPLE_RATE * DURATION);
const left = new Float64Array(LENGTH);
const right = new Float64Array(LENGTH);
const TAU = Math.PI * 2;
let seed = 0x50554c53;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const frameTime = (frame) => frame / FPS;
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);
const random = () => {
	seed ^= seed << 13;
	seed ^= seed >>> 17;
	seed ^= seed << 5;
	return ((seed >>> 0) % 1_000_000) / 1_000_000;
};

const mix = (index, value, pan = 0) => {
	if (index < 0 || index >= LENGTH) return;
	const angle = ((pan + 1) * Math.PI) / 4;
	left[index] += value * Math.cos(angle);
	right[index] += value * Math.sin(angle);
};

const synth = ({ start, duration, frequency, gain, pan = 0, attack = 0.01, release = 0.1, brightness = 0.2, glide = 0, drive = 1 }) => {
	const first = Math.floor(start * SAMPLE_RATE);
	const count = Math.floor(duration * SAMPLE_RATE);
	for (let i = 0; i < count; i++) {
		const t = i / SAMPLE_RATE;
		const position = t / duration;
		const envelope = clamp(t / attack) * clamp((duration - t) / release);
		const frequencyAtTime = frequency * (1 + glide * position);
		const phase = TAU * frequencyAtTime * t;
		const raw = Math.sin(phase) + Math.sin(phase * 2.001) * brightness * 0.38 + Math.sin(phase * 3.002) * brightness * 0.12;
		mix(first + i, Math.tanh(raw * drive) * envelope * gain, pan);
	}
};

const kick = (start, gain = 0.36) => {
	const first = Math.floor(start * SAMPLE_RATE);
	const duration = 0.42;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const phase = TAU * (44 * t + (78 * (1 - Math.exp(-t * 28))) / 28);
		const click = (random() * 2 - 1) * Math.exp(-t * 95) * 0.08;
		mix(first + i, (Math.sin(phase) * Math.exp(-t * 10.5) + click) * gain, 0);
	}
};

const snare = (start, gain = 0.13) => {
	const first = Math.floor(start * SAMPLE_RATE);
	const duration = 0.24;
	let low = 0;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const noise = random() * 2 - 1;
		low += (noise - low) * 0.28;
		const crisp = noise - low * 0.58;
		const body = Math.sin(TAU * 172 * t) * 0.28;
		mix(first + i, (crisp * 0.8 + body) * Math.exp(-t * 17) * gain, (random() - 0.5) * 0.16);
	}
};

const hat = (start, gain = 0.035, pan = 0) => {
	const first = Math.floor(start * SAMPLE_RATE);
	const duration = 0.072;
	let previous = 0;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const noise = random() * 2 - 1;
		const high = noise - previous * 0.86;
		previous = noise;
		mix(first + i, high * Math.exp(-t * 48) * gain, pan);
	}
};

const bass = (start, midi, duration = 0.38, gain = 0.105) => {
	const frequency = note(midi);
	const first = Math.floor(start * SAMPLE_RATE);
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const envelope = clamp(t / 0.008) * Math.exp(-t * 3.9) * clamp((duration - t) / 0.08);
		const phase = TAU * frequency * t;
		const raw = Math.sin(phase) + 0.34 * Math.sin(phase * 2) + 0.1 * Math.sin(phase * 3);
		mix(first + i, Math.tanh(raw * 1.4) * envelope * gain, 0);
	}
};

const pad = (start, duration, notes, gain = 0.021) => {
	for (const [index, midi] of notes.entries()) {
		synth({ start, duration, frequency: note(midi), gain, pan: (index - 1) * 0.36, attack: 0.55, release: 0.8, brightness: 0.14, drive: 0.85 });
		synth({ start, duration, frequency: note(midi) * 1.004, gain: gain * 0.45, pan: (1 - index) * 0.4, attack: 0.7, release: 0.9, brightness: 0.07, drive: 0.8 });
	}
};

const pulse = (start, midi, gain = 0.038, pan = 0) => {
	const duration = 0.18;
	const first = Math.floor(start * SAMPLE_RATE);
	const frequency = note(midi);
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const envelope = clamp(t / 0.004) * Math.exp(-t * 15);
		const phase = TAU * frequency * t;
		const raw = Math.sign(Math.sin(phase)) * 0.28 + Math.sin(phase) * 0.72;
		mix(first + i, Math.tanh(raw * 1.35) * envelope * gain, pan);
	}
};

const whoosh = (start, duration = 0.48, gain = 0.085, direction = 1) => {
	const first = Math.floor(start * SAMPLE_RATE);
	let low = 0;
	for (let i = 0; i < duration * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const position = t / duration;
		low += (random() * 2 - 1 - low) * (0.018 + position * 0.21);
		const envelope = Math.sin(Math.PI * position) ** 1.4;
		mix(first + i, low * envelope * gain, direction * (position * 1.5 - 0.75));
	}
};

const impact = (start, gain = 0.44, tail = 0.85) => {
	kick(start, gain * 0.9);
	synth({ start, duration: tail, frequency: 42, gain: gain * 0.19, attack: 0.002, release: tail * 0.9, brightness: 0.04, glide: -0.34, drive: 1.3 });
	const first = Math.floor(start * SAMPLE_RATE);
	for (let i = 0; i < Math.min(tail, 0.55) * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		mix(first + i, (random() * 2 - 1) * Math.exp(-t * 10) * gain * 0.09, 0);
	}
};

const click = (start) => {
	const first = Math.floor(start * SAMPLE_RATE);
	for (let i = 0; i < 0.07 * SAMPLE_RATE; i++) {
		const t = i / SAMPLE_RATE;
		const transient = (random() * 2 - 1) * Math.exp(-t * 55);
		const body = Math.sin(TAU * 420 * t) * Math.exp(-t * 38);
		mix(first + i, (transient * 0.65 + body * 0.35) * 0.095, 0.12);
	}
};

const finalResolve = (start) => {
	impact(start, 0.36, 1.5);
	pad(start, DURATION - start, [41, 48, 53, 56], 0.037);
	synth({ start, duration: 2.5, frequency: note(65), gain: 0.024, pan: -0.18, attack: 0.24, release: 1.8, brightness: 0.16, drive: 0.9 });
};

// The reference uses an irregular designed pulse rather than an unbroken
// four-on-the-floor loop. These deterministic accents follow that energy arc:
// restrained opening, dense product reveals, a brief middle pocket, a strong
// kinetic payoff, and a resolved brand hold.
const grooveFrames = [75, 81, 91, 108, 124, 139, 153, 168, 180, 193, 200, 216, 231, 246, 261, 279, 285, 300, 315, 330, 345, 360, 375, 390, 405, 424, 440, 456, 472, 488, 503, 518, 532, 548, 564, 580, 596, 612];
const bassPattern = [41, 48, 44, 53, 41, 46, 39, 48, 41, 53, 48, 56];
const textureFrames = [91, 108, 153, 216, 246, 300, 330, 360, 405, 472, 488, 548, 580, 612];
const sectionEnergy = (frame) => {
	if (frame < 75) return 0.26;
	if (frame < 180) return 0.82;
	if (frame < 285) return 0.66;
	if (frame < 390) return 0.54;
	if (frame < 503) return 0.74;
	if (frame < 630) return 1;
	return 0.34;
};

pad(0, frameTime(81), [41, 48, 56], 0.014);
pad(frameTime(69), frameTime(186 - 69), [44, 51, 60], 0.026);
pad(frameTime(174), frameTime(291 - 174), [41, 48, 53], 0.022);
pad(frameTime(279), frameTime(396 - 279), [46, 53, 58], 0.018);
pad(frameTime(384), frameTime(509 - 384), [48, 56, 63], 0.023);
pad(frameTime(497), frameTime(636 - 497), [41, 53, 60], 0.03);

grooveFrames.forEach((frame, index) => {
	const energy = sectionEnergy(frame);
	const time = frameTime(frame);
	if (index % 3 === 1) snare(time, 0.105 * energy);
	else kick(time, 0.27 * energy);
	bass(time + 0.018, bassPattern[index % bassPattern.length], 0.32, 0.095 * energy);
	hat(frameTime(frame + (index % 2 ? 5 : 7)), 0.028 * energy, index % 2 ? 0.42 : -0.42);
	if (index % 4 === 2) hat(frameTime(frame + 10), 0.018 * energy, index % 2 ? -0.25 : 0.25);
});

textureFrames.forEach((frame, index) => pulse(frameTime(frame), [60, 65, 63, 68, 65, 60, 67, 63][index % 8], 0.022 * sectionEnergy(frame), index % 2 ? 0.28 : -0.28));

PULSE_CUE_FRAMES.openingWords.forEach((frame, index) => {
	pulse(frameTime(frame), [53, 56, 60][index], 0.018 + index * 0.004, index === 1 ? 0.18 : -0.18);
	impact(frameTime(frame), 0.07 + index * 0.015, 0.26);
});
whoosh(frameTime(PULSE_CUE_FRAMES.playlistWhoosh), 0.42, 0.09, 1);
impact(frameTime(PULSE_CUE_FRAMES.playlistImpact), 0.36, 0.72);
click(frameTime(PULSE_CUE_FRAMES.playlistSnap));
whoosh(frameTime(PULSE_CUE_FRAMES.styleWhoosh), 0.42, 0.085, -1);
impact(frameTime(PULSE_CUE_FRAMES.styleImpact), 0.31, 0.62);
PULSE_CUE_FRAMES.paletteClicks.forEach((frame) => click(frameTime(frame)));
whoosh(frameTime(PULSE_CUE_FRAMES.broadcastWhoosh), 0.42, 0.095, 1);
impact(frameTime(PULSE_CUE_FRAMES.broadcastImpact), 0.37, 0.8);
whoosh(frameTime(PULSE_CUE_FRAMES.controlsWhoosh), 0.42, 0.085, -1);
impact(frameTime(PULSE_CUE_FRAMES.controlsImpact), 0.29, 0.62);
PULSE_CUE_FRAMES.controlPresses.forEach((frame) => click(frameTime(frame)));
PULSE_CUE_FRAMES.momentumWords.forEach((frame, index) => impact(frameTime(frame), index === 2 ? 0.34 : 0.27, 0.48));
whoosh(frameTime(PULSE_CUE_FRAMES.endWhoosh), 0.45, 0.1, 0);
finalResolve(frameTime(PULSE_CUE_FRAMES.endResolve));
impact(frameTime(PULSE_CUE_FRAMES.endCta), 0.2, 0.48);

// Gentle saturation, short fades, and deterministic peak normalization.
let peak = 0;
for (let i = 0; i < LENGTH; i++) {
	const time = i / SAMPLE_RATE;
	const fade = clamp(time / 0.045) * clamp((DURATION - time) / 0.72);
	left[i] = Math.tanh(left[i] * 4.8) * fade;
	right[i] = Math.tanh(right[i] * 4.8) * fade;
	peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}

const scale = peak > 0 ? 0.94 / peak : 1;
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

const output = resolve("public/clipify-pulse/audio/clipify-pulse-original.wav");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, wav);
console.log(`Generated ${output} (${DURATION}s, stereo, ${SAMPLE_RATE}Hz)`);
