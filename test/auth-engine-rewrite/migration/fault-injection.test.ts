/** @jest-environment node */
import { executeCutoverWorkflow, runCutoverSmoke, type CutoverFailurePoint } from "../../../scripts/auth-cutover/smoke";
import { scanLegacyConsumers } from "../../../scripts/auth-cutover/legacy-scan";

const phases: CutoverFailurePoint[] = ["preflight", "backup", "identity", "membership", "credential", "invariant", "switch", "smoke"];

describe("TDD-US6-003 fail-closed cutover and smoke", () => {
	it.each(phases)("fails closed at %s with redacted diagnostics", async (failurePoint) => {
		const result = await executeCutoverWorkflow({
			runId: "run-fault",
			failAt: failurePoint,
			originatingError: new Error("database password=super-secret token=oauth-secret"),
		});
		expect(result.ok).toBe(false);
		expect(result.maintenance).toBe(!["preflight", "backup"].includes(failurePoint));
		expect(result.reopened).toBe(false);
		expect(result.restoreAttempted).toBe(false);
		expect(result.safeNextAction).toMatch(/fix|resume|verify/i);
		expect(JSON.stringify(result)).not.toContain("super-secret");
		expect(JSON.stringify(result)).not.toContain("oauth-secret");
	});

	it("runs every required smoke class before allowing reopen", async () => {
		const invoked: string[] = [];
		const checks = Object.fromEntries(
			["sign-in", "allow-deny", "overlay", "refresh", "subscription", "entitlement", "outbox"].map((name) => [
				name,
				async () => {
					invoked.push(name);
					return true;
				},
			]),
		) as Parameters<typeof runCutoverSmoke>[0];
		expect(await runCutoverSmoke(checks)).toEqual({ passed: true, checks: expect.any(Object) });
		expect(invoked).toEqual(["sign-in", "allow-deny", "overlay", "refresh", "subscription", "entitlement", "outbox"]);
	});

	it("does not reopen when any smoke class fails", async () => {
		const checks = Object.fromEntries(["sign-in", "allow-deny", "overlay", "refresh", "subscription", "entitlement", "outbox"].map((name) => [name, async () => name !== "refresh"])) as Parameters<typeof runCutoverSmoke>[0];
		await expect(runCutoverSmoke(checks)).rejects.toThrow("SMOKE_FAILED:refresh");
	});

	it("detects each forbidden legacy runtime consumer", () => {
		const findings = scanLegacyConsumers([
			{ path: "dashboard.ts", content: "jwt.verify(cookie, secret, { issuer: 'clipify' })" },
			{ path: "edit.ts", content: "from(editorsTable)" },
			{ path: "tokens.ts", content: "refreshAccessTokenWithContextInternal(refreshToken)" },
			{ path: "plan.ts", content: "reconcileFreeConstraintsIfNeeded(userId)" },
		]);
		expect(findings.map((finding) => finding.kind).sort()).toEqual(["custom-refresh", "destructive-downgrade", "legacy-dashboard-jwt", "legacy-editor-auth"].sort());
	});

	it("returns zero findings for switched runtime boundaries", () => {
		expect(scanLegacyConsumers([{ path: "session.ts", content: "getAuthActorContext(); authorize(request); auth.api.getAccessToken();" }])).toEqual([]);
	});
});
