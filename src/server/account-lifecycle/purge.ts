import { randomUUID } from "node:crypto";
import type { AccountLifecycleRepository } from "./service";
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
	const organizationId = await repository.transaction(async (state) => {
		const request = state.deletionRequests.find((candidate) => candidate.id === input.requestId);
		if (!request) throw new Error("DELETION_REQUEST_NOT_FOUND");
		if (request.status === "purged") return null;
		if (request.status !== "suspended" && request.status !== "purge_eligible") throw new Error("PURGE_NOT_ELIGIBLE");
		if (evaluateDeletionBoundary(request, input.now) !== "purge_eligible") throw new Error("PURGE_NOT_ELIGIBLE");
		request.status = "purge_eligible";
		request.version += 1;
		const account = state.accounts.find((candidate) => candidate.organizationId === request.organizationId);
		if (account) account.status = "purge_eligible";
		return request.organizationId;
	});
	if (!organizationId) return { purged: false };

	await input.deleteResources?.(organizationId);
	await input.deleteMemberships?.(organizationId);
	await input.deleteIdentity?.(organizationId);

	return repository.transaction(async (state) => {
		const request = state.deletionRequests.find((candidate) => candidate.id === input.requestId);
		if (!request || request.status === "purged") return { purged: false };
		request.status = "purged";
		request.purgedAt = input.now;
		request.version += 1;
		state.auditEvents.push({
			id: randomUUID(),
			organizationId,
			actorUserId: "system",
			actorSessionId: "purge-worker",
			action: "account.deletion.purge",
			outcome: "success",
			occurredAt: input.now,
		});
		return { purged: true };
	});
}
