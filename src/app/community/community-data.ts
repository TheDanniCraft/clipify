import { Plan } from "@types";

import { compareCommunityStreamers } from "@lib/communitySort";

import type {
	CommunityPageGroup,
	CommunityPageGroupKey,
	CommunityPageStreamer,
	CommunitySnapshot,
	CommunityTeaserStreamer,
	CommunityStreamer,
} from "@lib/community-types";

type CommunityPageGroupDefinition = {
	key: CommunityPageGroupKey;
	title: string;
	description: string;
	filter: (streamer: CommunityPageStreamer) => boolean;
};

function twitchUrl(username: string) {
	return `https://twitch.tv/${username}`;
}

function toPublicPageStreamer(streamer: CommunityStreamer): CommunityPageStreamer {
	return {
		...streamer,
		twitchUrl: twitchUrl(streamer.username),
	};
}

function toTeaserStreamer(streamer: CommunityStreamer): CommunityTeaserStreamer {
	return {
		id: streamer.id,
		avatar: streamer.avatar,
		displayName: streamer.displayName,
		status: streamer.status,
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

function filterVisible(streamer: CommunityStreamer, visibleUserIds?: ReadonlySet<string>) {
	return !visibleUserIds || visibleUserIds.has(streamer.id);
}

export function buildCommunityTeaserStreamers(snapshot: CommunitySnapshot, visibleUserIds?: ReadonlySet<string>, limit = 5): CommunityTeaserStreamer[] {
	return snapshot.streamers.filter((streamer) => filterVisible(streamer, visibleUserIds)).sort(compareCommunityStreamers).slice(0, limit).map(toTeaserStreamer);
}

export function buildCommunityPageGroups(snapshot: CommunitySnapshot, visibleUserIds?: ReadonlySet<string>): CommunityPageGroup[] {
	const streamers = snapshot.streamers.filter((streamer) => filterVisible(streamer, visibleUserIds)).sort(compareCommunityStreamers).map(toPublicPageStreamer);
	const groups = groupDefinitions.map((group) => ({
		key: group.key,
		title: group.title,
		description: group.description,
		streamers: [] as CommunityPageStreamer[],
	}));

	for (const streamer of streamers) {
		for (const group of groupDefinitions) {
			if (!group.filter(streamer)) {
				continue;
			}

			const targetGroup = groups.find((entry) => entry.key === group.key);
			if (targetGroup) {
				targetGroup.streamers.push(streamer);
			}
		}
	}

	return groups.filter((group) => group.streamers.length > 0);
}
