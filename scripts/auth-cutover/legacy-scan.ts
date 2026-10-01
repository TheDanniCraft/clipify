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
