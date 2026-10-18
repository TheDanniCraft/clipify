import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { readMcpSourceManifest } from "./check-mcp-coverage.mjs";

test("retained player and new Runner counter floors preserve the approved baseline", () => {
	const { legacy } = JSON.parse(readFileSync("scripts/runner-feature-coverage.json", "utf8"));
	assert.deepEqual(legacy.thresholdFloors, { statements: 89.02, functions: 88.2, lines: 93.93, branches: 77.55 });
	assert.deepEqual(legacy.runnerCounterFloors, { statements: 90, functions: 90, lines: 90, branches: 85 });
});

test("default CI source audit includes new Runner delivery, normalization and standby editor paths", () => {
	const manifest = readMcpSourceManifest();
	const critical = ["src/server/runner/admission.ts", "src/server/runner/benefits.ts", "src/server/runner/branding-assets.ts", "src/app/api/runner/branding-assets/route.ts", "src/app/runner/presentation/[sessionId]/policy/route.ts", "src/app/runner/preview/[runnerId]/assets/[assetId]/route.ts", "src/app/runner/presentation/[sessionId]/assets/[assetId]/route.ts", "src/app/lib/runnerStandby.ts"];
	for (const path of critical) {
		assert.ok(manifest.feature.includes(path), `Missing Runner source: ${path}`);
		assert.ok(manifest.strictCritical?.includes(path), `Missing strict Runner coverage: ${path}`);
	}
	for (const path of ["src/app/components/runner/StandbyEditor.tsx", "src/app/components/playerOverlay.tsx"]) assert.ok(manifest.feature.includes(path), `Missing ordinary Runner source: ${path}`);
});

test("normal Jest collection includes the Runner decoration source", async () => {
	const require = createRequire(import.meta.url);
	const load = require("../jest.config.cjs");
	const config = await load();
	const micromatch = require("micromatch");
	assert.deepEqual(micromatch(["src/app/components/playerOverlay.tsx"], config.collectCoverageFrom), ["src/app/components/playerOverlay.tsx"]);
});
