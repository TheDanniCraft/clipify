/* istanbul ignore file */
// Legacy resolver moved unchanged from the already-excluded Twitch action module.
import "server-only";
import axios from "axios";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { TwitchClipDownloadResponse, TwitchClipGqlData, TwitchClipGqlResponse, TwitchClipVideoQuality } from "@types";
import { type TwitchRateLimitLog, incrementClipFetchFallback, incrementClipFetchFallbackReason, incrementClipFetchRateLimited, incrementClipFetchV1, incrementClipFetchV2, recordTwitchRateLimit } from "@lib/instanceHealth";
import { operationalCount } from "@lib/operationalHealth";
import { getAccessTokenResultInternal } from "./tokens";
import { reserveTwitchClipDownloadRequest } from "./clip-download-limit";
type VideoQualityWithNumeric = TwitchClipVideoQuality & { numericQuality: number };
const CLIP_DOWNLOAD_SCOPES = new Set(["channel:manage:clips", "editor:manage:clips"]);
const PLAYBACK_REQUEST_TIMEOUT_MS = 10_000;
type ClipDownloadAttemptLog = {
	endpoint: "helix/clips/downloads";
	clipId: string;
	creatorId: string;
	timestamp: string;
	status?: number;
	rateLimitLimit: string | null;
	rateLimitRemaining: string | null;
	rateLimitReset: string | null;
};

function getHeaderValue(headers: Record<string, unknown> | undefined, key: string): string | null {
	if (!headers) return null;
	const value = headers[key];
	if (Array.isArray(value)) return value[0]?.toString() ?? null;
	if (value === undefined || value === null) return null;
	return value.toString();
}

function logClipDownloadRateLimitExhausted(entry: ClipDownloadAttemptLog) {
	console.warn("Twitch clip download rate limit exhausted", entry);
}

function buildClipDownloadRateLimitLog(clipId: string, creatorId: string, timestamp: string, headers?: Record<string, unknown>, status?: number): ClipDownloadAttemptLog {
	return {
		endpoint: "helix/clips/downloads",
		clipId,
		creatorId,
		timestamp,
		status,
		rateLimitLimit: getHeaderValue(headers, "ratelimit-limit"),
		rateLimitRemaining: getHeaderValue(headers, "ratelimit-remaining"),
		rateLimitReset: getHeaderValue(headers, "ratelimit-reset"),
	};
}

function shouldLogClipDownloadRateLimit(headers?: Record<string, unknown>, status?: number): boolean {
	return getHeaderValue(headers, "ratelimit-remaining") === "0" || status === 429;
}

function hasClipDownloadScope(scopes: string[] | undefined): boolean {
	return Array.isArray(scopes) && scopes.some((scope) => CLIP_DOWNLOAD_SCOPES.has(scope));
}

async function getTwitchClipPlaybackUrlFromGraphQL(clipId: string, signal?: AbortSignal): Promise<string | undefined> {
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
					sha256Hash: "993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5",
				},
			},
		},
	];

	try {
		const res = await axios.post<TwitchClipGqlResponse>("https://gql.twitch.tv/gql", query, {
			headers: {
				"Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
				"Content-Type": "application/json",
			},
			signal,
			timeout: PLAYBACK_REQUEST_TIMEOUT_MS,
		});

		const clipData = res.data[0]?.data?.clip as TwitchClipGqlData | undefined;

		if (!clipData || !clipData.videoQualities || clipData.videoQualities.length === 0) {
			return undefined;
		}

		const videoQualities: TwitchClipVideoQuality[] = clipData.videoQualities;

		const sortedByQuality: VideoQualityWithNumeric[] = videoQualities
			.filter((v) => v && v.quality)
			.map((v) => ({
				...v,
				numericQuality: parseInt(v.quality, 10),
			}))
			.sort((a, b) => b.numericQuality - a.numericQuality);

		const bestQuality = sortedByQuality[0];
		if (!bestQuality) return undefined;

		const clipsVideoSource = bestQuality.sourceURL;
		const clipsSignature = clipData.playbackAccessToken.signature;
		const clipsToken = encodeURIComponent(clipData.playbackAccessToken.value);

		return `${clipsVideoSource}?sig=${clipsSignature}&token=${clipsToken}`;
	} catch {
		return undefined;
	}
}

export async function resolveTwitchClipPlaybackUrl(clipId: string, broadcasterId: string, parentSignal?: AbortSignal): Promise<string | undefined> {
	const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(PLAYBACK_REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(PLAYBACK_REQUEST_TIMEOUT_MS);
	const timestamp = new Date().toISOString();
	const tokenResult = await getAccessTokenResultInternal(broadcasterId);
	const token = tokenResult.token;

	if (!token || !hasClipDownloadScope(token.scope)) {
		incrementClipFetchV1();
		const reason = token ? "missingScope" : tokenResult.reason === "user_disabled" ? "disabledAccount" : tokenResult.reason === "refresh_failed" ? "refreshFailed" : "missingCredentials";
		incrementClipFetchFallbackReason(reason);
		operationalCount("clipify.clip_fetch.sources", 1, { source: "graphql", reason });
		return getTwitchClipPlaybackUrlFromGraphQL(clipId, signal);
	}

	try {
		if (!(await reserveTwitchClipDownloadRequest(broadcasterId)).allowed) {
			incrementClipFetchRateLimited();
			return getTwitchClipPlaybackUrlFromGraphQL(clipId, signal);
		}
		const response = await axios.get<TwitchClipDownloadResponse>("https://api.twitch.tv/helix/clips/downloads", {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Client-Id": process.env.TWITCH_CLIENT_ID || "",
			},
			params: {
				editor_id: broadcasterId,
				broadcaster_id: broadcasterId,
				clip_id: clipId,
			},
			signal,
			timeout: PLAYBACK_REQUEST_TIMEOUT_MS,
		});

		const clipDownload = response.data.data.find((entry) => entry.clip_id === clipId) ?? response.data.data[0];
		const url = clipDownload?.landscape_download_url ?? clipDownload?.portrait_download_url ?? undefined;
		const headers = response.headers as Record<string, unknown>;

		// TODO: remove later (stress testing logging)
		const attemptLog = buildClipDownloadRateLimitLog(clipId, broadcasterId, timestamp, headers, response.status);
		const rateLimitLog: TwitchRateLimitLog = {
			broadcasterId: attemptLog.creatorId,
			clipId: attemptLog.clipId,
			limit: attemptLog.rateLimitLimit,
			remaining: attemptLog.rateLimitRemaining,
			reset: attemptLog.rateLimitReset,
			timestamp: attemptLog.timestamp,
		};
		recordTwitchRateLimit(rateLimitLog);
		if (process.env.NODE_ENV !== "test") {
			const logsDir = path.join(process.cwd(), "logs");
			fs.mkdir(logsDir, { recursive: true })
				.then(() => fs.appendFile(path.join(logsDir, "twitch-rate-limits.jsonl"), JSON.stringify(rateLimitLog) + "\n"))
				.catch(console.error);
		}

		if (shouldLogClipDownloadRateLimit(headers, response.status)) {
			logClipDownloadRateLimitExhausted(attemptLog);
		}

		if (url) {
			incrementClipFetchV2();
			operationalCount("clipify.clip_fetch.sources", 1, { source: "twitch_api", outcome: "success" });
			return url;
		}
		operationalCount("clipify.clip_fetch.sources", 1, { source: "twitch_api", outcome: "empty" });
		incrementClipFetchFallback();
		incrementClipFetchFallbackReason("emptyResponse");
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const headers = (error.response?.headers ?? undefined) as Record<string, unknown> | undefined;

			// TODO: remove later (stress testing logging)
			const attemptLog = buildClipDownloadRateLimitLog(clipId, broadcasterId, timestamp, headers, error.response?.status);
			const rateLimitLog: TwitchRateLimitLog = {
				broadcasterId: attemptLog.creatorId,
				clipId: attemptLog.clipId,
				limit: attemptLog.rateLimitLimit,
				remaining: attemptLog.rateLimitRemaining,
				reset: attemptLog.rateLimitReset,
				timestamp: attemptLog.timestamp,
			};
			recordTwitchRateLimit(rateLimitLog);
			if (process.env.NODE_ENV !== "test") {
				const logsDir = path.join(process.cwd(), "logs");
				fs.mkdir(logsDir, { recursive: true })
					.then(() => fs.appendFile(path.join(logsDir, "twitch-rate-limits.jsonl"), JSON.stringify(rateLimitLog) + "\n"))
					.catch(console.error);
			}

			if (shouldLogClipDownloadRateLimit(headers, error.response?.status)) {
				logClipDownloadRateLimitExhausted(attemptLog);
			}

			if (error.response?.status === 429) {
				incrementClipFetchRateLimited();
				incrementClipFetchFallbackReason("rateLimited");
				operationalCount("clipify.clip_fetch.sources", 1, { source: "twitch_api", outcome: "rate_limited" });
			} else {
				incrementClipFetchFallback();
				incrementClipFetchFallbackReason(error.response?.status === 401 || error.response?.status === 403 ? "apiRejected" : "apiError");
				operationalCount("clipify.clip_fetch.sources", 1, { source: "twitch_api", outcome: "fallback" });
			}
		} else {
			incrementClipFetchFallback();
			incrementClipFetchFallbackReason("apiError");
			operationalCount("clipify.clip_fetch.sources", 1, { source: "twitch_api", outcome: "fallback" });
		}
	}

	operationalCount("clipify.clip_fetch.sources", 1, { source: "graphql", reason: "api_fallback" });
	return getTwitchClipPlaybackUrlFromGraphQL(clipId, signal);
}
