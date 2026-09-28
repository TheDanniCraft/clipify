import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export type LegacyFindingKind = "legacy-dashboard-jwt" | "legacy-editor-auth" | "custom-refresh" | "destructive-downgrade";
export type LegacyFinding = { path: string; kind: LegacyFindingKind };
const patterns: Array<[LegacyFindingKind, RegExp]> = [
	["legacy-dashboard-jwt", /jwt\.verify\([^\n]*(?:issuer\s*:\s*["']clipify["']|dashboard)/i],
	["legacy-editor-auth", /(?:from\(editorsTable\)|editorsTable\.(?:editorId|userId))/],
	["custom-refresh", /refreshAccessTokenWithContextInternal\s*\(/],
	["destructive-downgrade", /reconcileFreeConstraintsIfNeeded\s*\(/],
];

export function scanLegacyConsumers(files: Array<{ path: string; content: string }>): LegacyFinding[] {
	return files.flatMap((file) => patterns.filter(([, pattern]) => pattern.test(file.content)).map(([kind]) => ({ path: file.path, kind })));
}

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
