import type { SVGProps } from "react";
import { InferSelectModel } from "drizzle-orm";
import { modQueueTable, overlaysTable, settingsTable, tokenTable, usersTable, queueTable, twitchCacheTable } from "@/db/schema";

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

export type TwitchAppAccessTokenResponse = {
	access_token: string;
	expires_in: number;
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

export type TwitchRewardResponse = {
	broadcaster_id: string;
	broadcaster_login: string;
	broadcaster_name: string;
	id: string;
	title: string;
	prompt: string;
	cost: number;
	image: {
		url_1x: string;
		url_2x: string;
		url_4x: string;
	} | null;
	default_image: {
		url_1x: string;
		url_2x: string;
		url_4x: string;
	};
	background_color: string;
	is_enabled: boolean;
	is_user_input_required: boolean;
	max_per_stream_setting: {
		is_enabled: boolean;
		max_per_stream: number;
	};
	max_per_user_per_stream_setting: {
		is_enabled: boolean;
		max_per_user_per_stream: number;
	};
	global_cooldown_setting: {
		is_enabled: boolean;
		global_cooldown_seconds: number;
	};
	is_paused: boolean;
	is_in_stock: boolean;
	should_redemptions_skip_request_queue: boolean;
	redemptions_redeemed_current_stream: number | null;
	cooldown_expires_at: string | null;
};

export type TwitchReward = {
	id: string;
	title: string;
	prompt: string;
	cost: number;
	imageUrl: string | null;
	paused: boolean;
	background_color: string;
};

export enum RewardStatus {
	FULFILLED = "FULFILLED",
	CANCELED = "CANCELED",
}

export enum TwitchCacheType {
	Avatar = "avatar",
	Game = "game",
	Clip = "clip",
	User = "user",
}

export type TwitchCache = InferSelectModel<typeof twitchCacheTable>;

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

export type UserSettings = InferSelectModel<typeof settingsTable> & { editors: string[] };

export type StatusOptions = "active" | "paused";

export type Overlay = InferSelectModel<typeof overlaysTable>;

export type ClipQueueItem = InferSelectModel<typeof queueTable>;
export type ModQueueItem = InferSelectModel<typeof modQueueTable>;

export type OverlayType = "1" | "7" | "30" | "90" | "180" | "365" | "Featured" | "All" | "Queue";

export type AccessType = "owner" | "editor";

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

export type TwitchMessageFragment = {
	type: "	" | "cheermote" | "emote" | "mention" | string;
	text: string;
	cheermote?: {
		prefix: string;
		bits: number;
		tier: number;
	} | null;
	emote?: {
		id: string;
		emote_set_id: string;
		owner_id: string;
		format: Array<"animated" | "static">;
	} | null;
	mention?: {
		user_id: string;
		user_name: string;
		user_login: string;
	} | null;
};

export type TwitchBadge = {
	set_id: string;
	id: string;
	info: string;
};

export type TwitchCheer = {
	bits: number;
};

export type TwitchReply = {
	parent_message_id: string;
	parent_message_body: string;
	parent_user_id: string;
	parent_user_name: string;
	parent_user_login: string;
	thread_message_id: string;
	thread_user_id: string;
	thread_user_name: string;
	thread_user_login: string;
};

export type TwitchMessage = {
	broadcaster_user_id: string;
	broadcaster_user_name: string;
	broadcaster_user_login: string;
	chatter_user_id: string;
	chatter_user_name: string;
	chatter_user_login: string;
	message_id: string;
	message: {
		text: string;
		fragments: TwitchMessageFragment[];
	};
	message_type: "text" | "channel_points_highlighted" | "channel_points_sub_only" | "user_intro" | "power_ups_message_effect" | "power_ups_gigantified_emote" | string;
	badges: TwitchBadge[];
	cheer?: TwitchCheer | null;
	color: string;
	reply?: TwitchReply | null;
	channel_points_custom_reward_id?: string | null;
	source_broadcaster_user_id?: string | null;
	source_broadcaster_user_name?: string | null;
	source_broadcaster_user_login?: string | null;
	source_message_id?: string | null;
	source_badges?: TwitchBadge[] | null;
	is_source_only?: boolean;
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

export type GithubUser = {
	login: string;
	id: number;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	user_view_type?: string;
	site_admin: boolean;
};

export type GithubAsset = {
	url: string;
	id: number;
	node_id: string;
	name: string;
	label: string | null;
	uploader: GithubUser;
	content_type: string;
	state: string;
	size: number;
	download_count: number;
	created_at: string;
	updated_at: string;
	browser_download_url: string;
};

export type GithubRelease = {
	url: string;
	assets_url: string;
	upload_url: string;
	html_url: string;
	id: number;
	author: GithubUser;
	node_id: string;
	tag_name: string;
	target_commitish: string;
	name: string;
	draft: boolean;
	immutable: boolean;
	prerelease: boolean;
	created_at: string;
	updated_at: string;
	published_at: string;
	assets: GithubAsset[];
	tarball_url: string;
	zipball_url: string;
	body: string;
};

export type FeedbackType = "feedback" | "bug" | "feature";

export type Feedback = {
	type: FeedbackType;
	feedback: {
		title: string;
		comment?: string;
		rating?: RatingValueEnum;
	};
};

export type Faq = {
	title: string;
	content: string;
};

export enum RatingValueEnum {
	BAD = "bad",
	POOR = "poor",
	NEUTRAL = "neutral",
	GREAT = "great",
	EXCELLENT = "excellent",
}

export type NumokStripeMetadata = {
	numok_tracking_code: string;
	numok_sid?: string;
	numok_sid2?: string;
	numok_sid3?: string;
};

export type EventSubSubscription = {
	type: string;
	condition?: Record<string, unknown>;
	status?: string;
};

export type EventSubNotification<T = Record<string, unknown>> = {
	subscription: EventSubSubscription;
	event: T;
};

export type RewardRedemptionEvent = {
	id: string;
	broadcaster_user_id: string;
	user_id?: string;
	user_name: string;
	user_input?: string;
	reward: { id: string; title?: string; [k: string]: unknown };
	[key: string]: unknown;
};

declare global {
	interface Window {
		numok: {
			getStripeMetadata(): NumokStripeMetadata;
		};
	}
}

declare global {
	interface Window {
		chatwootSDK?: {
			run: (config: { websiteToken: string; baseUrl: string }) => void;
		};
		chatwootSettings?: {
			hideMessageBubble?: boolean;
			position?: "left" | "right";
			locale?: string;
			type?: "standard" | "expanded_bubble";
			launcherTitle?: string;
			darkMode?: "auto" | "light";
		};
		$chatwoot?: {
			baseUrl: string;
			baseDomain?: string;
			hasLoaded: boolean;
			hideMessageBubble: boolean;
			isOpen: boolean;
			position: "left" | "right";
			websiteToken: string;
			locale: string;
			useBrowserLanguage: boolean;
			type: "standard" | "expanded_bubble";
			availableMessage: string;
			darkMode: "auto" | "light";
			enableEmojiPicker: boolean;
			enableEndConversation: boolean;
			enableFileUpload?: boolean;
			launcherTitle: string;
			popoutChatWindow: () => void;
			removeLabel: (label: string) => void;
			reset: () => void;
			resetTriggered: boolean;
			setColorScheme: (scheme: unknown) => void;
			setConversationCustomAttributes: (attrs: unknown) => void;
			setCustomAttributes: (attrs: unknown) => void;
			setLabel: (label: string) => void;
			setLocale: (locale: string) => void;
			setUser: (user: unknown, options?: unknown) => void;
			showPopoutButton: boolean;
			showUnreadMessagesDialog: boolean;
			toggle: (state?: boolean) => void;
			toggleBubbleVisibility: (visible: boolean) => void;
			unavailableMessage: string;
			welcomeDescription: string;
			welcomeTitle: string;
			widgetStyle: string;
		};
	}
}
