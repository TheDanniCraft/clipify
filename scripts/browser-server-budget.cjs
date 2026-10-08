/* eslint-disable @typescript-eslint/no-require-imports */
const { readTestSystem } = require("./test-worker-budget.cjs");
const MiB = 1024 ** 2;

function selectBrowserServerHeapMiB(profile) {
	const { availableMemoryBytes, totalMemoryBytes } = profile;
	if (!Number.isFinite(availableMemoryBytes) || availableMemoryBytes < 0 || !Number.isFinite(totalMemoryBytes) || totalMemoryBytes <= 0) return 512;
	// Leave most currently available memory for Chromium, PostgreSQL, test
	// workers and native allocations outside V8. Respect the detector's cgroup
	// limits and cap the compiler even on machines with abundant free RAM.
	const availableMiB = Math.min(availableMemoryBytes, totalMemoryBytes) / MiB;
	return Math.max(512, Math.min(12288, Math.floor((availableMiB * 0.35) / 256) * 256));
}

function browserServerNodeOptions(explicitOptions, profile = readTestSystem()) {
	if (explicitOptions) return explicitOptions;
	return `--max-old-space-size=${selectBrowserServerHeapMiB(profile)}`;
}

module.exports = { selectBrowserServerHeapMiB, browserServerNodeOptions };
