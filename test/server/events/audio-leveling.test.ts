import { levelingGain } from "@/app/lib/eventAudio";
it("brings quiet and loud speech closer without boosting silence or exceeding the gain cap", () => {
	const quiet = new Float32Array(2048).fill(0.025),
		loud = new Float32Array(2048).fill(0.5);
	expect(levelingGain(quiet)).toBeCloseTo(4);
	expect(levelingGain(loud)).toBeCloseTo(0.2);
	expect(quiet[0] * levelingGain(quiet)).toBeCloseTo(loud[0] * levelingGain(loud));
	expect(levelingGain(new Float32Array(2048))).toBe(1);
	expect(levelingGain(new Float32Array(2048).fill(0.001))).toBe(1);
	const transient = new Float32Array(2048).fill(0.02);
	transient[0] = 1;
	expect(levelingGain(transient)).toBeLessThanOrEqual(0.8);
});
