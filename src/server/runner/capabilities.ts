import { createHash } from "node:crypto";
import type { QueryClient } from "@/db/client";
import type { RunnerBenefitOwner } from "./benefits";
/** Capability input is resolved for the authorized resource owner, never the operator. */
export type RunnerBenefitInput = { proAccess: boolean; validUntil?: Date | null; knownPaidExpiries?: readonly (Date | null)[]; proSource?: "pro" | "trial" | "grant" | "agency" };
export function deriveRunnerCapabilities(benefits: RunnerBenefitInput, now = new Date()) {
	const knownExpiries = [benefits.validUntil, ...(benefits.knownPaidExpiries ?? [])].filter((value): value is Date => value != null);
	const validUntil = knownExpiries.length ? new Date(Math.min(...knownExpiries.map((value) => value.getTime()))) : null;
	const runnerPro = benefits.proAccess && (validUntil === null || validUntil.getTime() > now.getTime());
	const policy = { basicAccess: true, runnerPro, maxRegisteredDevices: null as number | null, maxActiveBroadcasts: runnerPro ? null : 1, maxTargets: runnerPro ? null : 1, scheduling: runnerPro, customStandby: runnerPro, attributionRequired: !runnerPro, monthlyUsageLimit: null, validUntil: validUntil?.toISOString() ?? null, source: !runnerPro ? "free" : (benefits.proSource ?? "pro") };
	return { ...policy, evaluatedAt: now.toISOString(), capabilityRevision: createHash("sha256").update(JSON.stringify(policy)).digest("hex") };
}

export { verifyExecutionBundle } from "../../../packages/runner/src/protocol";

export async function resolveRunnerBenefits(user: RunnerBenefitOwner, client?: QueryClient, now = new Date()) {
	return (await import("./benefits")).resolveRunnerBenefits(user, client, now);
}
export async function resolveRunnerBenefitsForUsers(users: RunnerBenefitOwner[], client?: QueryClient, now = new Date()) {
	return (await import("./benefits")).resolveRunnerBenefitsForUsers(users, client, now);
}
