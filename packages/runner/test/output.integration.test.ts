import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let result: { recovered: boolean; healthyContinued: boolean; decoded: { video: boolean; audio: boolean }[]; sameEncodedContent: boolean; healthyStarts: number[]; encoderStarts: number; allProcessesClosed: boolean; socketsReleased: boolean };
beforeAll(() => {
	const output = execFileSync(process.execPath, [join(__dirname, "support/output-recovery-probe.mjs"), "--three", "--recover", "--decode"], { encoding: "utf8", timeout: 40000 });
	result = JSON.parse(output.trim().split("\n").at(-1)!);
}, 45000);

test("ATDD-US2-SC002: all three destinations receive shared content through independent recovery", () => {
	expect(readFileSync(join(__dirname, "atdd/runner-free-pro.feature"), "utf8")).toContain("@ATDD-US2-SC002");
	expect(result.recovered).toBe(true);
	expect(result.healthyContinued).toBe(true);
	expect(result.decoded).toEqual(Array.from({ length: 3 }, () => ({ video: true, audio: true })));
	expect(result.sameEncodedContent).toBe(true);
	expect(result.healthyStarts).toEqual([1, 1]);
	expect(result.encoderStarts).toBe(1);
});

test("TDD-US2-CON007 U252 U253: recovered packets decode and terminal cleanup releases every native resource", () => {
	expect(result.decoded).toHaveLength(3);
	expect(result.decoded.every((media) => media.video && media.audio)).toBe(true);
	expect(result.sameEncodedContent).toBe(true);
	expect(result.allProcessesClosed).toBe(true);
	expect(result.socketsReleased).toBe(true);
});
