import "server-only";

import axios from "axios";
import { TwitchTokenApiResponse } from "@types";

export type RefreshAccessTokenResult = {
	token: TwitchTokenApiResponse | null;
	invalidRefreshToken: boolean;
	status?: number;
	message?: string;
};

export async function refreshAccessTokenWithContextInternal(refreshToken: string, userId?: string): Promise<RefreshAccessTokenResult> {
	const url = "https://id.twitch.tv/oauth2/token";
	try {
		const response = await axios.post<TwitchTokenApiResponse>(url, null, {
			params: {
				refresh_token: refreshToken,
				grant_type: "refresh_token",
				client_id: process.env.TWITCH_CLIENT_ID || "",
				client_secret: process.env.TWITCH_CLIENT_SECRET || "",
			},
		});
		return {
			token: response.data,
			invalidRefreshToken: false,
		};
	} catch (error) {
		let status: number | undefined;
		let message: string | undefined;
		let invalidRefreshToken = false;
		if (axios.isAxiosError(error)) {
			status = error.response?.status;
			message = (typeof error.response?.data === "object" && error.response?.data && "message" in error.response.data && typeof error.response.data.message === "string" ? error.response.data.message : error.message) || "unknown";
			invalidRefreshToken = status === 400 && (message ?? "").toLowerCase().includes("invalid refresh token");
		}
		console.error("Error refreshing access token:", {
			userId: userId ?? "unknown",
			status: status ?? "unknown",
			message: message ?? "unknown",
		});
		return {
			token: null,
			invalidRefreshToken,
			status,
			message,
		};
	}
}
