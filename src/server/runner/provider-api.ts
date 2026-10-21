import "server-only";
import { z } from "zod";
import { type StreamingProvider } from "./provider-contract";
export class ProviderRequestError extends Error {
	constructor(
		readonly code: "RECONNECT_REQUIRED" | "PROVIDER_UNAVAILABLE" | "CHANNEL_UNAVAILABLE",
		message = code === "RECONNECT_REQUIRED" ? "Reconnect this channel to continue." : code === "CHANNEL_UNAVAILABLE" ? "Enable live streaming on this channel and try again." : "The streaming service is unavailable. Please try again.",
	) {
		super(message);
		this.name = "ProviderRequestError";
	}
}
const roots = ["https://id.twitch.tv/", "https://api.twitch.tv/helix/", "https://oauth2.googleapis.com/", "https://www.googleapis.com/youtube/"];
async function readProviderJson(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
	const chunks: Uint8Array[] = [];
	let size = 0,
		complete = false;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			size += next.value.length;
			if (size > 262144) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
			chunks.push(next.value);
		}
		complete = true;
	} finally {
		if (!complete) void reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	return JSON.parse(Buffer.concat(chunks, size).toString("utf8")) as unknown;
}
const failureResponse = z.object({
	error: z
		.union([
			z.string(),
			z.object({
				errors: z
					.array(z.object({ reason: z.string().max(100) }))
					.max(20)
					.optional(),
			}),
		])
		.optional(),
	message: z.string().max(200).optional(),
});
function providerFailureCode(status: number, raw: unknown): ProviderRequestError["code"] {
	const data = failureResponse.safeParse(raw).data;
	if (typeof data?.error === "object" && data.error.errors?.some((error) => ["liveStreamingNotEnabled", "insufficientLivePermissions"].includes(error.reason))) return "CHANNEL_UNAVAILABLE";
	if (typeof data?.error === "object" && data.error.errors?.some((error) => ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded"].includes(error.reason))) return "PROVIDER_UNAVAILABLE";
	if (data?.error === "invalid_grant" || data?.message === "Invalid refresh token") return "RECONNECT_REQUIRED";
	return status === 401 || status === 403 ? "RECONNECT_REQUIRED" : "PROVIDER_UNAVAILABLE";
}
/** Fixed provider endpoints only. Bound the response body as well as the initial request. */
async function request(url: string, init: RequestInit = {}) {
	if (!roots.some((root) => url.startsWith(root))) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
	try {
		const response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
		if (!response.ok) {
			const data = await readProviderJson(response).catch(() => null);
			throw new ProviderRequestError(providerFailureCode(response.status, data));
		}
		return response.status === 204 ? {} : await readProviderJson(response);
	} catch (error) {
		if (error instanceof ProviderRequestError) throw error;
		throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
	}
}
const tokenResponse = z.object({ access_token: z.string().min(1).max(8192), refresh_token: z.string().min(1).max(8192).optional(), expires_in: z.number().int().positive().max(31536000), scope: z.union([z.string(), z.array(z.string())]).optional() });
export type StreamingTokens = { accessToken: string; refreshToken?: string; expiresAt: number };
export async function refreshStreamingTokens(provider: StreamingProvider, input: { clientId: string; clientSecret: string; refreshToken: string }) {
	const data = await request(provider === "twitch" ? "https://id.twitch.tv/oauth2/token" : "https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, refresh_token: input.refreshToken, grant_type: "refresh_token" }) });
	const parsed = tokenResponse.safeParse(data);
	if (!parsed.success) throw new ProviderRequestError("RECONNECT_REQUIRED");
	return { accessToken: parsed.data.access_token, refreshToken: parsed.data.refresh_token ?? input.refreshToken, expiresAt: Date.now() + parsed.data.expires_in * 1000 };
}
export type ProviderContext = { provider: StreamingProvider; accessToken: string; clientId: string; channelId: string; signal?: AbortSignal };
function headers(context: Pick<ProviderContext, "provider" | "accessToken" | "clientId">) {
	return { Authorization: `Bearer ${context.accessToken}`, ...(context.provider === "twitch" ? { "Client-Id": context.clientId } : {}) };
}
export async function fetchStreamingChannel(provider: StreamingProvider, accessToken: string, clientId: string) {
	const data = await request(provider === "twitch" ? "https://api.twitch.tv/helix/users" : "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: headers({ provider, accessToken, clientId }) });
	const parsed = provider === "twitch" ? z.object({ data: z.array(z.object({ id: z.string().regex(/^\d+$/), display_name: z.string().min(1).max(120) })).length(1) }).safeParse(data) : z.object({ items: z.array(z.object({ id: z.string().min(1).max(128), snippet: z.object({ title: z.string().min(1).max(120) }) })).length(1) }).safeParse(data);
	if (!parsed.success) throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
	if ("data" in parsed.data) return { id: parsed.data.data[0].id, name: parsed.data.data[0].display_name };
	return { id: parsed.data.items[0].id, name: parsed.data.items[0].snippet.title };
}
const streamList = z.object({ items: z.array(z.object({ id: z.string().min(1).max(128), snippet: z.object({ title: z.string() }), cdn: z.object({ ingestionInfo: z.object({ streamName: z.string().min(1).max(4096) }) }) })) });
export async function fetchYoutubeStreams(context: ProviderContext) {
	const data = await request("https://www.googleapis.com/youtube/v3/liveStreams?part=id,snippet,cdn&mine=true&maxResults=50", { signal: context.signal, headers: headers(context) });
	const parsed = streamList.safeParse(data);
	if (!parsed.success) throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
	return parsed.data.items;
}
export async function fetchStreamingKey(context: ProviderContext, streamId?: string) {
	if (context.provider === "youtube") {
		const stream = (await fetchYoutubeStreams(context)).find((stream) => stream.id === streamId);
		if (!stream) throw new ProviderRequestError("CHANNEL_UNAVAILABLE", "Choose a YouTube stream key from this channel.");
		return stream.cdn.ingestionInfo.streamName;
	}
	const data = await request(`https://api.twitch.tv/helix/streams/key?broadcaster_id=${encodeURIComponent(context.channelId)}`, { signal: context.signal, headers: headers(context) });
	const parsed = z.object({ data: z.array(z.object({ stream_key: z.string().min(1).max(4096) })).length(1) }).safeParse(data);
	if (!parsed.success) throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
	return parsed.data.data[0].stream_key;
}
export async function findYoutubeBroadcast(context: ProviderContext, streamId: string) {
	const data = await request("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,contentDetails,status&mine=true&maxResults=50", { signal: context.signal, headers: headers(context) });
	const parsed = z.object({ items: z.array(z.object({ id: z.string(), contentDetails: z.object({ boundStreamId: z.string().optional() }), status: z.object({ lifeCycleStatus: z.string() }) })) }).safeParse(data);
	if (!parsed.success) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
	const candidates = parsed.data.items.filter((item) => item.contentDetails.boundStreamId === streamId && ["ready", "testing", "live", "liveStarting", "testStarting"].includes(item.status.lifeCycleStatus));
	if (candidates.length !== 1) throw new ProviderRequestError("CHANNEL_UNAVAILABLE", "Bind one upcoming or live YouTube broadcast to this stream key.");
	return candidates[0].id;
}
export async function updateStreamingMetadata(context: ProviderContext, details: { title: string; description?: string; categoryId?: string }, broadcastId?: string) {
	if (context.provider === "twitch") {
		await request(`https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(context.channelId)}`, { method: "PATCH", signal: context.signal, headers: { ...headers(context), "Content-Type": "application/json" }, body: JSON.stringify({ title: details.title, ...(details.categoryId ? { game_id: details.categoryId } : {}) }) });
		return;
	}
	if (!broadcastId) throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
	const current = await request(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(broadcastId)}`, { signal: context.signal, headers: headers(context) });
	const parsed = z.object({ items: z.array(z.object({ snippet: z.object({ title: z.string(), categoryId: z.string(), description: z.string().optional(), tags: z.array(z.string()).optional(), defaultLanguage: z.string().optional(), defaultAudioLanguage: z.string().optional() }) })).length(1) }).safeParse(current);
	if (!parsed.success) throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
	await request("https://www.googleapis.com/youtube/v3/videos?part=snippet", { method: "PUT", signal: context.signal, headers: { ...headers(context), "Content-Type": "application/json" }, body: JSON.stringify({ id: broadcastId, snippet: { ...parsed.data.items[0].snippet, title: details.title, ...(details.description ? { description: details.description } : {}) } }) });
}
export async function updateYoutubeThumbnail(context: ProviderContext, broadcastId: string, image: { bytes: Uint8Array; mime: string }) {
	await request(`https://www.googleapis.com/youtube/upload/v3/thumbnails/set?videoId=${encodeURIComponent(broadcastId)}&uploadType=media`, { method: "POST", signal: context.signal, headers: { ...headers(context), "Content-Type": image.mime }, body: new Uint8Array(image.bytes) });
}
export async function searchTwitchCategories(context: ProviderContext, query: string) {
	if (context.provider !== "twitch") return [];
	const data = await request(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}&first=20`, { signal: context.signal, headers: headers(context) });
	const parsed = z.object({ data: z.array(z.object({ id: z.string().regex(/^\d+$/), name: z.string().max(200) })) }).safeParse(data);
	if (!parsed.success) throw new ProviderRequestError("PROVIDER_UNAVAILABLE");
	return parsed.data.data;
}
