type Entity = { id: string };
type Resource = Entity & { ownerId: string; secret?: string; url?: string };
export type CutoverSnapshot = { creators: Entity[]; resources: Resource[]; subscriptions: Array<Entity & { creatorId: string }>; entitlements: Array<Entity & { creatorId: string }>; twitchSubjects: string[] };

function assertUnique(values: string[], code: string) {
	if (new Set(values).size !== values.length) throw new Error(code);
}

export function compareCutoverInvariants(source: CutoverSnapshot, target: CutoverSnapshot) {
	assertUnique(
		target.creators.map((item) => item.id),
		"DUPLICATE_CREATOR_ID",
	);
	assertUnique(
		target.resources.map((item) => item.id),
		"DUPLICATE_RESOURCE_ID",
	);
	assertUnique(target.twitchSubjects, "DUPLICATE_TWITCH_SUBJECT");
	const counts = { creators: source.creators.length, resources: source.resources.length, subscriptions: source.subscriptions.length, entitlements: source.entitlements.length };
	if (target.creators.length !== counts.creators || target.resources.length !== counts.resources || target.subscriptions.length !== counts.subscriptions || target.entitlements.length !== counts.entitlements) throw new Error("ENTITY_COUNT_MISMATCH");
	for (const collection of ["creators", "subscriptions", "entitlements"] as const) {
		const sourceIds = source[collection].map((item) => item.id).sort();
		const targetIds = target[collection].map((item) => item.id).sort();
		if (JSON.stringify(sourceIds) !== JSON.stringify(targetIds)) throw new Error("ENTITY_ID_PARITY_FAILED");
	}
	const sourceRuntime = source.resources.map(({ id, ownerId, secret, url }) => ({ id, ownerId, secret, url })).sort((left, right) => left.id.localeCompare(right.id));
	const targetRuntime = target.resources.map(({ id, ownerId, secret, url }) => ({ id, ownerId, secret, url })).sort((left, right) => left.id.localeCompare(right.id));
	if (JSON.stringify(sourceRuntime) !== JSON.stringify(targetRuntime)) throw new Error("RUNTIME_BYTE_PARITY_FAILED");
	return { valid: true as const, counts };
}
