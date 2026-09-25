export type LegalChange = "broadened-purpose" | "new-data-category" | "new-recipient" | "legal-basis-change" | "new-transfer" | "optional-to-necessary" | "category-move" | "longer-retention" | "sale-or-sharing" | "behavioral-advertising" | "profiling" | "typographical" | "display-only" | "restrictive-pattern";

const editorialChanges = new Set<LegalChange>(["typographical", "display-only", "restrictive-pattern"]);

export function classifyLegalChange(change: LegalChange) {
	if (editorialChanges.has(change)) return { classification: "editorial" as const, requiresVersionChange: false, requiresConsentOrNoticeDecision: false };
	return { classification: "material" as const, requiresVersionChange: true, requiresConsentOrNoticeDecision: true };
}
