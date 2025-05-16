import type { SVGProps } from "react";

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

export type TwitchTokenResponse = {
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

export type Role = "user" | "admin";
export type Plan = "free" | "paid";

export type AuthenticatedUser = {
	id: string;
	email: string;
	username: string;
	avatar: string;
	role: Role;
	plan: Plan;
};

export type StatusOptions = "active" | "paused";

export type Overlay = {
	id: string;
	ownerId: string;
	name: string;
	status: StatusOptions;
	type: OverlayType;
};

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
