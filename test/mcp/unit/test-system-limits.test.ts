/** @jest-environment node */
export {};
const fs = require("node:fs");
const os = require("node:os");

function system(limits: Record<string, string>) {
	const originalRead = fs.readFileSync;
	const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
	Object.defineProperty(process, "platform", { value: "linux", configurable: true });
	jest.spyOn(os, "availableParallelism").mockReturnValue(16);
	jest.spyOn(os, "freemem").mockReturnValue(64 * 1024 ** 3);
	jest.spyOn(os, "totalmem").mockReturnValue(128 * 1024 ** 3);
	jest.spyOn(fs, "readFileSync").mockImplementation((path: unknown, ...args: unknown[]) => {
		if (typeof path === "string" && path.startsWith("/sys/fs/cgroup/")) {
			if (!(path in limits)) throw new Error("Unavailable cgroup file");
			return limits[path];
		}
		return originalRead(path, ...args);
	});
	try {
		jest.resetModules();
		return require("../../../scripts/test-worker-budget.cjs").readTestSystem();
	} finally {
		jest.restoreAllMocks();
		Object.defineProperty(process, "platform", descriptor);
		jest.resetModules();
	}
}

test("container hard memory and existing usage bound available capacity", () => {
	expect(system({ "/sys/fs/cgroup/memory.max": String(8 * 1024 ** 3), "/sys/fs/cgroup/memory.current": String(3 * 1024 ** 3) })).toMatchObject({ totalMemoryBytes: 8 * 1024 ** 3, availableMemoryBytes: 5 * 1024 ** 3 });
});

test("a lower soft container memory limit is respected", () => {
	expect(system({ "/sys/fs/cgroup/memory.max": String(16 * 1024 ** 3), "/sys/fs/cgroup/memory.high": String(4 * 1024 ** 3), "/sys/fs/cgroup/memory.current": String(3 * 1024 ** 3) })).toMatchObject({ totalMemoryBytes: 4 * 1024 ** 3, availableMemoryBytes: 1024 ** 3 });
});

test("container CPU quota reduces usable parallelism", () => {
	expect(system({ "/sys/fs/cgroup/cpu.max": "200000 100000" }).cpuCount).toBe(2);
});

test("fractional CPU quota still allows one worker", () => {
	expect(system({ "/sys/fs/cgroup/cpu.max": "50000 100000" }).cpuCount).toBe(1);
});

test("unlimited or unavailable cgroup limits preserve host measurements", () => {
	expect(system({ "/sys/fs/cgroup/memory.max": "max", "/sys/fs/cgroup/memory.high": "max", "/sys/fs/cgroup/cpu.max": "max 100000" })).toEqual({ cpuCount: 16, totalMemoryBytes: 128 * 1024 ** 3, availableMemoryBytes: 64 * 1024 ** 3 });
});

test("overused container memory never produces negative available capacity", () => {
	expect(system({ "/sys/fs/cgroup/memory.max": String(4 * 1024 ** 3), "/sys/fs/cgroup/memory.current": String(6 * 1024 ** 3) }).availableMemoryBytes).toBe(0);
});
