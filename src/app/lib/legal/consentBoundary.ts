export type LegalSource = { path: string; content: string };
export type ConsentBoundaryViolation = { path: string; capability: string };

const forbiddenCapabilities = [
	{ capability: "consent persistence", pattern: /(?:localStorage|sessionStorage)\.setItem\s*\(|saveCustomPreferences\s*\(/ },
	{ capability: "consent action", pattern: /perform(?:Banner|Dialog)Action\s*\(/ },
	{ capability: "consent cleanup", pattern: /cleanupConsent|clearExpiredStoredConsent/ },
	{ capability: "consent reload", pattern: /reloadAfterConsentSave/ },
	{ capability: "consent backend", pattern: /@lib\/consent\/(?:backend|policy)/ },
] as const;

export function findLegalConsentBoundaryViolations(sources: readonly LegalSource[]): ConsentBoundaryViolation[] {
	return sources.flatMap((source) => forbiddenCapabilities.filter(({ pattern }) => pattern.test(source.content)).map(({ capability }) => ({ path: source.path, capability })));
}
