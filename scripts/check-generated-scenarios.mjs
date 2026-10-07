import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Require actual generated test calls; comments, describe/use and skip are not cases. */
export function checkGeneratedScenarios(root = process.cwd()) {
	const counts = {};
	const errors = [];
	for (const route of ["bdd", "atdd", "bdd/mcp-support"]) {
		const directory = resolve(root, ".features-gen", route);
		let count = 0;
		try {
			for (const relative of readdirSync(directory, { recursive: true })) {
				if (!relative.endsWith(".spec.js")) continue;
				const path = resolve(directory, relative);
				const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
				if (source.parseDiagnostics.length) {
					errors.push(`Invalid generated scenario syntax: ${route}/${relative}`);
					continue;
				}
				function visit(node) {
					if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "test") count++;
					ts.forEachChild(node, visit);
				}
				visit(source);
			}
		} catch {
			errors.push(`Cannot read generated scenario route: ${route}`);
		}
		counts[route] = count;
		if (!count) errors.push(`No executable generated scenarios: ${route}`);
	}
	return { ok: errors.length === 0, counts, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const result = checkGeneratedScenarios(process.argv[2]);
	console.log(JSON.stringify(result, null, 2));
	process.exitCode = result.ok ? 0 : 1;
}
