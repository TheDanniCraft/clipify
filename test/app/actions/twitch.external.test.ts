/** @jest-environment node */
export {};

import axios from "axios";
import { REWARD_NOT_FOUND } from "@lib/twitchErrors";

const getAccessToken = jest.fn();
const getTwitchCache = jest.fn();
const getTwitchCacheBatch = jest.fn();
const getTwitchCacheEntry = jest.fn();
const getTwitchCacheStale = jest.fn();
const getTwitchCacheStaleBatch = jest.fn();
const setTwitchCache = jest.fn();
const setTwitchCacheBatch = jest.fn();

const getBaseUrl = jest.fn();
const isPreview = jest.fn();
const validateAuth = jest.fn();

jest.mock("@actions/database", () => ({
	deleteTwitchCacheByPrefix: jest.fn(),
	deleteTwitchCacheKeys: jest.fn(),
	getAccessToken: (...args: unknown[]) => getAccessToken(...args),
	getOverlayBySecret: jest.fn(),
	getOverlayPublic: jest.fn(),
	getPlaylistClipsForOwnerServer: jest.fn(),
	getTwitchCache: (...args: unknown[]) => getTwitchCache(...args),
	getTwitchCacheBatch: (...args: unknown[]) => getTwitchCacheBatch(...args),
	getTwitchCacheByPrefixEntries: jest.fn(),
	getTwitchCacheEntry: (...args: unknown[]) => getTwitchCacheEntry(...args),
	getTwitchCacheStale: (...args: unknown[]) => getTwitchCacheStale(...args),
	getTwitchCacheStaleBatch: (...args: unknown[]) => getTwitchCacheStaleBatch(...args),
	setTwitchCache: (...args: unknown[]) => setTwitchCache(...args),
	setTwitchCacheBatch: (...args: unknown[]) => setTwitchCacheBatch(...args),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: (...args: unknown[]) => getBaseUrl(...args),
	isPreview: (...args: unknown[]) => isPreview(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@/db/client", () => ({
	dbPool: {
		connect: jest.fn(),
	},
	db: {
		select: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		execute: jest.fn().mockResolvedValue([{ createdAt: new Date("2020-01-01T00:00:00Z").toISOString() }]),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable: {
		id: "id",
		createdAt: "createdAt",
	},
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(),
}));

type AxiosLikeError = Error & {
	isAxiosError: boolean;
	response?: {
		status?: number;
		data?: unknown;
	};
};

function createAxiosError(status?: number, data?: unknown): AxiosLikeError {
	const error = new Error("axios error") as AxiosLikeError;
	error.isAxiosError = true;
	error.response = { status, data };
	return error;
}

function buildTokenResponse() {
	return {
		access_token: "access",
		refresh_token: "refresh",
		expires_in: 3600,
		scope: [],
		token_type: "bearer",
	};
}

function buildClip(id: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		url: `https://clips.twitch.tv/${id}`,
		embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
		broadcaster_id: "owner-1",
		broadcaster_name: "owner",
		creator_id: "creator-1",
		creator_name: "creator",
		video_id: "video-1",
		game_id: "game-1",
		language: "en",
		title: `clip-${id}`,
		view_count: 10,
		created_at: "2026-03-08T00:00:00.000Z",
		thumbnail_url: "https://thumb",
		duration: 30,
		...overrides,
	};
}

async function loadTwitch() {
	return import("@/app/actions/twitch");
}

describe("actions/twitch external API and failure handling", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
		jest.spyOn(console, "error").mockImplementation(() => undefined);
		process.env.TWITCH_CLIENT_ID = "client-id";
		process.env.TWITCH_CLIENT_SECRET = "client-secret";
		process.env.WEBHOOK_SECRET = "webhook-secret";
		process.env.TWITCH_USER_ID = "bot-user";

		getAccessToken.mockResolvedValue({ accessToken: "user-access" });
		getTwitchCache.mockResolvedValue(null);
		getTwitchCacheBatch.mockResolvedValue([]);
		getTwitchCacheEntry.mockResolvedValue({ hit: false, value: null });
		getTwitchCacheStale.mockResolvedValue(null);
		getTwitchCacheStaleBatch.mockResolvedValue([]);
		setTwitchCache.mockResolvedValue(undefined);
		setTwitchCacheBatch.mockResolvedValue(undefined);
		getBaseUrl.mockResolvedValue("https://clipify.us");
		isPreview.mockResolvedValue(false);
	});

	it("uses preview callback URL when exchanging access token", async () => {
		isPreview.mockResolvedValue(true);
		process.env.PREVIEW_CALLBACK_URL = "https://preview.example/callback";
		const postSpy = jest.spyOn(axios, "post").mockResolvedValue({ data: buildTokenResponse() } as never);

		const { exchangeAccesToken } = await loadTwitch();
		const response = await exchangeAccesToken("code-123");

		expect(response).toEqual(buildTokenResponse());
		expect(postSpy).toHaveBeenCalledWith(
			"https://id.twitch.tv/oauth2/token",
			null,
			expect.objectContaining({
				params: expect.objectContaining({
					redirect_uri: "https://preview.example/callback",
					code: "code-123",
				}),
			}),
		);
	});

	it("returns null when refreshing access token fails", async () => {
		jest.spyOn(axios, "post").mockRejectedValue(new Error("refresh failed"));

		const { refreshAccessToken } = await loadTwitch();
		const response = await refreshAccessToken("refresh-token");

		expect(response).toBeNull();
	});

	it("returns cached bulk users without network request when cache fully satisfies IDs", async () => {
		const cachedUser = { id: "1", login: "one" };
		getTwitchCacheBatch.mockResolvedValue([cachedUser]);
		const getSpy = jest.spyOn(axios, "get");

		const { getUsersDetailsBulk } = await loadTwitch();
		const users = await getUsersDetailsBulk({
			userIds: ["1", "1"],
			accessToken: "token",
		});

		expect(users).toEqual([cachedUser]);
		expect(getSpy).not.toHaveBeenCalled();
	});

	it("falls back to stale bulk user cache on API failure", async () => {
		getTwitchCacheBatch.mockResolvedValue([]);
		getTwitchCacheStaleBatch.mockResolvedValue([{ id: "stale-1", login: "stale" }]);
		jest.spyOn(axios, "get").mockRejectedValue(new Error("users failed"));

		const { getUsersDetailsBulk } = await loadTwitch();
		const users = await getUsersDetailsBulk({
			userIds: ["stale-1"],
			accessToken: "token",
		});

		expect(users).toEqual([{ id: "stale-1", login: "stale" }]);
	});

	it("creates channel reward when user token exists", async () => {
		jest.spyOn(axios, "post").mockResolvedValue({
			data: {
				data: [{ id: "reward-1", title: "Clipify Reward - abc123" }],
			},
		} as never);

		const { createChannelReward } = await loadTwitch();
		const reward = await createChannelReward("owner-1");

		expect(reward).toEqual(expect.objectContaining({ id: "reward-1" }));
	});

	it("returns false removing channel reward when access token is missing", async () => {
		getAccessToken.mockResolvedValue(null);
		const deleteSpy = jest.spyOn(axios, "delete");

		const { removeChannelReward } = await loadTwitch();
		const ok = await removeChannelReward("reward-1", "owner-1");

		expect(ok).toBe(false);
		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("throws REWARD_NOT_FOUND for 404 reward fetches", async () => {
		jest.spyOn(axios, "get").mockRejectedValue(createAxiosError(404));

		const { getReward } = await loadTwitch();
		await expect(getReward("owner-1", "reward-404")).rejects.toThrow(REWARD_NOT_FOUND);
	});

	it("returns null for non-404 reward fetch failures", async () => {
		jest.spyOn(axios, "get").mockRejectedValue(createAxiosError(500));

		const { getReward } = await loadTwitch();
		const reward = await getReward("owner-1", "reward-500");

		expect(reward).toBeNull();
	});

	it("treats EventSub 409 as already subscribed for reward subscription", async () => {
		const postSpy = jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			return Promise.reject(createAxiosError(409));
		});

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect(postSpy).toHaveBeenCalled();
	});

	it("auto-clears stale subscriptions and retries reward EventSub on 429", async () => {
		const eventSubPostCalls: Array<unknown[]> = [];
		jest.spyOn(axios, "post").mockImplementation((url: string, body?: unknown) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				eventSubPostCalls.push([url, body]);
				if (eventSubPostCalls.length === 1) {
					return Promise.reject(createAxiosError(429));
				}
				return Promise.resolve({ data: {} } as never);
			}
			return Promise.resolve({ data: {} } as never);
		});
		jest.spyOn(axios, "get").mockImplementation((url: string) => {
			if (url.includes("/eventsub/subscriptions")) {
				return Promise.resolve({
					data: {
						data: [
							{
								id: "sub-1",
								type: "channel.channel_points_custom_reward_redemption.add",
								condition: {
									broadcaster_user_id: "owner-1",
									reward_id: "reward-1",
								},
							},
						],
						pagination: {},
					},
				} as never);
			}
			return Promise.resolve({ data: { data: [] } } as never);
		});
		const deleteSpy = jest.spyOn(axios, "delete").mockResolvedValue({ data: {} } as never);

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect(deleteSpy).toHaveBeenCalledWith(
			"https://api.twitch.tv/helix/eventsub/subscriptions",
			expect.objectContaining({
				params: { id: "sub-1" },
			}),
		);
		expect(eventSubPostCalls.length).toBe(2);
	});

	it("treats EventSub 409 as already subscribed for chat subscription", async () => {
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			return Promise.reject(createAxiosError(409));
		});

		const { subscribeToChat } = await loadTwitch();
		await expect(subscribeToChat("owner-1")).resolves.toBeUndefined();
	});

	it("returns cached avatar immediately and uses stale avatar on API failure", async () => {
		getTwitchCache.mockResolvedValueOnce("https://cached/avatar.png").mockResolvedValueOnce(null);
		getTwitchCacheStale.mockResolvedValue("https://stale/avatar.png");
		jest.spyOn(axios, "get").mockRejectedValue(new Error("avatar down"));

		const { getAvatar } = await loadTwitch();
		const fromCache = await getAvatar("user-1", "owner-1");
		const fromStale = await getAvatar("user-2", "owner-1");

		expect(fromCache).toBe("https://cached/avatar.png");
		expect(fromStale).toBe("https://stale/avatar.png");
	});

	it("returns cached/stale game details without crashing on failures", async () => {
		getTwitchCacheEntry.mockResolvedValueOnce({ hit: true, value: { id: "game-1", name: "Cached Game" } }).mockResolvedValueOnce({ hit: false, value: null });
		getTwitchCacheStale.mockResolvedValue({ id: "game-2", name: "Stale Game" });
		jest.spyOn(axios, "get").mockRejectedValue(new Error("game down"));

		const { getGameDetails } = await loadTwitch();
		const cached = await getGameDetails("game-1", "owner-1");
		const stale = await getGameDetails("game-2", "owner-1");

		expect(cached).toEqual(expect.objectContaining({ id: "game-1" }));
		expect(stale).toEqual(expect.objectContaining({ id: "game-2" }));
	});

	it("does not send chat messages when app token is unavailable", async () => {
		const postSpy = jest.spyOn(axios, "post").mockRejectedValue(new Error("token down"));

		const { sendChatMessage } = await loadTwitch();
		await expect(sendChatMessage("owner-1", "hello")).resolves.toBeUndefined();

		expect(postSpy).toHaveBeenCalled();
	});

	it("handles clip URL validation and broadcaster ownership checks", async () => {
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [buildClip("owned-clip", { broadcaster_id: "owner-1" })],
			},
		} as never);

		const { handleClip } = await loadTwitch();
		const invalid = await handleClip("not-a-clip-url", "owner-1");
		const valid = await handleClip("https://clips.twitch.tv/owned-clip", "owner-1");

		expect(invalid).toEqual({ errorCode: 1 });
		expect(valid).toEqual(expect.objectContaining({ id: "owned-clip" }));
	});

	it("returns error when clip belongs to another broadcaster", async () => {
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [buildClip("foreign-clip", { broadcaster_id: "other-owner" })],
			},
		} as never);

		const { handleClip } = await loadTwitch();
		const result = await handleClip("https://clips.twitch.tv/foreign-clip", "owner-1");

		expect(result).toEqual({ errorCode: 4 });
	});

	it("logs both axios and non-axios Twitch errors", async () => {
		const consoleSpy = jest.spyOn(console, "error");
		const { logTwitchError } = await loadTwitch();

		await logTwitchError("axios-context", createAxiosError(500, { message: "bad" }));
		await logTwitchError("generic-context", new Error("boom"));

		expect(consoleSpy).toHaveBeenCalledWith("%s:", "axios-context", { message: "bad" });
		expect(consoleSpy).toHaveBeenCalledWith("%s:", "generic-context", expect.any(Error));
	});

	it("returns null when exchange access token request fails", async () => {
		jest.spyOn(axios, "post").mockRejectedValue(createAxiosError(500));

		const { exchangeAccesToken } = await loadTwitch();
		const token = await exchangeAccesToken("bad-code");

		expect(token).toBeNull();
	});

	it("returns refreshed token payload when refresh succeeds", async () => {
		jest.spyOn(axios, "post").mockResolvedValue({ data: buildTokenResponse() } as never);

		const { refreshAccessToken } = await loadTwitch();
		const token = await refreshAccessToken("refresh-token");

		expect(token).toEqual(buildTokenResponse());
	});

	it("fetches app access token successfully", async () => {
		jest.spyOn(axios, "post").mockResolvedValue({
			data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" },
		} as never);

		const { getAppAccessToken } = await loadTwitch();
		const token = await getAppAccessToken();

		expect(token).toEqual(expect.objectContaining({ access_token: "app-token" }));
	});

	it("returns user details and null on user-detail API failure", async () => {
		const getSpy = jest.spyOn(axios, "get");
		getSpy.mockResolvedValueOnce({ data: { data: [{ id: "u1", login: "one" }] } } as never);
		getSpy.mockRejectedValueOnce(new Error("user down"));

		const { getUserDetails } = await loadTwitch();
		const ok = await getUserDetails("access");
		const failed = await getUserDetails("access");

		expect(ok).toEqual(expect.objectContaining({ id: "u1" }));
		expect(failed).toBeNull();
	});

	it("validates getUsersDetailsBulk input constraints", async () => {
		const consoleSpy = jest.spyOn(console, "error");
		const { getUsersDetailsBulk } = await loadTwitch();

		await expect(getUsersDetailsBulk({ accessToken: "token" })).resolves.toEqual([]);
		await expect(getUsersDetailsBulk({ accessToken: "token", userIds: ["1"], userNames: ["one"] })).resolves.toEqual([]);
		await expect(getUsersDetailsBulk({ accessToken: "token", userIds: Array.from({ length: 100 }, (_, i) => String(i)) })).resolves.toEqual([]);

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("merges cached and freshly fetched bulk users and stores fresh cache entries", async () => {
		const cachedUser = { id: "1", login: "cached-one" };
		const freshUser = { id: "2", login: "fresh-two" };
		getTwitchCacheBatch.mockResolvedValue([cachedUser]);
		jest.spyOn(axios, "get").mockResolvedValue({ data: { data: [freshUser] } } as never);

		const { getUsersDetailsBulk } = await loadTwitch();
		const users = await getUsersDetailsBulk({
			userIds: ["1", "2"],
			accessToken: "token",
		});

		expect(users).toEqual([cachedUser, freshUser]);
		expect(setTwitchCacheBatch).toHaveBeenCalledWith(expect.anything(), [{ key: "2", value: freshUser }], expect.any(Number));
	});

	it("returns empty bulk users and logs when API + stale cache both fail", async () => {
		getTwitchCacheBatch.mockResolvedValue([]);
		getTwitchCacheStaleBatch.mockResolvedValue([]);
		const consoleSpy = jest.spyOn(console, "error");
		jest.spyOn(axios, "get").mockRejectedValue(new Error("bulk failed"));

		const { getUsersDetailsBulk } = await loadTwitch();
		const users = await getUsersDetailsBulk({
			userIds: ["a"],
			accessToken: "token",
		});

		expect(users).toEqual([]);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("returns null creating reward when token is missing or API call fails", async () => {
		getAccessToken.mockResolvedValueOnce(null);
		jest.spyOn(axios, "post").mockRejectedValue(new Error("reward failed"));

		const { createChannelReward } = await loadTwitch();
		const noToken = await createChannelReward("owner-1");
		const apiFailed = await createChannelReward("owner-1");

		expect(noToken).toBeNull();
		expect(apiFailed).toBeNull();
	});

	it("removes rewards successfully and returns false when delete fails", async () => {
		const deleteSpy = jest.spyOn(axios, "delete");
		deleteSpy.mockResolvedValueOnce({ data: {} } as never);
		deleteSpy.mockRejectedValueOnce(new Error("delete failed"));

		const { removeChannelReward } = await loadTwitch();
		const ok = await removeChannelReward("reward-1", "owner-1");
		const failed = await removeChannelReward("reward-2", "owner-1");

		expect(ok).toBe(true);
		expect(failed).toBe(false);
	});

	it("verifies token validity for valid and invalid access tokens", async () => {
		const getSpy = jest.spyOn(axios, "get");
		getSpy.mockResolvedValueOnce({ data: {} } as never);
		getSpy.mockRejectedValueOnce(new Error("invalid token"));

		const { verifyToken } = await loadTwitch();
		const valid = await verifyToken({ id: "owner-1" } as never);
		const invalid = await verifyToken({ id: "owner-1" } as never);

		expect(valid).toBe(true);
		expect(invalid).toBe(false);
	});

	it("handles getTwitchClip token-missing and API-failure branches", async () => {
		getAccessToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ accessToken: "user-access" });
		jest.spyOn(axios, "get").mockRejectedValue(new Error("clip endpoint down"));

		const { getTwitchClip } = await loadTwitch();
		const noToken = await getTwitchClip("clip-a", "owner-1");
		const failed = await getTwitchClip("clip-b", "owner-1");

		expect(noToken).toBeNull();
		expect(failed).toBeNull();
	});

	it("returns null force-refresh status without auth and computes status for authenticated users", async () => {
		validateAuth.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "owner-1" });
		getTwitchCache.mockResolvedValue({ lastForcedAt: new Date(Date.now() - 10_000_000).toISOString() });

		const { getOwnClipForceRefreshStatus } = await loadTwitch();
		const anon = await getOwnClipForceRefreshStatus();
		const authed = await getOwnClipForceRefreshStatus();

		expect(anon).toBeNull();
		expect(authed).toEqual(
			expect.objectContaining({
				canRefresh: expect.any(Boolean),
				nextAllowedAt: expect.any(String),
			}),
		);
	});

	it("throws force-refresh when user is not authenticated", async () => {
		validateAuth.mockResolvedValueOnce(null);

		const { forceRefreshOwnClipCache } = await loadTwitch();
		await expect(forceRefreshOwnClipCache(25)).rejects.toThrow("Not authenticated");
	});

	it("throws force-refresh when status lookup returns null after initial auth", async () => {
		validateAuth.mockResolvedValueOnce({ id: "owner-1" }).mockResolvedValueOnce(null);

		const { forceRefreshOwnClipCache } = await loadTwitch();
		await expect(forceRefreshOwnClipCache(25)).rejects.toThrow("Not authenticated");
	});

	it("returns no clips for Queue overlays without hitting sync", async () => {
		const syncSpy = jest.spyOn(axios, "get");
		const { getTwitchClips } = await loadTwitch();
		const clips = await getTwitchClips({ type: "Queue", ownerId: "owner-1" } as never);

		expect(clips).toEqual([]);
		expect(syncSpy).not.toHaveBeenCalled();
	});

	it("handles demo clip no-token, not-found, success and request-failure branches", async () => {
		const postSpy = jest.spyOn(axios, "post");
		const getSpy = jest.spyOn(axios, "get");
		postSpy.mockRejectedValueOnce(new Error("no app token"));
		postSpy.mockResolvedValue({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
		getSpy.mockResolvedValueOnce({ data: { data: [] } } as never);
		getSpy.mockResolvedValueOnce({ data: { data: [buildClip("demo-ok")] } } as never);
		getSpy.mockRejectedValueOnce(new Error("demo error"));

		const { getDemoClip } = await loadTwitch();
		const noToken = await getDemoClip("demo-1");
		const missing = await getDemoClip("demo-2");
		const ok = await getDemoClip("demo-ok");
		const failed = await getDemoClip("demo-3");

		expect(noToken).toBeNull();
		expect(missing).toBeNull();
		expect(ok).toEqual(expect.objectContaining({ id: "demo-ok" }));
		expect(failed).toBeNull();
	});

	it("fetches avatar via app-token fallback and logs when avatar fetch has no stale fallback", async () => {
		getTwitchCache.mockResolvedValue(null);
		getTwitchCacheStale.mockResolvedValueOnce(null);
		getAccessToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ accessToken: "user-access" });
		const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
			data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" },
		} as never);
		const getSpy = jest.spyOn(axios, "get");
		getSpy.mockResolvedValueOnce({
			data: {
				data: [{ id: "user-1", profile_image_url: "https://avatar/new.png" }],
			},
		} as never);
		getSpy.mockRejectedValueOnce(new Error("avatar unavailable"));
		const consoleSpy = jest.spyOn(console, "error");

		const { getAvatar } = await loadTwitch();
		const fallbackAvatar = await getAvatar("user-1", "owner-1");
		const failedAvatar = await getAvatar("user-2", "owner-1");

		expect(postSpy).toHaveBeenCalled();
		expect(fallbackAvatar).toBe("https://avatar/new.png");
		expect(failedAvatar).toBeUndefined();
		expect(setTwitchCache).toHaveBeenCalled();
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("returns undefined avatar when neither user token nor app token is available", async () => {
		getTwitchCache.mockResolvedValue(null);
		getAccessToken.mockResolvedValue(null);
		jest.spyOn(axios, "post").mockRejectedValue(new Error("app token down"));

		const { getAvatar } = await loadTwitch();
		const avatar = await getAvatar("user-1", "owner-1");

		expect(avatar).toBeUndefined();
	});

	it("fetches game details via app-token fallback and handles no-token/no-stale failures", async () => {
		getTwitchCacheEntry.mockResolvedValue({ hit: false, value: null });
		getTwitchCacheStale.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
		getAccessToken.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
		const postSpy = jest.spyOn(axios, "post");
		postSpy
			.mockResolvedValueOnce({
				data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" },
			} as never)
			.mockRejectedValueOnce(new Error("app token down"));
		const getSpy = jest.spyOn(axios, "get");
		getSpy.mockResolvedValueOnce({
			data: {
				data: [{ id: "game-1", name: "Game One" }],
			},
		} as never);
		getSpy.mockRejectedValueOnce(new Error("game request failed"));
		const consoleSpy = jest.spyOn(console, "error");

		const { getGameDetails } = await loadTwitch();
		const viaFallback = await getGameDetails("game-1", "owner-1");
		const noToken = await getGameDetails("game-2", "owner-1");

		expect(viaFallback).toEqual(expect.objectContaining({ id: "game-1" }));
		expect(noToken).toBeNull();
		expect(setTwitchCache).toHaveBeenCalled();
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("returns null reward when user token is missing and returns reward when present", async () => {
		getAccessToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ accessToken: "user-access" });
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [{ id: "reward-ok", title: "Reward" }],
			},
		} as never);

		const { getReward } = await loadTwitch();
		const noToken = await getReward("owner-1", "reward-1");
		const reward = await getReward("owner-1", "reward-ok");

		expect(noToken).toBeNull();
		expect(reward).toEqual(expect.objectContaining({ id: "reward-ok" }));
	});

	it("returns early subscribing to rewards when app token is unavailable", async () => {
		jest.spyOn(axios, "post").mockRejectedValue(new Error("app token missing"));

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();
	});

	it("uses preview callback and logs generic subscribe-to-reward failures", async () => {
		isPreview.mockResolvedValue(true);
		getBaseUrl.mockResolvedValue("https://preview.clipify.dev");
		let eventSubPayload: Record<string, unknown> | null = null;
		jest.spyOn(axios, "post").mockImplementation((url: string, body?: unknown) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				eventSubPayload = body as Record<string, unknown>;
				return Promise.reject(new Error("eventsub failed"));
			}
			return Promise.resolve({ data: {} } as never);
		});
		const consoleSpy = jest.spyOn(console, "error");

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect((eventSubPayload as { transport?: { callback?: string } } | null)?.transport?.callback).toBe("https://preview.clipify.dev/eventsub");
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("handles reward subscription cleanup when listing/deleting stale subs fails", async () => {
		let oauthCalls = 0;
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				oauthCalls += 1;
				if (oauthCalls === 2) {
					return Promise.reject(new Error("list token failed"));
				}
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			return Promise.reject(createAxiosError(429));
		});

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();
	});

	it("logs retry failure when reward re-subscribe after cleanup still fails", async () => {
		let eventSubAttempts = 0;
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				eventSubAttempts += 1;
				if (eventSubAttempts === 1) return Promise.reject(createAxiosError(429));
				return Promise.reject(new Error("retry failed"));
			}
			return Promise.resolve({ data: {} } as never);
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [
					{
						id: "sub-1",
						type: "channel.channel_points_custom_reward_redemption.add",
						condition: { broadcaster_user_id: "owner-1", reward_id: "reward-1" },
					},
				],
				pagination: {},
			},
		} as never);
		jest.spyOn(axios, "delete").mockResolvedValue({ data: {} } as never);
		const consoleSpy = jest.spyOn(console, "error");

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("updates redemption status with token and logs patch failures", async () => {
		const patchSpy = jest.spyOn(axios, "patch");
		patchSpy.mockResolvedValueOnce({ data: {} } as never);
		patchSpy.mockRejectedValueOnce(new Error("patch failed"));

		const { updateRedemptionStatus } = await loadTwitch();
		await updateRedemptionStatus("owner-1", "redeem-1", "reward-1", "FULFILLED" as never);
		await updateRedemptionStatus("owner-1", "redeem-2", "reward-2", "CANCELED" as never);

		expect(patchSpy).toHaveBeenCalledTimes(2);
	});

	it("returns early from redemption status update when token is missing", async () => {
		getAccessToken.mockResolvedValueOnce(null);
		const patchSpy = jest.spyOn(axios, "patch");

		const { updateRedemptionStatus } = await loadTwitch();
		await updateRedemptionStatus("owner-1", "redeem-1", "reward-1", "FULFILLED" as never);

		expect(patchSpy).not.toHaveBeenCalled();
	});

	it("handles chat subscription no-token, preview callback, retry failure and generic errors", async () => {
		const consoleSpy = jest.spyOn(console, "error");
		let oauthCalls = 0;
		let chatSubscribeAttempts = 0;
		isPreview.mockResolvedValue(true);
		getBaseUrl.mockResolvedValue("https://preview.clipify.dev");
		jest.spyOn(axios, "post").mockImplementation((url: string, body?: unknown) => {
			if (url.includes("/oauth2/token")) {
				oauthCalls += 1;
				if (oauthCalls === 1) return Promise.reject(new Error("token unavailable"));
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				chatSubscribeAttempts += 1;
				const callback = (body as { transport?: { callback?: string } })?.transport?.callback;
				if (callback !== "https://preview.clipify.dev/eventsub") {
					throw new Error("unexpected callback");
				}
				if (chatSubscribeAttempts === 1) return Promise.reject(createAxiosError(429));
				if (chatSubscribeAttempts === 2) return Promise.reject(new Error("retry failed"));
				return Promise.reject(new Error("generic chat failure"));
			}
			return Promise.resolve({ data: {} } as never);
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [
					{
						id: "chat-sub-1",
						type: "channel.chat.message",
						condition: { broadcaster_user_id: "owner-1", user_id: "bot-user" },
					},
				],
				pagination: {},
			},
		} as never);
		jest.spyOn(axios, "delete").mockResolvedValue({ data: {} } as never);

		const { subscribeToChat } = await loadTwitch();
		await expect(subscribeToChat("owner-1")).resolves.toBeUndefined();
		await expect(subscribeToChat("owner-1")).resolves.toBeUndefined();
		await expect(subscribeToChat("owner-1")).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("sends chat messages successfully and logs failures", async () => {
		let call = 0;
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			call += 1;
			if (call === 1) return Promise.resolve({ data: {} } as never);
			return Promise.reject(new Error("chat failed"));
		});
		const consoleSpy = jest.spyOn(console, "error");

		const { sendChatMessage } = await loadTwitch();
		await expect(sendChatMessage("owner-1", "hello")).resolves.toBeUndefined();
		await expect(sendChatMessage("owner-1", "hello again")).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("returns handleClip error code 2 when clip ID extraction fails", async () => {
		const fakeInput = {
			match: () => ["full-match", "channel-only", undefined, undefined],
		} as unknown as string;
		const { handleClip } = await loadTwitch();

		const result = await handleClip(fakeInput, "owner-1");

		expect(result).toEqual({ errorCode: 2 });
	});

	it("returns handleClip error code 3 when clip fetch fails", async () => {
		getAccessToken.mockResolvedValueOnce(null);
		const { handleClip } = await loadTwitch();

		const result = await handleClip("https://clips.twitch.tv/missing-clip", "owner-1");

		expect(result).toEqual({ errorCode: 3 });
	});

	it("returns only fresh users when bulk lookup has no cache hits", async () => {
		getTwitchCacheBatch.mockResolvedValue([]);
		jest.spyOn(axios, "get").mockResolvedValue({
			data: { data: [{ id: "fresh-1", login: "fresh-user" }] },
		} as never);

		const { getUsersDetailsBulk } = await loadTwitch();
		const users = await getUsersDetailsBulk({
			userIds: ["fresh-1"],
			accessToken: "token",
		});

		expect(users).toEqual([{ id: "fresh-1", login: "fresh-user" }]);
	});

	it("handles malformed cached clip entries by falling back to provided clip", async () => {
		const clip = buildClip("malformed-fallback");
		getTwitchCache.mockResolvedValue({
			foo: "bar",
			lastValidatedAt: new Date().toISOString(),
		});

		const { resolvePlayableClip } = await loadTwitch();
		const resolved = await resolvePlayableClip("owner-1", clip);

		expect(resolved).toEqual(clip);
	});

	it("handles reward cleanup when listing EventSub subscriptions fails", async () => {
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			return Promise.reject(createAxiosError(429));
		});
		jest.spyOn(axios, "get").mockRejectedValue(new Error("list failed"));
		const consoleSpy = jest.spyOn(console, "error");

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("handles reward cleanup when delete subscription token fetch fails", async () => {
		let oauthCalls = 0;
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				oauthCalls += 1;
				if (oauthCalls === 3) {
					return Promise.reject(new Error("delete token missing"));
				}
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			return Promise.reject(createAxiosError(429));
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [
					{
						id: "sub-del-token",
						type: "channel.channel_points_custom_reward_redemption.add",
						condition: { broadcaster_user_id: "owner-1", reward_id: "reward-1" },
					},
				],
				pagination: {},
			},
		} as never);
		const deleteSpy = jest.spyOn(axios, "delete");

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("handles reward cleanup when delete subscription API call fails", async () => {
		let eventSubCalls = 0;
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				eventSubCalls += 1;
				if (eventSubCalls === 1) return Promise.reject(createAxiosError(429));
				return Promise.resolve({ data: {} } as never);
			}
			return Promise.resolve({ data: {} } as never);
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [
					{
						id: "sub-del-fail",
						type: "channel.channel_points_custom_reward_redemption.add",
						condition: { broadcaster_user_id: "owner-1", reward_id: "reward-1" },
					},
				],
				pagination: {},
			},
		} as never);
		jest.spyOn(axios, "delete").mockRejectedValue(new Error("delete failed"));
		const consoleSpy = jest.spyOn(console, "error");

		const { subscribeToReward } = await loadTwitch();
		await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("logs and returns null for game details API failure when stale cache is unavailable", async () => {
		getTwitchCacheEntry.mockResolvedValue({ hit: false, value: null });
		getAccessToken.mockResolvedValue({ accessToken: "user-access" });
		getTwitchCacheStale.mockResolvedValue(null);
		jest.spyOn(axios, "get").mockRejectedValue(new Error("game endpoint down"));
		const consoleSpy = jest.spyOn(console, "error");

		const { getGameDetails } = await loadTwitch();
		const result = await getGameDetails("game-err", "owner-1");

		expect(result).toBeNull();
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("retries chat subscription successfully after auto-clearing stale EventSub entries", async () => {
		let eventSubCalls = 0;
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				eventSubCalls += 1;
				if (eventSubCalls === 1) return Promise.reject(createAxiosError(429));
				return Promise.resolve({ data: {} } as never);
			}
			return Promise.resolve({ data: {} } as never);
		});
		jest.spyOn(axios, "get").mockResolvedValue({
			data: {
				data: [
					{
						id: "chat-sub-retry",
						type: "channel.chat.message",
						condition: { broadcaster_user_id: "owner-1", user_id: "bot-user" },
					},
				],
				pagination: {},
			},
		} as never);
		jest.spyOn(axios, "delete").mockResolvedValue({ data: {} } as never);

		const { subscribeToChat } = await loadTwitch();
		await expect(subscribeToChat("owner-1")).resolves.toBeUndefined();

		expect(eventSubCalls).toBe(2);
	});

	it("does not auto-clear chat EventSub entries on 429 in production when override is disabled", async () => {
		const originalNodeEnv = process.env.NODE_ENV;
		const originalAutoClear = process.env.TWITCH_EVENTSUB_AUTO_CLEAR;
		Reflect.set(process.env, "NODE_ENV", "production");
		delete process.env.TWITCH_EVENTSUB_AUTO_CLEAR;
		isPreview.mockResolvedValue(false);

		const getSpy = jest.spyOn(axios, "get");
		const deleteSpy = jest.spyOn(axios, "delete");
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				return Promise.reject(createAxiosError(429));
			}
			return Promise.resolve({ data: {} } as never);
		});

		try {
			const { subscribeToChat } = await loadTwitch();
			await expect(subscribeToChat("owner-1")).resolves.toBeUndefined();

			expect(getSpy).not.toHaveBeenCalled();
			expect(deleteSpy).not.toHaveBeenCalled();
		} finally {
			if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
			else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);

			if (originalAutoClear === undefined) delete process.env.TWITCH_EVENTSUB_AUTO_CLEAR;
			else process.env.TWITCH_EVENTSUB_AUTO_CLEAR = originalAutoClear;
		}
	});

	it("does not auto-clear reward EventSub entries on 429 in production when override is disabled", async () => {
		const originalNodeEnv = process.env.NODE_ENV;
		const originalAutoClear = process.env.TWITCH_EVENTSUB_AUTO_CLEAR;
		Reflect.set(process.env, "NODE_ENV", "production");
		delete process.env.TWITCH_EVENTSUB_AUTO_CLEAR;
		isPreview.mockResolvedValue(false);

		const getSpy = jest.spyOn(axios, "get");
		const deleteSpy = jest.spyOn(axios, "delete");
		jest.spyOn(axios, "post").mockImplementation((url: string) => {
			if (url.includes("/oauth2/token")) {
				return Promise.resolve({ data: { access_token: "app-token", expires_in: 3600, token_type: "bearer" } } as never);
			}
			if (url.includes("/eventsub/subscriptions")) {
				return Promise.reject(createAxiosError(429));
			}
			return Promise.resolve({ data: {} } as never);
		});

		try {
			const { subscribeToReward } = await loadTwitch();
			await expect(subscribeToReward("owner-1", "reward-1")).resolves.toBeUndefined();

			expect(getSpy).not.toHaveBeenCalled();
			expect(deleteSpy).not.toHaveBeenCalled();
		} finally {
			if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
			else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);

			if (originalAutoClear === undefined) delete process.env.TWITCH_EVENTSUB_AUTO_CLEAR;
			else process.env.TWITCH_EVENTSUB_AUTO_CLEAR = originalAutoClear;
		}
	});

	it("applies floored positive cooldown env overrides when module constants initialize", async () => {
		const original = process.env.CLIP_FORCE_REFRESH_COOLDOWN_MS;
		process.env.CLIP_FORCE_REFRESH_COOLDOWN_MS = "7200000.9";
		validateAuth.mockResolvedValue({ id: "owner-1" });
		getTwitchCache.mockResolvedValue({});

		let status: { cooldownMs?: number } | null = null;
		try {
			await jest.isolateModulesAsync(async () => {
				const mod = await import("@/app/actions/twitch");
				status = await mod.getOwnClipForceRefreshStatus();
			});
		} finally {
			if (original === undefined) {
				delete process.env.CLIP_FORCE_REFRESH_COOLDOWN_MS;
			} else {
				process.env.CLIP_FORCE_REFRESH_COOLDOWN_MS = original;
			}
		}

		expect(status).toEqual(expect.objectContaining({ cooldownMs: 7200000 }));
	});

	describe("getTwitchGames", () => {
		it("searches games on Twitch", async () => {
			getAccessToken.mockResolvedValue({ accessToken: "token" });
			const twitchGames = [{ id: "1", name: "Game 1" }];
			jest.spyOn(axios, "get").mockResolvedValue({ data: { data: twitchGames } } as never);

			const { getTwitchGames } = await loadTwitch();
			const result = await getTwitchGames("query", "user-1");

			expect(result).toEqual(twitchGames);
			expect(axios.get).toHaveBeenCalledWith("https://api.twitch.tv/helix/search/categories", expect.any(Object));
		});
	});
});
