/* eslint-disable @typescript-eslint/no-require-imports */
const os = require("node:os");
const { readFileSync } = require("node:fs");
const GiB = 1024 ** 3;

function readLimit(path) {
	try {
		const value = Number(readFileSync(path, "utf8").trim());
		return Number.isSafeInteger(value) && value > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

function readTestSystem() {
	let cpuCount = os.availableParallelism();
	let totalMemoryBytes = os.totalmem();
	let availableMemoryBytes = os.freemem();
	if (process.platform === "linux") {
		try {
			const [quota, period] = readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim().split(/\s+/).map(Number);
			if (Number.isFinite(quota) && quota > 0 && Number.isFinite(period) && period > 0) cpuCount = Math.min(cpuCount, Math.max(1, Math.floor(quota / period)));
		} catch {
			// availableParallelism still accounts for the effective CPU affinity.
		}
		const limits = [readLimit("/sys/fs/cgroup/memory.max"), readLimit("/sys/fs/cgroup/memory.high")].filter((value) => value !== undefined);
		const used = readLimit("/sys/fs/cgroup/memory.current");
		if (limits.length) {
			const limit = Math.min(...limits);
			totalMemoryBytes = Math.min(totalMemoryBytes, limit);
			if (used !== undefined) availableMemoryBytes = Math.min(availableMemoryBytes, Math.max(0, limit - used));
			else availableMemoryBytes = Math.min(availableMemoryBytes, limit);
		}
	}
	return { cpuCount, totalMemoryBytes, availableMemoryBytes };
}

function selectTestWorkers(profile, override) {
	const { cpuCount, totalMemoryBytes, availableMemoryBytes } = profile;
	const valid = Number.isSafeInteger(cpuCount) && cpuCount > 0 && Number.isFinite(totalMemoryBytes) && totalMemoryBytes > 0 && Number.isFinite(availableMemoryBytes) && availableMemoryBytes >= 0;
	const reserve = valid ? Math.max(GiB, Math.min(4 * GiB, totalMemoryBytes * 0.15)) : GiB;
	// Allow for the Jest worker and its native application/database probe children.
	const safeBudget = valid ? Math.max(1, Math.min(Math.max(1, cpuCount - 1), Math.floor((availableMemoryBytes - reserve) / (2 * GiB)))) : 1;
	if (override !== undefined && override !== "") {
		if (!/^[1-9]\d*$/.test(override) || Number(override) > 64) throw new Error("MCP_TEST_WORKERS must be an integer from1through64");
		return Math.min(safeBudget, Number(override));
	}
	return Math.min(8, safeBudget);
}

function automaticTestWorkers() {
	return selectTestWorkers(readTestSystem(), process.env.MCP_TEST_WORKERS);
}
module.exports = { readTestSystem, selectTestWorkers, automaticTestWorkers };
