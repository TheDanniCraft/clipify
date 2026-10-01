export interface LegacySnapshot {
	creators: Array<{ id: string; twitchSubject: string; email: string }>;
	editors: Array<{ creatorId: string; editorTwitchSubject: string }>;
	resources: Array<{ id: string; creatorId: string; type: "overlay" | "playlist" | "gallery" | "runner"; secret?: string }>;
	tokens: Array<{ creatorId: string; encryptedAccessToken: string; encryptedRefreshToken: string }>;
	subscriptions: Array<{ creatorId: string; subscriptionId: string; status: "active" | "canceled" }>;
	entitlements: Array<{ creatorId: string; source: "creator" | "agency"; key: string }>;
}

export function generateLegacySnapshot(creatorCount: number): LegacySnapshot {
	if (!Number.isInteger(creatorCount) || creatorCount < 0) throw new Error("creatorCount must be a non-negative integer");
	const creators = Array.from({ length: creatorCount }, (_, index) => {
		const sequence = String(index + 1).padStart(6, "0");
		return { id: `creator-${sequence}`, twitchSubject: `twitch-${sequence}`, email: `creator-${sequence}@example.invalid` };
	});
	return {
		creators,
		editors: creators.map(({ id }, index) => ({ creatorId: id, editorTwitchSubject: `editor-${String(index + 1).padStart(6, "0")}` })),
		resources: creators.flatMap(({ id }) => [
			{ id: `overlay-${id}`, creatorId: id, type: "overlay" as const, secret: `non-routable-${id}` },
			{ id: `playlist-${id}`, creatorId: id, type: "playlist" as const },
		]),
		tokens: creators.map(({ id }) => ({ creatorId: id, encryptedAccessToken: `ciphertext-access-${id}`, encryptedRefreshToken: `ciphertext-refresh-${id}` })),
		subscriptions: creators.map(({ id }) => ({ creatorId: id, subscriptionId: `sub-${id}`, status: "active" as const })),
		entitlements: creators.map(({ id }) => ({ creatorId: id, source: "creator" as const, key: "pro" })),
	};
}

export const anonymizedLegacySnapshot = generateLegacySnapshot(2);
export const doubleScaleLegacySnapshot = (currentCreatorCount: number) => generateLegacySnapshot(currentCreatorCount * 2);
