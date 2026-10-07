/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

function evaluate(root: string) {
	const code = "let gate;try{gate=(await import('./scripts/check-generated-scenarios.mjs')).checkGeneratedScenarios}catch{}process.stdout.write(JSON.stringify(gate ? gate(process.argv[1]) : {missing:true}));";
	return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", code, root], { encoding: "utf8" }));
}
let root: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "clipify-generated-gate-"));
	for (const directory of ["bdd/mcp-support", "atdd"]) {
		const file = join(root, ".features-gen", directory, "fixture.feature.spec.js");
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, 'test("Executable scenario", {}, async () => {});');
	}
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
test("accepts nonempty generated BDD, ATDD and MCP scenario routes", () => {
	expect(evaluate(root)).toMatchObject({ ok: true, errors: [] });
});
test.each(["bdd", "atdd", "bdd/mcp-support"])("rejects a missing mandatory generated route: %s", (directory) => {
	rmSync(join(root, ".features-gen", directory), { recursive: true, force: true });
	expect(evaluate(root)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining(directory)]) });
});
test("describe/use/skip declarations cannot masquerade as executable scenarios", () => {
	writeFileSync(join(root, ".features-gen/atdd/fixture.feature.spec.js"), 'test.describe("Empty", () => {}); test.use({}); test.skip("Skipped", () => {});');
	expect(evaluate(root)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining("atdd")]) });
});
