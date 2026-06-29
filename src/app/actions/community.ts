"use server";

export async function getPublicCommunityTeaserAction() {
	const { getCommunitySnapshot, fetchCommunityPageVisibleUserIds } = await import("@lib/community");
	const { buildCommunityTeaserStreamers } = await import("../community/community-data");

	const snapshot = await getCommunitySnapshot();
	const visibleUserIds = await fetchCommunityPageVisibleUserIds(snapshot.streamers.map((streamer) => streamer.id));
	return buildCommunityTeaserStreamers(snapshot, visibleUserIds);
}

export async function getPublicCommunityPageDataAction() {
	const { getCommunitySnapshot, fetchCommunityPageVisibleUserIds } = await import("@lib/community");
	const { buildCommunityPageGroups, buildCommunityTeaserStreamers } = await import("../community/community-data");

	const snapshot = await getCommunitySnapshot();
	const visibleUserIds = await fetchCommunityPageVisibleUserIds(snapshot.streamers.map((streamer) => streamer.id));
	return {
		featuredStreamers: buildCommunityTeaserStreamers(snapshot, visibleUserIds),
		communityGroups: buildCommunityPageGroups(snapshot, visibleUserIds),
	};
}
