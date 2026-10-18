/** @jest-environment node */
import { execFileSync } from "node:child_process";
const manifest = { feature: ["src/feature.ts", "src/security.ts"], critical: ["src/security.ts"] };
function file(path: string, statements = 100, functions = 100, branches = 100) {
	const statementMap: Record<string, any> = {},
		fnMap: Record<string, any> = {},
		branchMap: Record<string, any> = {},
		s: Record<string, number> = {},
		f: Record<string, number> = {},
		b: Record<string, number[]> = {};
	for (let i = 0; i < 100; i++) {
		const loc = { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 10 } };
		statementMap[String(i)] = loc;
		s[String(i)] = i < statements ? 1 : 0;
		fnMap[String(i)] = { name: `fn${i}`, decl: loc, loc, line: i + 1 };
		f[String(i)] = i < functions ? 1 : 0;
		branchMap[String(i)] = { type: "if", line: i + 1, loc, locations: [loc] };
		b[String(i)] = [i < branches ? 1 : 0];
	}
	return { path, statementMap, fnMap, branchMap, s, f, b };
}
const report = () => ({ "src/feature.ts": file("src/feature.ts", 90, 90, 85), "src/security.ts": file("src/security.ts", 95, 90, 90) });
function evaluate(coverage: unknown, sources: unknown = manifest) {
	const code = "let evaluator; try { evaluator=(await import('./scripts/check-mcp-coverage.mjs')).evaluateMcpCoverage; } catch {} process.stdout.write(JSON.stringify(evaluator ? evaluator(JSON.parse(process.argv[1]),JSON.parse(process.argv[2])) : { missing:true }));";
	return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code, JSON.stringify(coverage), JSON.stringify(sources)], { encoding: "utf8" }));
}
describe("TDD-US4-021 feature coverage gate", () => {
	test.each([
		[94, 95],
		[95, 94],
	])("strict Runner critical statement/function boundary %s/%s fails", (statements, functions) => {
		const input = report();
		input["src/security.ts"] = file("src/security.ts", statements, functions, 90);
		// Several statements can share an already-covered line. Keep line
		// coverage green so it cannot conceal a missing statement floor.
		for (const [id, hits] of Object.entries(input["src/security.ts"].s)) {
			if (hits === 0) input["src/security.ts"].statementMap[id] = { start: { line: 1, column: 100 + Number(id) * 2 }, end: { line: 1, column: 101 + Number(id) * 2 } };
		}
		expect(evaluate(input, { ...manifest, strictCritical: manifest.critical })).toMatchObject({ ok: false });
	});
	test("strict Runner critical coverage accepts exactly95 percent statements/functions", () => {
		const input = report();
		input["src/security.ts"] = file("src/security.ts", 95, 95, 90);
		expect(evaluate(input, { ...manifest, strictCritical: manifest.critical })).toMatchObject({ ok: true });
	});
	test("strict coverage cannot refer to a source outside the critical inventory", () => {
		expect(evaluate(report(), { ...manifest, strictCritical: ["src/feature.ts"] })).toMatchObject({ ok: false });
	});
	test("accepts exact feature and critical boundaries", () => {
		expect(evaluate(report())).toMatchObject({ ok: true });
	});
	test("missing feature source cannot pass", () => {
		const input: any = report();
		delete input["src/feature.ts"];
		const result = evaluate(input);
		expect(result).toMatchObject({ ok: false });
		expect(result.errors.join(" ")).toContain("src/feature.ts");
	});
	test("an uncovered file cannot hide behind other files", () => {
		const input = report();
		input["src/feature.ts"] = file("src/feature.ts", 0, 0, 0);
		expect(evaluate(input)).toMatchObject({ ok: false });
	});
	test.each([
		[89, 90, 85],
		[90, 89, 85],
		[90, 90, 84],
	])("feature boundary %s/%s/%s fails", (statements, functions, branches) => {
		const input = report();
		input["src/feature.ts"] = file("src/feature.ts", statements, functions, branches);
		expect(evaluate(input)).toMatchObject({ ok: false });
	});
	test.each([
		[94, 90, 90],
		[95, 90, 89],
	])("critical boundary %s/%s/%s fails", (statements, functions, branches) => {
		const input = report();
		input["src/security.ts"] = file("src/security.ts", statements, functions, branches);
		expect(evaluate(input)).toMatchObject({ ok: false });
	});
	test.each([null, [], "coverage"])("invalid coverage root %s fails safely", (input) => {
		const result = evaluate(input);
		expect(result).toMatchObject({ ok: false });
		expect(result.errors.length).toBeGreaterThan(0);
	});
	test("malformed counters cannot fabricate coverage", () => {
		const input: any = report();
		input["src/feature.ts"].s["0"] = -1;
		expect(evaluate(input)).toMatchObject({ ok: false });
	});
	test("reported percentages cannot override executable counters", () => {
		const input: any = report();
		input["src/feature.ts"] = { ...file("src/feature.ts", 0, 0, 0), total: { lines: { pct: 100 } } };
		expect(evaluate(input)).toMatchObject({ ok: false });
	});
	test("empty required feature or critical manifests fail", () => {
		expect(evaluate(report(), { feature: [], critical: [] })).toMatchObject({ ok: false });
	});
	test("absolute source keys normalize against the repository", () => {
		const input = Object.fromEntries(Object.entries(report()).map(([key, value]) => [`${process.cwd()}/${key}`, { ...value, path: `${process.cwd()}/${key}` }]));
		expect(evaluate(input)).toMatchObject({ ok: true });
	});
});

describe("required real source collection", () => {
	test("required owner entitlement policy remains instrumentable", () => {
		const code = "const fs=await import('node:fs'); process.stdout.write(fs.readFileSync('src/app/lib/entitlements.ts','utf8'));";
		const source = execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" });
		expect(/istanbul\s+ignore\s+file/.test(source)).toBe(false);
	});

	test("feature manifest includes MCP pricing and framework boundary changes", () => {
		const code = "const {readMcpSourceManifest}=await import('./scripts/check-mcp-coverage.mjs'); process.stdout.write(JSON.stringify(readMcpSourceManifest()));";
		const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
		expect(result.feature).toEqual(expect.arrayContaining(["src/app/pricing/page.tsx", "src/app/components/Pricing/pricing-faq.tsx", "src/app/components/Pricing/pricing-catalog.ts", "src/app/dashboard/member-card/page.tsx", "src/app/components/runnerDestinationSelection.tsx"]));
	});

	test("default manifest treats backend authorization and projection sources as critical", () => {
		const code = "const {readMcpSourceManifest}=await import('./scripts/check-mcp-coverage.mjs'); process.stdout.write(JSON.stringify(readMcpSourceManifest()));";
		const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
		expect(result.critical).toEqual(expect.arrayContaining(["src/server/mcp/pagination.ts", "src/server/mcp/schemas.ts", "src/server/resources/browser-playlists.ts", "src/app/actions/mcp-connections.ts", "src/app/api/auth/[...all]/route.ts", "src/db/client.ts", "src/db/request-scope.ts", "src/server/provider-credentials.ts", "src/auth/providers/twitch-refresh.ts", "src/server/account-lifecycle/account-data-export.ts"]));
	});
	test("actual Jest configuration collects every required feature source and preserves global/gallery thresholds", () => {
		const code =
			"import mm from 'micromatch'; const {readMcpSourceManifest}=await import('./scripts/check-mcp-coverage.mjs'); const cfg=await(await import('./jest.config.cjs')).default(); process.stdout.write(JSON.stringify({missing:[...new Set([...readMcpSourceManifest().feature,'src/app/api/auth/[...all]/route.ts','src/db/client.ts','src/db/request-scope.ts','src/server/provider-credentials.ts','src/auth/providers/twitch-refresh.ts','src/server/account-lifecycle/account-data-export.ts'])].filter(path=>!mm([path],cfg.collectCoverageFrom).length),thresholds:cfg.coverageThreshold}));";
		const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
		expect(result.missing).toEqual([]);
		expect(result.thresholds.global).toEqual({ branches: 50, functions: 65, lines: 60, statements: 60 });
		expect(result.thresholds["src/app/actions/gallery.ts"]).toEqual({ branches: 90, functions: 95, lines: 95, statements: 95 });
	});
});

describe("standard Istanbul compiler mappings", () => {
	test("accepts a covered synthetic no-else branch with its real conditional location", () => {
		const input: any = report();
		input["src/feature.ts"].branchMap["0"].locations.push({ start: {}, end: {} });
		input["src/feature.ts"].b["0"].push(1);
		expect(evaluate(input)).toMatchObject({ ok: true });
	});
	test("rejects an invalid location disguised as a synthetic branch", () => {
		const input: any = report();
		input["src/feature.ts"].branchMap["0"].locations[0] = { start: { line: -1 }, end: { line: -1 } };
		expect(evaluate(input)).toMatchObject({ ok: false });
	});
});

describe("Runner service coverage ownership", () => {
	test("the canonical coverage inventory includes the new capability service as critical", () => {
		const code = "import{createRequire}from'node:module';const require=createRequire(process.cwd()+'/package.json');const {projectConfig}=await require('jest-config').readConfig({},process.cwd());process.stdout.write(JSON.stringify({...((await import('./scripts/check-mcp-coverage.mjs')).readMcpSourceManifest()),collected:projectConfig.collectCoverageFrom}))";
		const sources = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
		expect(sources.feature).toContain("src/server/runner/capabilities.ts");
		expect(sources.critical).toContain("src/server/runner/capabilities.ts");
		expect(sources.feature).toContain("packages/runner/src/protocol.ts");
		expect(sources.critical).toContain("packages/runner/src/protocol.ts");
		expect(sources.feature).toContain("packages/runner/src/execution-clock.ts");
		expect(sources.critical).toContain("packages/runner/src/execution-clock.ts");
		expect(sources.collected).toContain("packages/runner/src/execution-clock.ts");
		expect(sources.feature).toContain("src/app/api/runner/heartbeat/route.ts");
		expect(sources.critical).toContain("src/app/api/runner/heartbeat/route.ts");
	});
});

test("terminal receipt transport has a canonical collector and critical coverage owner", () => {
	const code = `import{createRequire}from'node:module';const require=createRequire(process.cwd()+'/package.json');const {projectConfig}=await require('jest-config').readConfig({},process.cwd());const sources=(await import('./scripts/check-mcp-coverage.mjs')).readMcpSourceManifest();process.stdout.write(JSON.stringify({sources,collected:projectConfig.collectCoverageFrom}));`;
	const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
	const path = "src/app/api/runner/terminal/route.ts";
	expect(result.sources.feature).toContain(path);
	expect(result.sources.critical).toContain(path);
	expect(result.collected).toContain(path);
});

test("private Runner presentation authority and rendering have mandatory collector and critical source ownership", () => {
	const code = `import{createRequire}from'node:module';const require=createRequire(process.cwd()+'/package.json');const {projectConfig}=await require('jest-config').readConfig({},process.cwd());const sources=(await import('./scripts/check-mcp-coverage.mjs')).readMcpSourceManifest();process.stdout.write(JSON.stringify({sources,collected:projectConfig.collectCoverageFrom}));`;
	const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
	for (const path of ["src/app/api/runner/presentation/route.ts", "src/app/runner/presentation/[sessionId]/page.tsx", "src/app/components/runnerGeneratedPresentation.tsx", "src/server/runner/presentation.ts", "src/server/runner/branding.ts"]) {
		expect(result.sources.feature).toContain(path);
		expect(result.sources.critical).toContain(path);
	}
	expect(result.collected).toContain("src/app/api/runner/presentation/route.ts");
	expect(result.collected).toContain("src/app/runner/presentation/**/*.{ts,tsx}");
});

test("the shared Runner downgrade authority cannot disappear from the default coverage inventory", () => {
	const code = `import{createRequire}from'node:module';const require=createRequire(process.cwd()+'/package.json');const {projectConfig}=await require('jest-config').readConfig({},process.cwd());const sources=(await import('./scripts/check-mcp-coverage.mjs')).readMcpSourceManifest();process.stdout.write(JSON.stringify({sources,collected:projectConfig.collectCoverageFrom}));`;
	const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
	const path = "src/server/entitlements.ts";
	expect(result.sources.feature).toContain(path);
	expect(result.sources.critical).toContain(path);
	expect(result.collected).toContain(path);
});

test("Runner appearance placement, owner preview and controls retain mandatory source ownership", () => {
	const code = `import{createRequire}from'node:module';const require=createRequire(process.cwd()+'/package.json');const {projectConfig}=await require('jest-config').readConfig({},process.cwd());const sources=(await import('./scripts/check-mcp-coverage.mjs')).readMcpSourceManifest();process.stdout.write(JSON.stringify({sources,collected:projectConfig.collectCoverageFrom}));`;
	const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8" }));
	for (const path of ["src/app/lib/runnerBrandingLayout.ts", "src/app/runner/preview/[runnerId]/page.tsx", "src/app/components/runner/RunnerBrandingPreview.tsx", "src/server/runner/branding-profiles.ts"]) expect(result.sources.feature).toContain(path);
	for (const path of ["src/app/lib/runnerBrandingLayout.ts", "src/app/runner/preview/[runnerId]/page.tsx", "src/server/runner/branding-profiles.ts"]) expect(result.sources.critical).toContain(path);
	expect(result.collected).toContain("src/app/runner/preview/**/*.{ts,tsx}");
	expect(result.collected).toContain("src/app/lib/**/*.{ts,tsx}");
	expect(result.collected).toContain("src/app/components/**/*.{ts,tsx}");
});
