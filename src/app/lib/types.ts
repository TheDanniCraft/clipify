import type { SVGProps } from "react";
import { InferSelectModel } from "drizzle-orm";
import { overlaysTable, tokenTable, usersTable } from "@/db/schema";

export class RateLimitError extends Error {
	constructor() {
		super("Rate limit exceeded");
		this.name = "RateLimitError";
	}
}

export type Cta = {
	text: string;
	icon: React.ReactNode;
};

export type Timer = {
	days: string;
	hours: string;
	minutes: string;
	seconds: string;
};

export type IconSvgProps = SVGProps<SVGSVGElement> & {
	size?: number;
};

export type TwitchApiResponse<T> = {
	data: T[];
	pagination?: Pagination;
};

export type Pagination = {
	cursor: string;
};

export type TwitchTokenApiResponse = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string[];
	token_type: string;
};

export type TwitchUserResponse = {
	id: string;
	login: string;
	display_name: string;
	type: string;
	broadcaster_type: string;
	description: string;
	profile_image_url: string;
	offline_image_url: string;
	view_count: number;
	created_at: string;
	email: string;
};

export type TwitchClipResponse = {
	id: string;
	url: string;
	embed_url: string;
	broadcaster_id: string;
	broadcaster_name: string;
	creator_id: string;
	creator_name: string;
	video_id: string;
	game_id: string;
	language: string;
	title: string;
	view_count: number;
	created_at: string;
	thumbnail_url: string;
	duration: number;
	vod_offset: number | null;
	is_featured: boolean;
};

export type TwitchClipVideoQuality = {
	quality: string;
	sourceURL: string;
};

export type TwitchClipPlaybackAccessToken = {
	signature: string;
	value: string;
};

export type TwitchClipGqlData = {
	videoQualities: TwitchClipVideoQuality[];
	playbackAccessToken: TwitchClipPlaybackAccessToken;
};

export type TwitchClipGqlResponse = Array<{
	data: {
		clip: TwitchClipGqlData;
	};
}>;

export enum Role {
	User = "user",
	Admin = "admin",
}
export enum Plan {
	Free = "free",
	Pro = "pro",
}

export type AuthenticatedUser = InferSelectModel<typeof usersTable>;

export type UserToken = InferSelectModel<typeof tokenTable>;

export type StatusOptions = "active" | "paused";

export type Overlay = InferSelectModel<typeof overlaysTable>;

export type OverlayType = "1" | "7" | "30" | "90" | "180" | "365" | "Featured" | "All";

export type TwitchClipBody = {
	broadcaster_id: string;
	first: number;
	after?: string;
	is_featured?: boolean;
	started_at?: string;
	ended_at?: string;
};

export type TwitchClip = {
	id: string;
	url: string;
	embed_url: string;
	broadcaster_id: string;
	broadcaster_name: string;
	creator_id: string;
	creator_name: string;
	video_id: string;
	game_id: string;
	language: string;
	title: string;
	view_count: number;
	created_at: string;
	thumbnail_url: string;
	duration: number;
};

export type VideoClip = TwitchClip & {
	mediaUrl: string;
	brodcasterAvatar: string;
	game: Game;
};

export type Game = {
	id: string;
	name: string;
	box_art_url: string;
	igdb_id: string;
};
