export type CutoverFailurePoint = "preflight" | "backup" | "identity" | "membership" | "credential" | "invariant" | "switch" | "smoke";
export type SmokeName = "sign-in" | "allow-deny" | "overlay" | "refresh" | "subscription" | "entitlement" | "outbox";
export type SmokeChecks = Record<SmokeName, () => Promise<boolean>>;
const smokeOrder: SmokeName[] = ["sign-in", "allow-deny", "overlay", "refresh", "subscription", "entitlement", "outbox"];

function redact(message: string): string {
	return message.replace(/(password|passwd|secret|token|credential|authorization|cookie)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]").replace(/(?:postgres(?:ql)?|mysql):\/\/[^\s]+/gi, "[REDACTED_CONNECTION]");
}

export async function runCutoverSmoke(checks: SmokeChecks) {
	const results: Partial<Record<SmokeName, true>> = {};
	for (const name of smokeOrder) {
		if (!(await checks[name]())) throw new Error(`SMOKE_FAILED:${name}`);
		results[name] = true;
	}
	return { passed: true as const, checks: results as Record<SmokeName, true> };
}

export async function executeCutoverWorkflow(input: { runId: string; failAt?: CutoverFailurePoint; originatingError?: Error; maintenanceInitially?: boolean }) {
	let maintenance = input.maintenanceInitially ?? false;
	for (const phase of ["preflight", "backup", "identity", "membership", "credential", "invariant", "switch", "smoke"] as const) {
		if (phase === "identity") maintenance = true;
		if (input.failAt === phase) {
			const raw = input.originatingError?.message ?? `Failure at ${phase}`;
			return { ok: false as const, runId: input.runId, failedAt: phase, maintenance, reopened: false, restoreAttempted: false, error: redact(raw), safeNextAction: phase === "preflight" || phase === "backup" ? "Fix the reported condition and verify preflight again" : `Fix the reported condition and resume from ${phase}` };
		}
	}
	return { ok: true as const, runId: input.runId, maintenance: false, reopened: true, restoreAttempted: false };
}
