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

export type CommunitySnapshot = {
	streamers: CommunityStreamer[];
	totalCount: number;
	liveCount: number;
	overlayActiveCount: number;
	updatedAt: string;
};
