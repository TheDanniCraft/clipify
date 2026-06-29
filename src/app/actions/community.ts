"use server";

export async function getCommunitySnapshotAction() {
	const { getCommunitySnapshot } = await import("@lib/community");
	return getCommunitySnapshot();
}
