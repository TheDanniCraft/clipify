/** @jest-environment node */
import { existsSync } from "node:fs";
import { join } from "node:path";

test("TDD-US1-CON004 execution elapsed time includes system suspend even when process monotonic time pauses", () => {
	const create = existsSync(join(process.cwd(), "packages/runner/src/execution-clock.ts")) ? require("../../../packages/runner/src/execution-clock").createExecutionClock : undefined;
	expect(typeof create).toBe("function");
	let monotonic = 100,
		uptime = 1000;
	const clock = create({ monotonic: () => monotonic, uptime: () => uptime });
	expect(clock()).toBe(100);
	monotonic += 10;
	uptime += 10;
	expect(clock()).toBe(110);
	uptime += 300000;
	expect(clock()).toBe(300110);
});

test("TDD-US1-CON004 uptime rollback cannot freeze elapsed time after a prior suspend", () => {
	const { createExecutionClock } = require("../../../packages/runner/src/execution-clock");
	let monotonic = 100,
		uptime = 1000;
	const clock = createExecutionClock({ monotonic: () => monotonic, uptime: () => uptime });
	uptime += 300000;
	expect(clock()).toBe(300100);
	uptime -= 60000;
	monotonic += 10;
	expect(clock()).toBe(300110);
	uptime += 20;
	monotonic += 20;
	expect(clock()).toBe(300130);
});

test("TDD-US1-CON004 coarse system uptime cannot double-count ordinary process elapsed time", () => {
	const { createExecutionClock } = require("../../../packages/runner/src/execution-clock");
	let monotonic = 100,
		uptime = 1000;
	const clock = createExecutionClock({ monotonic: () => monotonic, uptime: () => uptime });
	for (const elapsed of [0, 1, 500, 999, 1000, 1001, 1500, 2000]) {
		monotonic = 100 + elapsed;
		uptime = 1000 + Math.floor(elapsed / 1000) * 1000;
		expect(clock()).toBe(100 + elapsed);
	}
});

test.each(["nonfinite", "unavailable"])("TDD-US1-CON004 %s elapsed clock fails closed and cannot later revive a permit", (kind) => {
	const { createExecutionClock } = require("../../../packages/runner/src/execution-clock");
	let broken = false;
	const clock = createExecutionClock({
		monotonic: () => 100,
		uptime: () => {
			if (broken) {
				if (kind === "unavailable") throw new Error("fixture");
				return NaN;
			}
			return 1000;
		},
	});
	expect(clock()).toBe(100);
	broken = true;
	expect(clock()).toBe(Infinity);
	broken = false;
	expect(clock()).toBe(Infinity);
});
