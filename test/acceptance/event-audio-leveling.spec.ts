import { readFileSync } from "node:fs";
import { transpileModule, ScriptTarget, ModuleKind } from "typescript";
import { test, expect } from "@playwright/test";

test("streaming leveling reduces a quiet-to-scream jump and releases its audio graph", async ({ page }) => {
	await page.setContent("<button>Start audio test</button>");
	const source = readFileSync("src/app/lib/eventAudio.ts", "utf8").replaceAll("export function", "function");
	await page.addScriptTag({ content: transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.None } }).outputText });
	await page.getByRole("button").click();
	const result = await page.evaluate(async () => {
		const rate = 24000,
			duration = 16,
			buffer = new ArrayBuffer(44 + rate * duration * 2),
			view = new DataView(buffer);
		const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
		write(0, "RIFF");
		view.setUint32(4, buffer.byteLength - 8, true);
		write(8, "WAVEfmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, rate, true);
		view.setUint32(28, rate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		write(36, "data");
		view.setUint32(40, rate * duration * 2, true);
		for (let i = 0; i < rate * duration; i++) view.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 440 * i) / rate) * (i < rate * 4 ? 0.025 : 0.6) * 32767, true);
		const url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" })),
			media = document.createElement("audio");
		media.src = url;
		document.body.append(media);
		let context: AudioContext | undefined, output: AnalyserNode | undefined;
		const connect = AudioNode.prototype.connect;
		AudioNode.prototype.connect = function (destination: AudioNode | AudioParam, ...args: number[]) {
			if (destination instanceof AudioDestinationNode) {
				output = this.context.createAnalyser();
				output.fftSize = 2048;
				context = output.context as AudioContext;
				Reflect.apply(connect, this, [output]);
			}
			return Reflect.apply(connect, this, [destination, ...args]);
		};
		const attach = (window as unknown as { attachEventAudio: (media: HTMLMediaElement, fail: () => void) => { setEnabled: (value: boolean) => void; dispose: () => void } }).attachEventAudio;
		let failures = 0;
		const engine = attach(media, () => failures++);
		await media.play();
		const bypass: number[] = [],
			quieter: number[] = [],
			muted: number[] = [],
			quiet: number[] = [],
			loud: number[] = [],
			samples = new Float32Array(2048);
		await new Promise<void>((resolve) => {
			const timer = setInterval(() => {
				output!.getFloatTimeDomainData(samples);
				const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
				if (media.currentTime > 3 && media.currentTime < 3.8) quiet.push(rms);
				if (media.currentTime > 7 && media.currentTime < 7.3) loud.push(rms);
				if (media.currentTime > 7.4 && media.currentTime < 8) media.muted = true;
				if (media.currentTime > 8) {
					media.muted = false;
					media.volume = 0.2;
				}
				if (media.currentTime > 11 && media.currentTime < 11.8) quieter.push(rms);
				if (media.currentTime > 12) engine.setEnabled(false);
				if (media.currentTime > 15) bypass.push(rms);
				if (media.currentTime > 7.7 && media.currentTime < 8) muted.push(rms);
				if (media.ended) {
					clearInterval(timer);
					resolve();
				}
			}, 50);
		});
		engine.setEnabled(false);
		engine.setEnabled(true);
		engine.dispose();
		await new Promise((resolve) => setTimeout(resolve, 100));
		media.remove();
		URL.revokeObjectURL(url);
		AudioNode.prototype.connect = connect;
		const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
		return { quiet: average(quiet), loud: average(loud), muted: average(muted), quieter: average(quieter), bypass: average(bypass), failures, state: context!.state };
	});
	console.log("Measured event audio", result);
	expect(result.failures).toBe(0);
	expect(result.quiet).toBeGreaterThan(0.03);
	expect(result.loud).toBeLessThan(0.25);
	expect(result.muted).toBeLessThan(0.001);
	expect(result.quieter / result.loud).toBeLessThan(0.4);
	expect(result.bypass).toBeGreaterThan(0.07);
	expect(result.bypass).toBeLessThan(0.1);
	expect(result.loud / result.quiet).toBeLessThan(3);
	expect(result.state).toBe("closed");
});
