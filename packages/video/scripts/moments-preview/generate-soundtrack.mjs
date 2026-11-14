import { mkdirSync, writeFileSync } from "node:fs";
import { EVENTS as DEFAULT_EVENTS, MOMENTS_DURATION, MOMENTS_FPS, MOMENTS_BPM } from "../../src/compositions/moments-preview/timeline.ts";

export function generateSoundtrack({ events: E = DEFAULT_EVENTS, frames = MOMENTS_DURATION, directory = "public/moments-preview/audio", trailer = false, continuous = false, cues } = {}) {
	const SR = 48000,
		duration = frames / MOMENTS_FPS,
		count = Math.round(duration * SR),
		beat = 60 / MOMENTS_BPM,
		tau = 2 * Math.PI;
	const music = [new Float64Array(count), new Float64Array(count)],
		fx = [new Float64Array(count), new Float64Array(count)];
	let seed = 41723;
	const noise = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 2147483648 - 1;
	};
	const midi = (n) => 440 * 2 ** ((n - 69) / 12);
	const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
	function voice(bus, start, len, fn, pan = 0) {
		const first = Math.round(start * SR);
		for (let i = 0; i < len * SR; i++) {
			const j = first + i;
			if (j < 0 || j >= count) continue;
			const v = fn(i / SR, i);
			bus[0][j] += v * Math.sqrt((1 - pan) / 2);
			bus[1][j] += v * Math.sqrt((1 + pan) / 2);
		}
	}
	function kick(t, g = 1) {
		voice(music, t, 0.24, (s) => g * (Math.sin(tau * (49 * s + (110 * (1 - Math.exp(-s * 48))) / 48)) * Math.exp(-s * 21) * 0.62 + noise() * Math.exp(-s * 200) * 0.085));
	}
	function snare(t, g = 1) {
		let low = 0;
		voice(music, t, 0.15, (s) => {
			const n = noise();
			low += (n - low) * 0.14;
			return g * ((n - low) * 0.24 + Math.sin(tau * 185 * s) * Math.exp(-s * 33) * 0.19) * Math.exp(-s * 24);
		});
		voice(music, t + 0.012, 0.09, (s) => noise() * 0.12 * g * Math.exp(-s * 45), 0.12);
	}
	function hat(t, g = 0.07, open = false, pan = 0) {
		let prev = 0;
		voice(
			music,
			t,
			open ? 0.14 : 0.045,
			(s) => {
				const n = noise();
				const v = n - prev;
				prev = n;
				return v * g * Math.exp(-s * (open ? 25 : 95));
			},
			pan,
		);
	}
	function bass(t, n, len, accent) {
		const hz = midi(n);
		let low = 0,
			phase = 0;
		voice(music, t, len, (s) => {
			phase += hz / SR;
			const saw = 2 * (phase % 1) - 1;
			const cutoff = 0.065 + 0.16 * Math.exp(-s * 35);
			low += (saw - low) * cutoff;
			const env = clamp(s / 0.002) * clamp((len - s) / 0.025) * Math.exp(-s * 4);
			return Math.tanh((low * 0.9 + Math.sin(tau * phase) * 0.45) * 2.8) * env * (accent ? 0.25 : 0.2);
		});
	}
	function stab(t, n, g = 0.06) {
		voice(
			music,
			t,
			0.12,
			(s) => {
				const env = clamp(s / 0.0015) * Math.exp(-s * 37);
				const hz = midi(n);
				const signal = [1, 2, 3, 4, 5].reduce((sum, k) => sum + Math.sin(tau * hz * k * s) / k, 0);
				return Math.tanh(signal * 1.9) * env * g;
			},
			0.23,
		);
	}

	// Eight 150 BPM bars: tight electro rhythm, a moving bass hook, two fills,
	// and a short transition pocket. No pad layer or slow chord envelopes.
	function arrangeStep(t, bar, step, root, riff) {
		if ([0, 6, 8, 11].includes(step) || (bar >= 4 && step === 14)) kick(t, step === 0 ? 1 : 0.8);
		if (step === 4 || step === 12) snare(t, bar >= 4 ? 1.12 : 1);
		hat(t, step % 2 === 0 ? 0.063 : 0.034, step === 10, step % 2 === 0 ? -0.3 : 0.3);
		if (riff[step] !== null) bass(t, root + riff[step], step === 0 ? 0.16 : 0.083, step % 4 === 0);
		if ([2, 7, 10, 15].includes(step)) stab(t, root + 36 + [0, 7, 3, 10][[2, 7, 10, 15].indexOf(step)], bar >= 4 ? 0.075 : 0.052);
		if (trailer && bar >= 18 && step % 4 === 0) stab(t, root + 48, 0.04);
	}
	function arrangeMusic() {
		const riff = [0, null, 0, 12, null, 7, 0, null, 3, null, 0, 10, null, 7, 12, 7];
		for (let bar = 0; bar < Math.ceil(duration / (beat * 4)); bar++) {
			const start = bar * beat * 4,
				root = [33, 33, 36, 33, 33, 36, 38, 33][bar % 8];
			for (let step = 0; step < 16; step++) {
				const t = start + (step * beat) / 4;
				const pocket = !continuous && (bar === 3 || (trailer && [8, 12, 18].includes(bar))) && step < 4;
				if (!pocket) {
					arrangeStep(t, bar, step, root, riff);
				}
			}
			if ([1, 3, 5, 6].includes(bar % 8)) for (let i = 0; i < 4; i++) snare(start + beat * 3.5 + (i * beat) / 8, 0.22 + i * 0.12);
		}
	}
	arrangeMusic();

	const sec = (f) => f / MOMENTS_FPS;
	function click(f, g = 0.14) {
		voice(fx, sec(f), 0.037, (s) => (noise() * 0.8 + Math.sin(tau * 1200 * s) * 0.2) * Math.exp(-s * 150) * g);
	}
	function impact(f, g = 0.32) {
		voice(fx, sec(f), 0.22, (s) => (Math.sin(tau * (55 * s + (55 * (1 - Math.exp(-s * 40))) / 40)) * Math.exp(-s * 20) + noise() * 0.18 * Math.exp(-s * 75)) * g);
	}
	function sweep(f, len = 0.22) {
		let low = 0;
		voice(
			fx,
			sec(f),
			len,
			(s) => {
				const n = noise();
				low += (n - low) * 0.08;
				const env = Math.sin((Math.PI * s) / len) ** 2;
				return (n - low) * env * 0.12;
			},
			-0.16,
		);
	}
	function arrangeEffects() {
		if (cues) {
			for (const { frame, type, gain } of cues) {
				if (type === "click") click(frame, gain);
				if (type === "impact") impact(frame, gain);
				if (type === "sweep") sweep(frame);
				if (type === "resolve") {
					impact(frame, gain ?? 0.3);
					[57, 64, 69].forEach((n, i) => voice(fx, sec(frame), 0.23, (s) => Math.sin(tau * midi(n) * s) * clamp(s / 0.003) * Math.exp(-s * 24) * 0.045, (i - 1) * 0.3));
				}
			}
		} else {
			impact(E.opening, 0.23);
			E.moments.forEach((f) => click(f, 0.095));
			click(E.select, 0.24);
			sweep(E.lift);
			impact(E.lift, 0.32);
			sweep(E.editor, 0.26);
			[E.camera, E.gameplay, E.title].forEach((f, i) => {
				click(f, 0.17);
				if (i < 2) impact(f, 0.16);
			});
			click(E.export, 0.25);
			impact(E.ready, 0.3);
			[57, 64, 69].forEach((n, i) => voice(fx, sec(E.ready), 0.23, (s) => Math.sin(tau * midi(n) * s) * clamp(s / 0.003) * Math.exp(-s * 24) * 0.045, (i - 1) * 0.3));
			impact(E.payoff, 0.2);

			if (trailer) {
				click(E.group, 0.1);
				click(E.sceneSwitch, 0.18);
				sweep(E.sceneSwitch);
				E.pool.forEach((f) => click(f, 0.09));
				[E.autoNext, E.requestPlay, E.fuel].forEach((f) => impact(f, 0.25));
				[E.redemption, E.queued, E.widgetMove].forEach((f) => click(f, 0.17));
				E.styles.forEach((f) => click(f, 0.2));
				sweep(E.gallery);
				E.tiles.forEach((f) => click(f, 0.09));
				click(E.galleryOpen, 0.2);
				sweep(E.payoff);
				sweep(E.brand);
				impact(E.brand, 0.3);
				impact(E.cta, 0.17);
				[57, 64, 69].forEach((n, i) => voice(music, sec(E.brand), 0.7, (s) => Math.sin(tau * midi(n) * s) * clamp(s / 0.003) * Math.exp(-s * 7) * 0.055, (i - 1) * 0.3));
			}
		}
	}
	arrangeEffects();

	mkdirSync(directory, { recursive: true });
	function write(name, bus) {
		const wav = Buffer.alloc(44 + count * 4);
		wav.write("RIFF");
		wav.writeUInt32LE(36 + count * 4, 4);
		wav.write("WAVEfmt ", 8);
		wav.writeUInt32LE(16, 16);
		wav.writeUInt16LE(1, 20);
		wav.writeUInt16LE(2, 22);
		wav.writeUInt32LE(SR, 24);
		wav.writeUInt32LE(SR * 4, 28);
		wav.writeUInt16LE(4, 32);
		wav.writeUInt16LE(16, 34);
		wav.write("data", 36);
		wav.writeUInt32LE(count * 4, 40);
		let peak = 0;
		const processed = bus.map((channel) =>
			channel.map((v, i) => {
				const fade = clamp(i / (SR * 0.006)) * clamp((count - i) / (SR * 0.13));
				const value = Math.tanh(v * 2.15) * fade;
				peak = Math.max(peak, Math.abs(value));
				return value;
			}),
		);
		const gain = 0.88 / Math.max(0.01, peak);
		for (let i = 0; i < count; i++) for (let c = 0; c < 2; c++) wav.writeInt16LE(Math.round(clamp(processed[c][i] * gain, -1, 1) * 32767), 44 + i * 4 + c * 2);
		writeFileSync(`${directory}/${name}.wav`, wav);
	}
	write("music-only", music);
	const duckFrames = cues ? cues.filter((cue) => cue.type !== "sweep").map((cue) => cue.frame) : [E.select, E.camera, E.gameplay, E.title, E.export, E.ready];
	const mix = music.map((channel, c) =>
		channel.map((v, i) => {
			const frame = (i / SR) * MOMENTS_FPS;
			const near = duckFrames.some((f) => frame >= f && frame < f + 3);
			return v * (near ? 0.74 : 1) + fx[c][i];
		}),
	);
	write("mix", mix);
	console.log(`Generated ${duration}s at ${MOMENTS_BPM} BPM: music-only.wav and mix.wav`);
}

if (import.meta.main) generateSoundtrack();
