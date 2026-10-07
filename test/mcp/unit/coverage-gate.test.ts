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
		expect(result.feature).toEqual(expect.arrayContaining(["src/app/pricing/page.tsx", "src/app/components/Pricing/pricing-faq.tsx", "src/app/components/Pricing/pricing-catalog.ts", "src/app/dashboard/member-card/page.tsx"]));
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
