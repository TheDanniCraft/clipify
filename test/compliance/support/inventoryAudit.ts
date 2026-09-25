export type InventoryKind = "cookie" | "localStorage" | "sessionStorage" | "script" | "origin";
export type InventoryObservation = { flowId: string; kind: InventoryKind; name?: string; origin?: string; value?: string };
export type InventoryDeclaration = {
	serviceId: string;
	storageNames: readonly string[];
	storagePatterns: readonly string[];
	storageDeclarations?: readonly { kind: InventoryKind; name?: string; pattern?: string }[];
	origins: readonly string[];
	scriptOrigins?: readonly string[];
	forbiddenOrigins?: readonly string[];
};
export type InventoryFinding = { flowId: string; kind: string; observed: string; reason: "unknown" | "forbidden" | "ambiguous" };
export type InventoryEvidence = { flowId: string; kind: string; name?: string; origin?: string; serviceId: string; classification: "matched" };
export type ExpectedObservationMatrix = Readonly<Record<string, readonly InventoryKind[]>>;

export function auditInventory(observations: readonly InventoryObservation[], declarations: readonly InventoryDeclaration[]) {
	const matches: { serviceId: string }[] = [];
	const differences: InventoryFinding[] = [];
	const evidence: InventoryEvidence[] = [];

	for (const observation of observations) {
		const observed = observation.name ?? observation.origin ?? observation.kind;
		if (observation.origin && declarations.some((declaration) => declaration.forbiddenOrigins?.includes(observation.origin!))) {
			differences.push({ flowId: observation.flowId, kind: observation.kind, observed, reason: "forbidden" });
			continue;
		}
		const owners = declarations.filter((declaration) => {
			if (observation.name) {
				if (declaration.storageDeclarations) return declaration.storageDeclarations.some((entry) => entry.kind === observation.kind && matchesStorageDeclaration({ type: entry.kind, name: entry.name, pattern: entry.pattern }, observation.name!));
				return declaration.storageNames.includes(observation.name) || declaration.storagePatterns.some((pattern) => matchesStorageDeclaration({ type: observation.kind, pattern }, observation.name!));
			}
			if (!observation.origin) return false;
			return observation.kind === "script" ? declaration.scriptOrigins?.includes(observation.origin) : declaration.origins.includes(observation.origin);
		});
		if (owners.length === 1) {
			matches.push({ serviceId: owners[0].serviceId });
			evidence.push({ flowId: observation.flowId, kind: observation.kind, ...(observation.name ? { name: observation.name } : { origin: observation.origin }), serviceId: owners[0].serviceId, classification: "matched" });
		} else differences.push({ flowId: observation.flowId, kind: observation.kind, observed, reason: owners.length === 0 ? "unknown" : "ambiguous" });
	}

	return { result: differences.length === 0 ? ("pass" as const) : ("fail" as const), matches, differences, evidence };
}

export function runComplianceGate(observations: readonly InventoryObservation[], declarations: readonly InventoryDeclaration[], expectedMatrix: ExpectedObservationMatrix) {
	const audit = auditInventory(observations, declarations);
	const missingObservations = Object.entries(expectedMatrix).flatMap(([flowId, kinds]) => kinds.filter((kind) => !observations.some((observation) => observation.flowId === flowId && observation.kind === kind)).map((kind) => ({ flowId, kind })));

	return {
		...audit,
		result: audit.result === "pass" && missingObservations.length === 0 ? ("pass" as const) : ("fail" as const),
		missingObservations,
	};
}
import { matchesStorageDeclaration } from "@lib/consent/registry";
