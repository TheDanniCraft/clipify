"use server";

export async function getCommunitySnapshotAction() {
	const { getCommunitySnapshot } = await import("@lib/community");
	return getCommunitySnapshot();
}

export async function getCommunityPageVisibleUserIdsAction(ownerIds: string[]) {
	const { fetchCommunityPageVisibleUserIds } = await import("@lib/community");
	return [...(await fetchCommunityPageVisibleUserIds(ownerIds))];
}
