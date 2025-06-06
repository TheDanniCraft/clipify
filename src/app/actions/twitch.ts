"use server";

import axios from "axios";
import { AuthenticatedUser, Game, Overlay, Plan, TwitchApiResponse, TwitchClip, TwitchClipBody, TwitchClipResponse, TwitchSubscriptioResponse, TwitchTokenApiResponse, TwitchUserResponse } from "@types";
import { getAccessToken } from "@actions/database";

export async function logTwitchError(context: string, error: unknown) {
	if (axios.isAxiosError(error) && error.response) {
		console.error(`${context}:`, error.response.data);
	} else {
		console.error(`${context}:`, error);
	}
}

export async function exchangeAccesToken(code: string): Promise<TwitchTokenApiResponse | null> {
	const url = "https://id.twitch.tv/oauth2/token";

	try {
		const response = await axios.post<TwitchTokenApiResponse>(url, null, {
			params: {
				client_id: process.env.TWITCH_CLIENT_ID || "",
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
				code: code,
				grant_type: "authorization_code",
				redirect_uri: process.env.TWITCH_CALLBACK_URL || "",
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

export async function getSubscriptionStatus(accessToken: string, userId: string): Promise<Plan> {
	const url = "https://api.twitch.tv/helix/subscriptions/user";
	try {
		const response = await axios.get<TwitchApiResponse<TwitchSubscriptioResponse>>(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				broadcaster_id: "274252231",
				user_id: userId,
			},
		});

		if (response.data.data.length > 0) {
			const subscription = response.data.data[0];
			if (subscription.tier === "1000" || subscription.tier === "2000" || subscription.tier === "3000") {
				return "paid";
			}
		}
		return "free";
	} catch (error) {
		logTwitchError("Error fetching subscription status", error);
		return "free";
	}
}

export async function getTwitchClips(overlay: Overlay): Promise<TwitchClip[]> {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAccessToken(overlay.ownerId);

	if (!token) {
		console.error("No access token found for ownerId:", overlay.ownerId);
		return [];
	}
	const clips: TwitchClip[] = [];
	let cursor: string | undefined;
	let fetchCount = 0;

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
			params.started_at = new Date().toISOString();
			params.ended_at = endDate;
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

	return clips;
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
