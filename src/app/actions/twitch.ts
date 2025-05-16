"use server";

import axios from "axios";
import { Overlay, TwitchClip, TwitchClipBody, TwitchTokenResponse, TwitchUserResponse } from "@types";
import { getAccessToken } from "@actions/database";

export async function exchangeAccesToken(code: string) {
	const url = "https://id.twitch.tv/oauth2/token";

	const response = await axios.post(url, null, {
		params: {
			client_id: process.env.TWITCH_CLIENT_ID || "",
			client_secret: process.env.TWITCH_CLIENT_SECRET || "",
			code: code,
			grant_type: "authorization_code",
			redirect_uri: process.env.TWITCH_CALLBACK_URL || "",
		},
	});

	return response.data;
}

export async function refreshAccessToken(refreshToken: string): Promise<TwitchTokenResponse> {
	const url = "https://id.twitch.tv/oauth2/token";

	const response = await axios.post(url, null, {
		params: {
			client_id: process.env.TWITCH_CLIENT_ID || "",
			client_secret: process.env.TWITCH_CLIENT_SECRET || "",
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		},
	});

	return response.data;
}

export async function getUserDetails(accessToken: string): Promise<TwitchUserResponse> {
	const url = "https://api.twitch.tv/helix/users";

	const response = await axios.get(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Client-Id": process.env.TWITCH_CLIENT_ID || "",
		},
	});

	return response.data.data[0];
}

export async function getSubscriptionStatus(accessToken: string, userId: string) {
	const url = "https://api.twitch.tv/helix/subscriptions/user";

	const response = await axios.get(url, {
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
}

export async function getTwitchClips(overlay: Overlay) {
	const url = "https://api.twitch.tv/helix/clips";
	const token = await getAccessToken(overlay.ownerId);

	if (!token) {
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

		const response = await axios.get(url, {
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params,
		});

		clips.push(...response.data.data);
		cursor = response.data.pagination?.cursor;
		fetchCount++;
	} while (cursor && fetchCount < 15);

	return clips;
}

export async function getRawMediaUrl(clipId: string) {
	const query = [
		{
			operationName: "VideoAccessToken_Clip",
			variables: {
				platform: "web",
				slug: clipId,
			},
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash: "6fd3af2b22989506269b9ac02dd87eb4a6688392d67d94e41a6886f1e9f5c00f",
				},
			},
		},
	];

	const res = await axios.post("https://gql.twitch.tv/gql", query, {
		headers: {
			"Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
			"Content-Type": "application/json",
		},
	});

	const clipData = res.data[0]?.data?.clip;

	if (!clipData || !clipData.videoQualities || clipData.videoQualities.length === 0) {
		console.error("Invalid clip data or no video qualities available.");
		return undefined;
	}

	const videoQualities = clipData.videoQualities;

	const sortedByQuality = videoQualities
		.map((v: { quality: string; sourceURL: string }) => ({
			...v,
			numericQuality: parseInt(v.quality, 10),
		}))
		.sort((a: { numericQuality: number }, b: { numericQuality: number }) => b.numericQuality - a.numericQuality);

	const bestQuality = sortedByQuality[0];

	if (!bestQuality) {
		console.error("No valid video quality found.");
		return undefined;
	}

	const clipsVideoSource = bestQuality.sourceURL;
	const clipsSignature = clipData.playbackAccessToken.signature;
	const clipsToken = encodeURIComponent(clipData.playbackAccessToken.value);

	const mp4Url = `${clipsVideoSource}?sig=${clipsSignature}&token=${clipsToken}`;

	return mp4Url;
}

export async function getAvatar(userId: string, authUserId: string) {
	const url = "https://api.twitch.tv/helix/users";

	const token = await getAccessToken(authUserId);

	if (!token) {
		return "";
	}

	const response = await axios.get(url, {
		headers: {
			Authorization: `Bearer ${token.access_token}`,
			"Client-Id": process.env.TWITCH_CLIENT_ID || "",
		},
		params: {
			id: userId,
		},
	});

	return response.data.data[0].profile_image_url;
}

export async function getGameDetails(gameId: string, authUserId: string) {
	const url = "https://api.twitch.tv/helix/games";

	const token = await getAccessToken(authUserId);

	if (!token) {
		return "";
	}

	const response = await axios.get(url, {
		headers: {
			Authorization: `Bearer ${token.access_token}`,
			"Client-Id": process.env.TWITCH_CLIENT_ID || "",
		},
		params: {
			id: gameId,
		},
	});

	return response.data.data[0];
}
