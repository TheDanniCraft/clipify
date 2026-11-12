/** Streaming speech-level estimate; gate silence and cap amplification to avoid lifting background noise. */
export function levelingGain(samples: Float32Array) {
	let sum = 0,
		peak = 0;
	for (const sample of samples) {
		sum += sample * sample;
		peak = Math.max(peak, Math.abs(sample));
	}
	const rms = Math.sqrt(sum / samples.length);
	if (!Number.isFinite(rms) || rms < 0.00316) return 1;
	return Math.max(0.1, Math.min(4, 0.1 / rms, 0.8 / peak));
}

export function attachEventAudio(media: HTMLMediaElement, onUnavailable: () => void) {
	let context: AudioContext;
	try {
		context = new AudioContext();
	} catch {
		onUnavailable();
		return null;
	}
	let timer: ReturnType<typeof setInterval> | undefined;
	try {
		let enabled = true;
		const source = context.createMediaElementSource(media),
			inputVolume = context.createGain(),
			outputVolume = context.createGain(),
			analyser = context.createAnalyser(),
			gain = context.createGain(),
			compressor = context.createDynamicsCompressor();
		analyser.fftSize = 2048;
		compressor.threshold.value = -18;
		compressor.knee.value = 12;
		compressor.ratio.value = 6;
		compressor.attack.value = 0.003;
		compressor.release.value = 0.25;
		source.connect(inputVolume);
		inputVolume.connect(analyser);
		analyser.connect(gain);
		gain.connect(compressor);
		compressor.connect(outputVolume);
		outputVolume.connect(context.destination);
		// Media-element volume is applied before Web Audio; preserve it after leveling instead.
		const syncVolume = () => {
			inputVolume.gain.value = enabled && media.volume > 0 ? 1 / media.volume : 1;
			outputVolume.gain.value = media.volume;
		};
		media.addEventListener("volumechange", syncVolume);
		syncVolume();
		const samples = new Float32Array(analyser.fftSize);
		const update = () => {
			if (!enabled || media.paused || context.state !== "running") return;
			analyser.getFloatTimeDomainData(samples);
			const target = levelingGain(samples);
			gain.gain.setTargetAtTime(target, context.currentTime, target < gain.gain.value ? 0.025 : 0.8);
		};
		const resume = () => {
			void context.resume().catch(onUnavailable);
		};
		media.addEventListener("play", resume);
		timer = setInterval(update, 50);
		resume();
		return {
			setEnabled(value: boolean) {
				if (enabled === value) return;
				enabled = value;
				syncVolume();
				gain.disconnect();
				if (enabled) gain.connect(compressor);
				else {
					gain.gain.cancelScheduledValues(context.currentTime);
					gain.gain.value = 1;
					gain.connect(context.destination);
				}
			},
			dispose() {
				clearInterval(timer);
				media.removeEventListener("play", resume);
				media.removeEventListener("volumechange", syncVolume);
				source.disconnect();
				inputVolume.disconnect();
				outputVolume.disconnect();
				analyser.disconnect();
				gain.disconnect();
				compressor.disconnect();
				void context.close().catch(() => {});
			},
		};
	} catch {
		clearInterval(timer);
		void context.close().catch(() => {});
		onUnavailable();
		return null;
	}
}
