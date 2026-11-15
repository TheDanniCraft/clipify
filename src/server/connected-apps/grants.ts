export class ConnectedAppError extends Error {
	constructor(
		readonly code: string,
		readonly status = 403,
	) {
		super(code);
	}
}
export type ConnectionGrant = { id: string; clientId: string; creatorId: string; operations: string[]; expiresAt: Date; revokedAt: Date | null; clientDisabled: boolean | null; creatorDisabled: boolean | null; creatorStatus: string };
export function assertConnectedAppGrant(grant: ConnectionGrant | undefined, request: { clientId: string; creatorId: string; operation: string }, now = new Date()): asserts grant is ConnectionGrant {
	if (!grant || grant.creatorId !== request.creatorId || grant.clientId !== request.clientId || !grant.operations.includes(request.operation) || request.operation !== "search_clips" || grant.revokedAt || grant.expiresAt <= now || grant.clientDisabled || grant.creatorDisabled || grant.creatorStatus !== "active") throw new ConnectedAppError("ACCESS_DENIED");
}
