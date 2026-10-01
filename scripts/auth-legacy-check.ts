import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { scanLegacyConsumers } from "./auth-cutover/legacy-scan";

export { scanLegacyConsumers } from "./auth-cutover/legacy-scan";
export type { LegacyFinding, LegacyFindingKind } from "./auth-cutover/legacy-scan";

function sourceFiles(root: string): Array<{ path: string; content: string }> {
	const files: Array<{ path: string; content: string }> = [];
	for (const name of readdirSync(root)) {
		const path = resolve(root, name);
		const stat = statSync(path);
		if (stat.isDirectory()) files.push(...sourceFiles(path));
		else if (/\.(?:ts|tsx|js|jsx)$/.test(name)) files.push({ path, content: readFileSync(path, "utf8") });
	}
	return files;
}

export function checkRepositoryForLegacyConsumers(root = resolve(process.cwd(), "src")) {
	return scanLegacyConsumers(sourceFiles(root));
}

if (import.meta.main) {
	const findings = checkRepositoryForLegacyConsumers();
	for (const finding of findings) process.stdout.write(`${finding.kind}\t${finding.path}\n`);
	process.exitCode = findings.length === 0 ? 0 : 1;
}
