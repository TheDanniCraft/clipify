/** @jest-environment node */
import { spawnSync } from "node:child_process";
import ts from "typescript";

test("command-line type checks use TypeScript 7 while tooling retains the compiler API", () => {
	const result = spawnSync("bun", ["run", "app:typecheck", "--version"], { cwd: process.cwd(), encoding: "utf8", timeout: 10000 });
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(0);
	expect(result.stdout).toMatch(/Version 7\./);
	const source = ts.createSourceFile("fixture.ts", "const value: number = 1;", ts.ScriptTarget.Latest, true);
	expect(source.statements).toHaveLength(1);
});
