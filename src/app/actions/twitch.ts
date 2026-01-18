"use server";

import axios from "axios";
import { AuthenticatedUser, Game, Overlay, OverlayType, RewardStatus, TwitchApiResponse, TwitchAppAccessTokenResponse, TwitchClip, TwitchClipBody, TwitchClipResponse, TwitchReward, TwitchRewardResponse, TwitchTokenApiResponse, TwitchUserResponse } from "@types";
import { getAccessToken } from "@actions/database";
import { getBaseUrl, isPreview } from "@actions/utils";

export async function logTwitchError(context: string, error: unknown) {
	if (axios.isAxiosError(error) && error.response) {
		console.error("%s:", context, error.response.data);
	} else {
		console.error("%s:", context, error);
	}
}

function compileEntry(entry: string): RegExp | null {
	const s = entry.trim();
	if (!s) return null;

	try {
		// Regex with forced flags (Discord-like)
		return new RegExp(s, "gi"); // or "giu" if you decide later
	} catch {
		// Not valid regex → treat as keyword
		const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(escaped, "gi");
	}
}

function isTitleBlocked(title: string, blacklist: string[]): boolean {
	return blacklist.some((entry) => {
		const rx = compileEntry(entry);
		if (!rx) return false;

		rx.lastIndex = 0;
		return rx.test(title);
	});
}

export async function exchangeAccesToken(code: string): Promise<TwitchTokenApiResponse | null> {
	const url = "https://id.twitch.tv/oauth2/token";
	const baseUrl = await getBaseUrl();

	let callbackUrl = new URL("/callback", baseUrl).toString();
	if ((await isPreview()) && process.env.PREVIEW_CALLBACK_URL) {
		callbackUrl = new URL(process.env.PREVIEW_CALLBACK_URL).toString();
	}

	try {
		const response = await axios.post<TwitchTokenApiResponse>(url, null, {
			params: {
				client_id: process.env.TWITCH_CLIENT_ID || "",
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				code: code,
				grant_type: "authorization_code",
				redirect_uri: callbackUrl,
			},
		});
		return response.data;
	} catch (error) {
		logTwitchError("Error exchanging access token", error);
		return null;
	}
}

export async function refreshAccessToken(refreshToken: string): Promise<TwitchTokenApiResponse | null> {
	const url = "https://id.twitch.tv/oauth2/token";
	try {
		const response = await axios.post<TwitchTokenApiResponse>(url, null, {
			params: {
				client_id: process.env.TWITCH_CLIENT_ID || "",
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				refresh_token: refreshToken,
				grant_type: "refresh_token",
			},
		});
		return response.data;
	} catch (error) {
		logTwitchError("Error refreshing access token", error);
		return null;
	}
}

export async function getAppAccessToken(): Promise<TwitchAppAccessTokenResponse | null> {
	const url = "https://id.twitch.tv/oauth2/token";
	try {
		const response = await axios.post<TwitchAppAccessTokenResponse>(url, null, {
			params: {
				client_id: process.env.TWITCH_CLIENT_ID || "",
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				grant_type: "client_credentials",
			},
		});
		return response.data;
	} catch (error) {
		logTwitchError("Error fetching app access token", error);
		return null;
	}
}

export async function getUserDetails(accessToken: string): Promise<TwitchUserResponse | null> {
	const url = "https://api.twitch.tv/helix/users";
	try {
		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
		});
		return response.data.data[0] || null;
	} catch (error) {
		logTwitchError("Error fetching user details", error);
		return null;
	}
}

export async function getUsersDetailsBulk({ userIds, userNames, accessToken }: { userIds?: string[]; userNames?: string[]; accessToken: string }): Promise<TwitchUserResponse[]> {
	const url = "https://api.twitch.tv/helix/users";

	try {
		if ((!userIds || userIds.length === 0) && (!userNames || userNames.length === 0)) {
			return [];
		}

		if (userIds && userNames) {
			console.error("You cannot provide both userIds and userNames");
			return [];
		}

		if ((userIds?.length ?? 0) >= 100 || (userNames?.length ?? 0) >= 100) {
			console.error("You cannot provide more than 100 userIds or userNames");
			return [];
		}

		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: userIds ? { id: userIds } : { login: userNames },
		});
		return response.data.data;
	} catch (error) {
		logTwitchError("Error fetching bulk user details", error);
		return [];
	}
}

export async function createChannelReward(userId: string): Promise<TwitchRewardResponse | null> {
	const url = "https://api.twitch.tv/helix/channel_points/custom_rewards";
	try {
		const token = await getAccessToken(userId);
		if (!token) {
			console.error("No access token found for userId:", userId);
			return null;
		}

		const hash = Math.random().toString(36).substring(2, 8);

		const response = await axios.post<TwitchApiResponse<TwitchRewardResponse>>(
			url,
			{
				broadcaster_id: userId,
				title: `Clipify Reward - ${hash}`,
				prompt: "Customize this reward. You can change title, reward cost, and more. This reward requires user input, disabeling will break the functionality.",
				cost: 1,
				is_enabled: false,
				is_user_input_required: true,
			},
			{
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);

		return response.data.data[0] || null;
	} catch (error) {
		logTwitchError("Error fetching channel rewards", error);
		return null;
	}
}

export async function removeChannelReward(rewardId: string, userId: string): Promise<boolean> {
	const url = `https://api.twitch.tv/helix/channel_points/custom_rewards`;
	try {
		const token = await getAccessToken(userId);
		if (!token) {
			console.error("No access token found for userId:", userId);
			return false;
		}

		await axios.delete(url, {
			params: {
				id: rewardId,
				broadcaster_id: userId,
			},
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
		});
		return true;
	} catch (error) {
		logTwitchError("Error removing channel reward", error);
		return false;
	}
}

export async function verifyToken(user: AuthenticatedUser) {
	const url = "https://id.twitch.tv/oauth2/validate";
	try {
		const token = await getAccessToken(user.id);

		await axios.get(url, {
			headers: {
				Authorization: `Bearer ${token?.accessToken}`,
			},
		});
		return true;
	} catch {
		return false;
	}
}

export async function getTwitchClip(clipId: string, creatorId: string): Promise<null | TwitchClip> {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAccessToken(creatorId);

	if (!token) {
		console.error("No access token found for creatorId:", creatorId);
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchClipResponse>>(url, {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: clipId,
			},
		});
		const clip = response.data.data[0];
		if (!clip) {
			console.error("Clip not found for ID:", clipId);
			return null;
		}
		return clip;
	} catch (error) {
		logTwitchError("Error fetching Twitch clip", error);
		return null;
	}
}

export async function getTwitchClips(overlay: Overlay, type?: OverlayType, skipFilter?: boolean): Promise<TwitchClip[]> {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAccessToken(overlay.ownerId);
	overlay.type = type || overlay.type;

	if (!token) {
		console.error("No access token found for ownerId:", overlay.ownerId);
		return [];
	}
	let clips: TwitchClip[] = [];
	let cursor: string | undefined;
	let fetchCount = 0;

	if (overlay.type === "Queue") {
		return clips;
	}

	let endDate = undefined;
	if (overlay.type !== "Featured" && overlay.type !== "All") {
		endDate = new Date(Date.now() - Number(overlay.type) * 24 * 60 * 60 * 1000).toISOString();
	}

	do {
		const params: TwitchClipBody = {
			broadcaster_id: overlay.ownerId,
			first: 100,
			after: cursor,
		};

		if (overlay.type === "Featured") {
			params.is_featured = true;
		} else if (overlay.type !== "All") {
			params.started_at = endDate;
			params.ended_at = new Date().toISOString();
		}

		try {
			const response = await axios.get<TwitchApiResponse<TwitchClipResponse>>(url, {
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params,
			});
			clips.push(...response.data.data);
			cursor = response.data.pagination?.cursor;
		} catch (error) {
			logTwitchError("Error fetching Twitch clips", error);
			break;
		}
		fetchCount++;
	} while (cursor && fetchCount < 15);

	if (!skipFilter) {
		// Filter for duration
		clips = clips.filter((clip) => {
			const clipDuration = clip.duration;
			return clipDuration >= overlay.minClipDuration && clipDuration <= overlay.maxClipDuration;
		});

		// Filter for blacklist words
		clips = clips.filter((clip) => {
			return !isTitleBlocked(clip.title, overlay.blacklistWords);
		});
	}

	return clips;
}

export async function getDemoClip(clipId: string): Promise<TwitchClip | null> {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchClipResponse>>(url, {
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: clipId,
			},
		});
		const clip = response.data.data[0];
		if (!clip) {
			console.error("Clip not found for ID:", clipId);
			return null;
		}
		return clip;
	} catch (error) {
		logTwitchError("Error fetching demo Twitch clip", error);
		return null;
	}
}

export async function getAvatar(userId: string, authUserId: string): Promise<string | undefined> {
	const url = "https://api.twitch.tv/helix/users";

	const token = await getAccessToken(authUserId);

	if (!token) {
		console.error("No access token found for authUserId:", authUserId);
		return undefined;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchUserResponse>>(url, {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: userId,
			},
		});
		return response.data.data[0]?.profile_image_url || undefined;
	} catch (error) {
		logTwitchError("Error fetching avatar", error);
		return undefined;
	}
}

export async function getGameDetails(gameId: string, authUserId: string): Promise<Game | null> {
	const url = "https://api.twitch.tv/helix/games";

	const token = await getAccessToken(authUserId);

	if (!token) {
		console.error("No access token found for authUserId:", authUserId);
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<Game>>(url, {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: gameId,
			},
		});
		return response.data.data[0] || null;
	} catch (error) {
		logTwitchError("Error fetching game details", error);
		return null;
	}
}

export async function getReward(userId: string, rewardId: string): Promise<TwitchReward | null> {
	const url = `https://api.twitch.tv/helix/channel_points/custom_rewards`;
	const token = await getAccessToken(userId);

	if (!token) {
		console.error("No access token found for userId:", userId);
		return null;
	}

	try {
		const response = await axios.get<TwitchApiResponse<TwitchReward>>(url, {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				id: rewardId,
				broadcaster_id: userId,
			},
		});
		return response.data.data[0] || null;
	} catch (error) {
		logTwitchError("Error fetching reward", error);
		return null;
	}
}

export async function subscribeToReward(userId: string, rewardId: string): Promise<void> {
	const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return;
	}

	let eventsubCallback = process.env.TWITCH_EVENTSUB_URL;

	if (await isPreview()) {
		const baseUrl = await getBaseUrl();
		eventsubCallback = new URL("/eventsub", baseUrl).toString();
	}

	try {
		await axios.post(
			url,
			{
				type: "channel.channel_points_custom_reward_redemption.add",
				version: "1",
				condition: {
					broadcaster_user_id: userId,
					reward_id: rewardId,
				},
				transport: {
					method: "webhook",
					callback: eventsubCallback,
					secret: process.env.WEBHOOK_SECRET,
				},
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 409) {
			return;
		}
		logTwitchError("Error subscribing to reward", error);
	}
}

export async function updateRedemptionStatus(userId: string, redemptionId: string, rewardId: string, status: RewardStatus) {
	const url = "https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions";
	const token = await getAccessToken(userId);

	if (!token) {
		console.error("No app access token found");
		return;
	}

	try {
		await axios.patch(
			url,
			{
				status,
			},
			{
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
				params: {
					id: redemptionId,
					broadcaster_id: userId,
					reward_id: rewardId,
				},
			},
		);
	} catch (error) {
		logTwitchError("Error updating redemption status", error);
	}
}

export async function subscribeToChat(userId: string) {
	const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return;
	}

	let eventsubCallback = process.env.TWITCH_EVENTSUB_URL;

	if (await isPreview()) {
		const baseUrl = await getBaseUrl();
		eventsubCallback = new URL("/eventsub", baseUrl).toString();
	}

	try {
		await axios.post(
			url,
			{
				type: "channel.chat.message",
				version: "1",
				condition: {
					broadcaster_user_id: userId,
					user_id: process.env.TWITCH_USER_ID || "",
				},
				transport: {
					method: "webhook",
					callback: eventsubCallback,
					secret: process.env.WEBHOOK_SECRET,
				},
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 409) {
			return;
		}
		logTwitchError("Error subscribing to chat", error);
	}
}

export async function sendChatMessage(userId: string, message: string) {
	const url = "https://api.twitch.tv/helix/chat/messages";
	const token = await getAppAccessToken();

	if (!token) {
		console.error("No app access token found");
		return;
	}

	try {
		await axios.post(
			url,
			{
				message,
				broadcaster_id: userId,
				sender_id: process.env.TWITCH_USER_ID || "",
			},
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					"Client-Id": process.env.TWITCH_CLIENT_ID || "",
				},
			},
		);
	} catch (error) {
		logTwitchError("Error sending chat message", error);
	}
}

export async function handleClip(input: string, broadcasterId: string) {
	const twitchClipRegex = /^https?:\/\/(?:www\.)?twitch\.tv\/(\w+)\/clip\/([A-Za-z0-9_-]+)|^https?:\/\/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/;
	const match = input.match(twitchClipRegex);

	if (!match) {
		console.error("Invalid Twitch clip URL:", input);

		return { errorCode: 1 };
	}

	const clipId = match[2] || match[3];
	if (!clipId) {
		console.error("Could not extract clip ID from URL:", input);

		return { errorCode: 2 };
	}

	const clip = await getTwitchClip(clipId, broadcasterId);

	if (!clip) {
		console.error("Failed to fetch clip", clipId);

		return { errorCode: 3 };
	}

	if (clip.broadcaster_id !== broadcasterId) {
		console.error("Clip does not belong to the specified creator:", broadcasterId);

		return { errorCode: 4 };
	}

	return clip;
}
