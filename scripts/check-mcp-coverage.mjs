import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import coverageLibrary from "istanbul-lib-coverage";

const { createCoverageMap, createFileCoverage } = coverageLibrary;
const normalize = (path) => relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const location = (value) => object(value) && object(value.start) && object(value.end) && Number.isSafeInteger(value.start.line) && value.start.line > 0 && Number.isSafeInteger(value.end.line) && value.end.line >= value.start.line;

const branchLocation = (value) => location(value) || (object(value) && object(value.start) && object(value.end) && Object.keys(value.start).length === 0 && Object.keys(value.end).length === 0);

export function readMcpSourceManifest() {
	const directories = ["src/server/mcp", "src/server/resources", "src/app/auth/mcp", "src/app/mcp", "src/app/.well-known"];
	const files = [
		"src/instrumentation.ts",
		"src/db/client.ts",
		"src/db/request-scope.ts",
		"src/server/provider-credentials.ts",
		"src/server/rate-limit.ts",
		"src/auth/providers/twitch-refresh.ts",
		"src/server/account-lifecycle/account-data-export.ts",
		"src/auth/mcp-options.ts",
		"src/auth/mcp-principal.ts",
		"src/auth/session-principal.ts",
		"src/auth/authorize-operation.ts",
		"src/auth/config.ts",
		"src/app/api/auth/[...all]/route.ts",
		"src/server/entitlements/resource-access.ts",
		"src/app/lib/entitlements.ts",
		"src/app/actions/mcp-connections.ts",
		"src/app/dashboard/settings/connected-apps-panel.tsx",
		"src/app/dashboard/settings/mcp-activity-panel.tsx",
		"src/app/components/OverlayTable/index.tsx",
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
			path === "src/server/account-lifecycle/account-data-export.ts" ||
			path === "src/db/client.ts" ||
			path === "src/db/request-scope.ts" ||
			path === "src/server/provider-credentials.ts" ||
			path === "src/server/rate-limit.ts" ||
			path.startsWith("src/auth/") ||
			path.startsWith("src/app/api/auth/") ||
			path.startsWith("src/server/mcp/") ||
			path.startsWith("src/server/resources/") ||
			path.includes("entitlements") ||
			path === "src/app/actions/mcp-connections.ts" ||
			["src/app/actions/database.ts", "src/app/actions/controller.ts", "src/app/actions/commands.ts", "src/app/actions/websocket.ts", "src/app/ws/route.ts"].includes(path),
	);
	return { feature, critical };
}

function validCoverage(value) {
	if (!object(value) || !["statementMap", "fnMap", "branchMap", "s", "f", "b"].every((key) => object(value[key]))) return false;
	for (const [map, counters] of [
		["statementMap", "s"],
		["fnMap", "f"],
		["branchMap", "b"],
	]) {
		const keys = Object.keys(value[map]);
		if (keys.length !== Object.keys(value[counters]).length || keys.some((key) => !Object.hasOwn(value[counters], key))) return false;
		for (const key of keys) {
			if (map === "branchMap") {
				if (!object(value[map][key]) || !Array.isArray(value[map][key].locations) || !Array.isArray(value[counters][key]) || value[map][key].locations.length !== value[counters][key].length || !value[counters][key].every(count) || !location(value[map][key].loc) || !value[map][key].locations.every(branchLocation)) return false;
			} else if (!count(value[counters][key]) || !location(map === "fnMap" ? value[map][key]?.loc : value[map][key])) return false;
		}
	}
	return true;
}

/** Required files and raw executable counters determine coverage; reported percentages are ignored. */
export function evaluateMcpCoverage(report, manifest = readMcpSourceManifest()) {
	const errors = [];
	if (!object(report)) return { ok: false, errors: ["Coverage JSON must contain an Istanbul file map"] };
	if (!object(manifest) || !Array.isArray(manifest.feature) || !manifest.feature.length || !Array.isArray(manifest.critical) || !manifest.critical.length || ![...manifest.feature, ...manifest.critical].every((path) => typeof path === "string") || manifest.critical.some((path) => !manifest.feature.includes(path))) return { ok: false, errors: ["Required feature and critical source manifests must be nonempty and consistent"] };
	const source = new Map(Object.entries(report).map(([path, value]) => [normalize(path), value]));
	const files = {};
	const collected = createCoverageMap({});
	const critical = new Set(manifest.critical.map(normalize));
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
			const thresholds = { statements: 90, functions: 90, lines: critical.has(path) ? 95 : 90, branches: critical.has(path) ? 90 : 85 };
			for (const [metric, threshold] of Object.entries(thresholds)) {
				const percentage = summary[metric].total === 0 ? 100 : summary[metric].pct;
				if (typeof percentage !== "number" || !Number.isFinite(percentage) || percentage < threshold) errors.push(`${path}: ${metric} ${percentage}% is below ${threshold}%`);
			}
		} catch {
			errors.push(`Invalid executable source coverage: ${path}`);
		}
	}
	return { ok: errors.length === 0, errors, files, summary: collected.getCoverageSummary().toJSON() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const result = evaluateMcpCoverage(JSON.parse(readFileSync(process.argv[2] ?? "coverage/coverage-final.json", "utf8")));
		console.log(JSON.stringify(result, null, 2));
		process.exitCode = result.ok ? 0 : 1;
	} catch {
		console.error("MCP coverage gate could not load valid required source coverage");
		process.exitCode = 1;
	}
}
