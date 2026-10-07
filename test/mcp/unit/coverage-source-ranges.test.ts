/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCoverageMap } from "istanbul-lib-coverage";
const original = JSON.parse(readFileSync(resolve("test/support/mcp/inverted-quota-coverage.json"), "utf8"));
const helper = resolve("scripts/mcp-coverage-ranges.cjs");
const repair = existsSync(helper) ? require(helper).repairMappedCoverage : (value: unknown) => value;
describe("TDD-COVERAGE-RANGES-001 real inverted TypeScript source mapping", () => {
	test("mapped statements never claim a backwards source interval", () => {
		const result = repair({ [original.path]: original });
		for (const point of Object.values(result[original.path].statementMap) as Array<{ start: { line: number }; end: { line: number } }>) {
			expect(point.end.line).toBeGreaterThanOrEqual(point.start.line);
		}
	});
	test("preserves every real executed and cold counter without changing input evidence", () => {
		const before = JSON.stringify(original);
		const result = repair({ [original.path]: original })[original.path];
		expect(result.s).toEqual(original.s);
		expect(result.f).toEqual(original.f);
		expect(result.b).toEqual(original.b);
		expect(JSON.stringify(original)).toBe(before);
		expect(Object.keys(result.statementMap)).toEqual(Object.keys(original.statementMap));
	});
	test("a reversed generated interval cannot turn adjacent source lines into covered statements", () => {
		const result = repair({ [original.path]: original })[original.path];
		expect(result.statementMap["19"].start).toEqual(original.statementMap["19"].start);
		expect(result.statementMap["19"].end.line).toBe(original.statementMap["19"].start.line);
	});
});

test("coverage range repair accepts real Istanbul FileCoverage maps without losing counters", () => {
	const map = createCoverageMap({ [original.path]: original });
	const result = repair(map.toJSON())[original.path];
	expect(result.s).toEqual(original.s);
	expect(result.f).toEqual(original.f);
	expect(result.b).toEqual(original.b);
	expect(result.statementMap["19"].start).toEqual(original.statementMap["19"].start);
	expect(result.statementMap["19"].end.line).toBe(original.statementMap["19"].start.line);
	expect(map.fileCoverageFor(original.path).toJSON()).toEqual(original);
});
