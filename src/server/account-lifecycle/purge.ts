import { randomUUID } from "node:crypto";
import { compareAndSetDeletionRequest, type AccountLifecycleRepository } from "./service";
import { evaluateDeletionBoundary } from "./recovery";

export async function purgeEligibleAccount(
	repository: AccountLifecycleRepository,
	input: {
		requestId: string;
		now: Date;
		deleteResources?: (organizationId: string) => Promise<void>;
		deleteMemberships?: (organizationId: string) => Promise<void>;
		deleteIdentity?: (organizationId: string) => Promise<void>;
		restoreDatabase?: () => Promise<void>;
	},
): Promise<{ purged: boolean }> {
	const claim = await repository.transaction(async (state) => {
		const request = state.deletionRequests.find((candidate) => candidate.id === input.requestId);
		if (!request) throw new Error("DELETION_REQUEST_NOT_FOUND");
		if (request.status === "purged") return null;
		if (request.status !== "suspended" && request.status !== "purge_eligible") throw new Error("PURGE_NOT_ELIGIBLE");
		if (evaluateDeletionBoundary(request, input.now) !== "purge_eligible") throw new Error("PURGE_NOT_ELIGIBLE");
		if (request.status === "suspended" && !compareAndSetDeletionRequest(request, { version: request.version, status: "suspended" }, { status: "purge_eligible" })) throw new Error("DELETION_STATE_CHANGED");
		const account = state.accounts.find((candidate) => candidate.organizationId === request.organizationId);
		if (account) account.status = "purge_eligible";
		return { organizationId: request.organizationId, version: request.version };
	});
	if (!claim) return { purged: false };

	await input.deleteResources?.(claim.organizationId);
	await input.deleteMemberships?.(claim.organizationId);
	await input.deleteIdentity?.(claim.organizationId);

	return repository.transaction(async (state) => {
		const request = state.deletionRequests.find((candidate) => candidate.id === input.requestId);
		if (!request || request.status === "purged") return { purged: false };
		if (!compareAndSetDeletionRequest(request, { version: claim.version, status: "purge_eligible" }, { status: "purged", patch: { purgedAt: input.now } })) return { purged: false };
		state.auditEvents.push({
			id: randomUUID(),
			organizationId: claim.organizationId,
			actorUserId: "system",
			actorSessionId: "purge-worker",
			action: "account.deletion.purge",
			outcome: "success",
			occurredAt: input.now,
		});
		return { purged: true };
	});
}
