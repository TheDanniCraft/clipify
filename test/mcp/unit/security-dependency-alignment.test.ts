/** @jest-environment node */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = createRequire(resolve("package.json"));
const consumer = (name: string) => createRequire(root.resolve(name));
const version = (name: string, from = root) => JSON.parse(readFileSync(from.resolve(`${name}/package.json`), "utf8")).version as string;

describe("effective security dependency resolutions", () => {
	test.each(["eslint", "glob", "test-exclude", "@eslint/config-array", "@typescript-eslint/typescript-estree"])("%s uses a patched minimatch rather than a vulnerable nested copy", (name) => {
		const effective = version("minimatch", consumer(name));
		expect(Number(effective.split(".")[0])).toBeGreaterThanOrEqual(11);
		expect(effective).not.toBe("11.0.0");
	});

	test("Axios resolves the patched redirect implementation", () => {
		expect(version("follow-redirects", consumer("axios"))).toBe("1.16.2");
	});

	test("the lint schema consumer shares the patched application Zod", () => {
		expect(version("zod", consumer("eslint-plugin-react-hooks"))).toBe(version("zod"));
	});

	test("legacy plugins retain callable matching while modern tools retain named matching", () => {
		const legacy = consumer("eslint-plugin-import")("minimatch");
		expect(typeof legacy).toBe("function");
		expect(legacy("src/app/example.ts", "src/**/*.ts")).toBe(true);
		const { minimatch } = root("minimatch");
		expect(minimatch("src/app/example.ts", "src/**/*.ts")).toBe(true);
		expect(minimatch("foreign/example.ts", "src/**/*.ts")).toBe(false);
	});
});
