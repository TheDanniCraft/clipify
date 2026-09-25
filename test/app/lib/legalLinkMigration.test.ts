/** @jest-environment node */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const userFacingExtensions = new Set([".ts", ".tsx", ".txt"]);

function readUserFacingSources(directory: string): { path: string; content: string }[] {
	return readdirSync(directory, { withFileTypes: true })
		.sort((left, right) => left.name.localeCompare(right.name))
		.flatMap((entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return readUserFacingSources(path);
			const extension = entry.name.slice(entry.name.lastIndexOf("."));
			if (!userFacingExtensions.has(extension)) return [];
			return [{ path: relative(process.cwd(), path), content: readFileSync(path, "utf8") }];
		});
}

describe("legal link migration", () => {
	it("uses local legal routes and contains no GoAdopt URL in user-facing sources", () => {
		const sources = readUserFacingSources("src/app");
		const userFacingSources = sources.map(({ content }) => content).join("\n");

		expect(sources.filter(({ content }) => /goadopt\.io/i.test(content)).map(({ path }) => path)).toEqual([]);
		for (const route of ["/legal/privacy", "/legal/cookies", "/legal/terms", "/legal/privacy-requests", "/legal/imprint"]) {
			expect(userFacingSources).toContain(route);
		}
	});
});
