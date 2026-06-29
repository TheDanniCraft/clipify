import type { Plan } from "@types";

export type CommunityStreamerStatus = "live_with_overlay" | "live" | "offline";

export type CommunityStreamer = {
	id: string;
	username: string;
	displayName: string;
	avatar: string;
	plan: Plan;
	viewCount: number;
	partner: boolean;
	status: CommunityStreamerStatus;
	lastActiveAt: string | null;
};

export type CommunityTeaserStreamer = Pick<CommunityStreamer, "id" | "avatar" | "displayName" | "status">;

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

export type CommunitySnapshot = {
	streamers: CommunityStreamer[];
	totalCount: number;
	liveCount: number;
	overlayActiveCount: number;
	updatedAt: string;
};
