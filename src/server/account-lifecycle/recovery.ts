import { AccountLifecycleService, compareAndSetDeletionRequest, type AccountDeletionRequest, type AccountLifecycleRepository, type LifecycleActor } from "./service";

export type DeletionBoundary = "recoverable" | "purge_eligible";

export function evaluateDeletionBoundary(request: Pick<AccountDeletionRequest, "status" | "purgeEligibleAt">, now: Date): DeletionBoundary {
	if (request.status === "purge_eligible" || request.status === "purged") return "purge_eligible";
	if (!request.purgeEligibleAt) return "recoverable";
	return now.getTime() >= request.purgeEligibleAt.getTime() ? "purge_eligible" : "recoverable";
}

export async function recoverDeletion(
	repository: AccountLifecycleRepository,
	actor: LifecycleActor,
	input: {
		requestId: string;
		now: Date;
		recoveryEntryOnly?: boolean;
		resumeRuntime?: (organizationId: string) => Promise<void>;
		restartBilling?: (organizationId: string) => Promise<void>;
		reclaimAgencyAllocation?: (organizationId: string) => Promise<void>;
	},
) {
	if (input.recoveryEntryOnly) throw new Error("AUTHENTICATION_REQUIRED");
	const policy = new AccountLifecycleService(repository, { now: () => input.now });
	policy.assertOwnerAndRecent(actor);
	const recovered = await repository.transaction(async (state) => {
		const request = state.deletionRequests.find((candidate) => candidate.id === input.requestId && candidate.organizationId === actor.organizationId);
		if (!request) throw new Error("DELETION_REQUEST_NOT_FOUND");
		if (request.status === "recovered") return request;
		if (request.status !== "suspended" || evaluateDeletionBoundary(request, input.now) !== "recoverable") throw new Error("RECOVERY_PERIOD_ENDED");
		const account = state.accounts.find((candidate) => candidate.organizationId === actor.organizationId);
		if (!account) throw new Error("ACCOUNT_NOT_FOUND");
		const transitioned = compareAndSetDeletionRequest(request, { version: request.version, status: "suspended" }, { status: "recovered", patch: { recoveredBy: actor.authUserId, recoveredAt: input.now } });
		if (!transitioned) throw new Error("DELETION_STATE_CHANGED");
		account.status = "active";
		account.suspensionAt = undefined;
		account.purgeEligibleAt = undefined;
		state.auditEvents.push(policy.audit(actor, input.now, "account.deletion.recover", "success"));
		return request;
	});
	await input.resumeRuntime?.(actor.organizationId);
	return recovered;
}
