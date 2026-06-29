import { Plan } from "@types";

import { compareCommunityStreamers } from "@lib/communitySort";

import type { CommunitySnapshot, CommunityStreamer } from "@lib/community-types";

export type CommunityPageStreamer = CommunityStreamer & {
	twitchUrl: string;
};

export type CommunityPageGroupKey = "partners" | "pro" | "now_live_with_clipify" | "now_live" | "offline";

export type CommunityPageGroup = {
	key: CommunityPageGroupKey;
	title: string;
	description: string;
	streamers: CommunityPageStreamer[];
};

type CommunityPageGroupDefinition = {
	key: CommunityPageGroupKey;
	title: string;
	description: string;
	filter: (streamer: CommunityPageStreamer) => boolean;
};

function twitchUrl(username: string) {
	return `https://twitch.tv/${username}`;
}

function enrichCommunityStreamer(streamer: CommunityStreamer): CommunityPageStreamer {
	return {
		...streamer,
		twitchUrl: twitchUrl(streamer.username),
	};
}

const groupDefinitions: CommunityPageGroupDefinition[] = [
	{
		key: "partners",
		title: "Partners",
		description: "Creators who actively support Clipify and help shape what we build next.",
		filter: (streamer) => streamer.partner,
	},
	{
		key: "pro",
		title: "Pro",
		description: "Creators with Pro access and the full toolset behind their streams.",
		filter: (streamer) => !streamer.partner && streamer.plan === Plan.Pro,
	},
	{
		key: "now_live_with_clipify",
		title: "Now live with Clipify",
		description: "Streamers who are currently running Clipify on stream.",
		filter: (streamer) => streamer.status === "live_with_overlay",
	},
	{
		key: "now_live",
		title: "Now live",
		description: "Live creators from the community right now.",
		filter: (streamer) => streamer.status === "live",
	},
	{
		key: "offline",
		title: "Offline",
		description: "Creators who opted in and are currently offline.",
		filter: (streamer) => streamer.status === "offline",
	},
];

export function buildCommunityHeroStreamers(snapshot: CommunitySnapshot, limit = 5): CommunityPageStreamer[] {
	return snapshot.streamers.map(enrichCommunityStreamer).sort(compareCommunityStreamers).slice(0, limit);
}

export function buildCommunityPageGroups(snapshot: CommunitySnapshot, visibleUserIds?: ReadonlySet<string>): CommunityPageGroup[] {
	const streamers = snapshot.streamers.map(enrichCommunityStreamer).sort(compareCommunityStreamers);
	const isVisible = (streamer: CommunityPageStreamer) => !visibleUserIds || visibleUserIds.has(streamer.id);

	return groupDefinitions.map((group) => ({
		key: group.key,
		title: group.title,
		description: group.description,
		streamers: streamers.filter((streamer) => group.filter(streamer) && isVisible(streamer)),
	})).filter((group) => group.streamers.length > 0);
}
