import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import coverageLibrary from "istanbul-lib-coverage";
import { validCoverage } from "./coverage-counters.mjs";
import { evaluateRunnerPlayerCoverage } from "./check-runner-player-coverage.mjs";

const { createCoverageMap, createFileCoverage } = coverageLibrary;
const normalize = (path) => relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export function readMcpSourceManifest() {
	const runner = JSON.parse(readFileSync(new URL("./runner-feature-coverage.json", import.meta.url), "utf8"));
	const directories = ["src/server/mcp", "src/server/resources", "src/server/runner", "src/app/auth/mcp", "src/app/mcp", "src/app/.well-known"];
	const files = [
		...runner.critical,
		...runner.ordinary,
		"packages/runner/src/protocol.ts",
		"packages/runner/src/execution-clock.ts",
		"src/app/api/runner/heartbeat/route.ts",
		"src/app/api/runner/terminal/route.ts",
		"src/app/api/runner/presentation/route.ts",
		"src/app/runner/presentation/[sessionId]/page.tsx",
		"src/app/components/runnerGeneratedPresentation.tsx",
		"src/app/lib/runnerBrandingLayout.ts",
		"src/app/runner/preview/[runnerId]/page.tsx",
		"src/app/components/runner/RunnerBrandingPreview.tsx",
		"src/instrumentation.ts",
		"src/db/client.ts",
		"src/db/request-scope.ts",
		"src/server/provider-credentials.ts",
		"src/server/rate-limit.ts",
		"src/auth/providers/twitch-refresh.ts",
		"src/server/account-lifecycle/account-data-export.ts",
		"src/server/account-lifecycle/account-data-export-credentials.ts",
		"src/server/account-lifecycle/account-data-archive.ts",
		"src/server/account-lifecycle/account-export-layout.ts",
		"src/server/account-lifecycle/account-export-assets.ts",
		"src/server/account-lifecycle/account-export-external.ts",
		"src/server/account-lifecycle/account-export-manifest.ts",
		"src/server/primary-twitch-account.ts",
		"src/auth/recent-auth.ts",
		"src/auth/mcp-options.ts",
		"src/auth/mcp-principal.ts",
		"src/auth/session-principal.ts",
		"src/auth/authorize-operation.ts",
		"src/auth/config.ts",
		"src/app/api/auth/[...all]/route.ts",
		"src/server/entitlements.ts",
		"src/server/entitlements/resource-access.ts",
		"src/app/lib/entitlements.ts",
		"src/app/actions/mcp-connections.ts",
		"src/app/dashboard/settings/connected-apps-panel.tsx",
		"src/app/dashboard/settings/mcp-activity-panel.tsx",
		"src/app/components/OverlayTable/index.tsx",
		"src/app/components/runnerDestinationSelection.tsx",
		"src/app/actions/database.ts",
		"src/app/actions/controller.ts",
		"src/app/actions/commands.ts",
		"src/app/actions/websocket.ts",
		"src/app/ws/route.ts",
		"src/app/dashboard/playlist/[playlistId]/page.tsx",
		"src/app/dashboard/overlay/[overlayId]/page.tsx",
		"src/app/dashboard/overlay/[overlayId]/theme/page.tsx",
		"src/app/dashboard/settings/page.tsx",
		"src/app/pricing/page.tsx",
		"src/app/components/Pricing/pricing-faq.tsx",
		"src/app/components/Pricing/pricing-catalog.ts",
		"src/app/dashboard/member-card/page.tsx",
	];
	for (const directory of directories) {
		for (const path of readdirSync(directory, { recursive: true })) {
			if (/\.(ts|tsx)$/.test(path) && !path.endsWith(".d.ts")) files.push(`${directory}/${path}`.replaceAll("\\", "/"));
		}
	}
	const feature = [...new Set(files)].sort();
	const critical = feature.filter(
		(path) =>
			runner.critical.includes(path) ||
			path.startsWith("src/server/account-lifecycle/account-") ||
			path === "src/server/primary-twitch-account.ts" ||
			path === "src/db/client.ts" ||
			path === "src/db/request-scope.ts" ||
			path === "src/server/provider-credentials.ts" ||
			path === "src/server/rate-limit.ts" ||
			path.startsWith("src/auth/") ||
			path.startsWith("src/app/api/auth/") ||
			path.startsWith("src/app/api/runner/") ||
			path.startsWith("src/app/runner/presentation/") ||
			path.startsWith("src/app/runner/preview/") ||
			path === "src/app/lib/runnerBrandingLayout.ts" ||
			path === "src/app/components/runnerGeneratedPresentation.tsx" ||
			path.startsWith("src/server/mcp/") ||
			path.startsWith("src/server/resources/") ||
			path.startsWith("src/server/runner/") ||
			path === "packages/runner/src/protocol.ts" ||
			path === "packages/runner/src/execution-clock.ts" ||
			path.includes("entitlements") ||
			path === "src/app/actions/mcp-connections.ts" ||
			["src/app/actions/database.ts", "src/app/actions/controller.ts", "src/app/actions/commands.ts", "src/app/actions/websocket.ts", "src/app/ws/route.ts"].includes(path),
	);
	return { feature, critical, strictCritical: runner.critical };
}

function nonemptyStringList(value) {
	return Array.isArray(value) && value.length > 0 && value.every((path) => typeof path === "string");
}
function validSourceManifest(manifest) {
	return object(manifest) && nonemptyStringList(manifest.feature) && nonemptyStringList(manifest.critical) && manifest.critical.every((path) => manifest.feature.includes(path));
}
function validStrictCriticalManifest(manifest) {
	return manifest.strictCritical === undefined || (Array.isArray(manifest.strictCritical) && manifest.strictCritical.every((path) => typeof path === "string" && manifest.critical.includes(path)));
}
function checkSourceThresholds(summary, path, critical, strictCritical, errors) {
	const thresholds = { statements: strictCritical.has(path) ? 95 : 90, functions: strictCritical.has(path) ? 95 : 90, lines: critical.has(path) ? 95 : 90, branches: critical.has(path) ? 90 : 85 };
	for (const [metric, threshold] of Object.entries(thresholds)) {
		const percentage = summary[metric].total === 0 ? 100 : summary[metric].pct;
		if (typeof percentage !== "number" || !Number.isFinite(percentage) || percentage < threshold) errors.push(`${path}: ${metric} ${percentage}% is below ${threshold}%`);
	}
}

/** Required files and raw executable counters determine coverage; reported percentages are ignored. */
export function evaluateMcpCoverage(report, manifest = readMcpSourceManifest()) {
	const errors = [];
	if (!object(report)) return { ok: false, errors: ["Coverage JSON must contain an Istanbul file map"] };
	if (!validSourceManifest(manifest)) return { ok: false, errors: ["Required feature and critical source manifests must be nonempty and consistent"] };
	if (!validStrictCriticalManifest(manifest)) return { ok: false, errors: ["Strict critical sources must belong to the critical inventory"] };
	const source = new Map(Object.entries(report).map(([path, value]) => [normalize(path), value]));
	const files = {};
	const collected = createCoverageMap({});
	const critical = new Set(manifest.critical.map(normalize));
	const strictCritical = new Set((manifest.strictCritical ?? []).map(normalize));
	for (const originalPath of manifest.feature) {
		const path = normalize(originalPath);
		const value = source.get(path);
		if (!value) {
			errors.push(`Missing required source coverage: ${path}`);
			continue;
		}
		if (!validCoverage(value) || normalize(value.path ?? path) !== path) {
			errors.push(`Invalid source coverage counters or mappings: ${path}`);
			continue;
		}
		try {
			const coverage = createFileCoverage({ ...value, path });
			collected.addFileCoverage(coverage);
			const summary = coverage.toSummary().toJSON();
			files[path] = summary;
			checkSourceThresholds(summary, path, critical, strictCritical, errors);
		} catch {
			errors.push(`Invalid executable source coverage: ${path}`);
		}
	}
	return { ok: errors.length === 0, errors, files, summary: collected.getCoverageSummary().toJSON() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const result = evaluateMcpCoverage(JSON.parse(readFileSync(process.argv[2] ?? "coverage/coverage-final.json", "utf8")));
		const player = evaluateRunnerPlayerCoverage(JSON.parse(readFileSync(process.argv[2] ?? "coverage/coverage-final.json", "utf8")));
		result.ok = result.ok && player.ok;
		result.errors.push(...player.errors);
		result.runnerPlayer = player;
		console.log(JSON.stringify(result, null, 2));
		process.exitCode = result.ok ? 0 : 1;
	} catch {
		console.error("MCP coverage gate could not load valid required source coverage");
		process.exitCode = 1;
	}
}
