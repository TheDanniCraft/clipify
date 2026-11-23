export type ClipSearchInput = { creatorId: string; filters?: { title?: string }; limit?: number; cursor?: string };
export type ClipReferenceInput = { creatorId: string; reference: string };
export type ClipResolveResult = { creatorId: string; clip: Clip };
export type ClipPlaybackResult = { creatorId: string; clipId: string; playbackUrl: string };
export type Clip = { id: string; title: string; broadcasterId: string; [field: string]: unknown };
export type ClipSearchResult = { creatorId: string; items: Clip[]; complete: boolean; nextCursor: string | null; [field: string]: unknown };
export type CategorySearchInput = { creatorId: string; query: string; limit?: number };
export type TwitchCategory = { id: string; name: string; artworkUrl: string | null };
export type CategorySearchResult = { creatorId: string; items: TwitchCategory[] };
export type ClipifyClientOptions = { baseUrl: string; clientId: string; clientSecret: string; fetch?: typeof fetch; timeoutMs?: number; allowInsecureHttp?: boolean };
export class ClipifySdkError extends Error {
	constructor(
		readonly code: string,
		readonly status?: number,
		readonly retryAfterSeconds?: number,
	) {
		super(`Clipify request failed: ${code}`);
		this.name = "ClipifySdkError";
	}
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const errorCodes = new Set(["ACCESS_DENIED", "AUTHENTICATION_REQUIRED", "PERMISSION_DENIED", "ACCOUNT_SUSPENDED", "INVALID_INPUT", "INVALID_CURSOR", "REQUEST_TOO_LARGE", "CONFLICT", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "RESOURCE_UNAVAILABLE", "NOT_FOUND"]);
function origin(options: ClipifyClientOptions) {
	let url: URL;
	try {
		url = new URL(options.baseUrl);
	} catch {
		throw new ClipifySdkError("INVALID_CONFIGURATION");
	}
	const address = url.hostname.split(".").map(Number);
	const ipv4 = address.length === 4 && address.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
	const privateAddress = ipv4 && (address[0] === 127 || address[0] === 10 || (address[0] === 192 && address[1] === 168) || (address[0] === 172 && address[1] >= 16 && address[1] <= 31));
	const privateHost = privateAddress || url.hostname === "localhost" || url.hostname === "[::1]";
	const validTransport = url.protocol === "https:" || (url.protocol === "http:" && options.allowInsecureHttp === true && privateHost);
	const validCredential = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 4096 && !/[\r\n]/.test(value);
	if (!validTransport || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !validCredential(options.clientId) || !validCredential(options.clientSecret) || (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 120000))) throw new ClipifySdkError("INVALID_CONFIGURATION");
	return url.origin;
}
function validateResult(value: unknown, creatorId: string): ClipSearchResult {
	if (!record(value) || value.creatorId !== creatorId || !Array.isArray(value.items) || value.items.length > 100 || !value.items.every((clip) => record(clip) && typeof clip.id === "string" && clip.id.length > 0 && typeof clip.title === "string" && clip.broadcasterId === creatorId) || typeof value.complete !== "boolean" || (value.nextCursor !== null && typeof value.nextCursor !== "string")) throw new ClipifySdkError("INVALID_RESPONSE");
	return value as ClipSearchResult;
}
export function createClipifyClient(options: ClipifyClientOptions) {
	const base = origin(options);
	const fetcher = options.fetch ?? globalThis.fetch;
	let token: { value: string; until: number } | undefined;
	async function execute<T>(operation: string, input: ClipSearchInput | ClipReferenceInput | CategorySearchInput, validate: (value: unknown, creatorId: string) => T, request?: { signal?: AbortSignal }): Promise<T> {
		if (!input || typeof input.creatorId !== "string" || !input.creatorId || input.creatorId.length > 200) throw new ClipifySdkError("INVALID_INPUT");
		const deadline = new AbortController();
		const timer = setTimeout(() => deadline.abort(), options.timeoutMs ?? 10000);
		const signal = request?.signal ? AbortSignal.any([request.signal, deadline.signal]) : deadline.signal;
		const abortError = () => new ClipifySdkError(request?.signal?.aborted ? "ABORTED" : "TIMEOUT");
		function bounded<T>(promise: Promise<T>): Promise<T> {
			return new Promise((resolve, reject) => {
				if (signal.aborted) {
					reject(abortError());
					return;
				}
				const abort = () => reject(abortError());
				signal.addEventListener("abort", abort, { once: true });
				promise
					.then(resolve, reject)
					.finally(() => signal.removeEventListener("abort", abort))
					.catch(() => {});
			});
		}
		async function json(response: Response): Promise<unknown> {
			const maxBytes = 4 * 1024 * 1024;
			if (Number(response.headers.get("content-length")) > maxBytes) {
				void response.body?.cancel().catch(() => {});
				throw new ClipifySdkError("INVALID_RESPONSE");
			}
			const reader = response.body?.getReader();
			if (!reader) throw new ClipifySdkError("INVALID_RESPONSE");
			let size = 0;
			const chunks: Uint8Array[] = [];
			try {
				while (true) {
					const next = await bounded(reader.read());
					if (next.done) break;
					size += next.value.byteLength;
					if (size > maxBytes) throw new ClipifySdkError("INVALID_RESPONSE");
					chunks.push(next.value);
				}
				const bytes = new Uint8Array(size);
				let offset = 0;
				for (const chunk of chunks) {
					bytes.set(chunk, offset);
					offset += chunk.byteLength;
				}
				try {
					return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
				} catch {
					throw new ClipifySdkError("INVALID_RESPONSE");
				}
			} finally {
				void reader.cancel().catch(() => {});
				reader.releaseLock();
			}
		}
		async function send(url: string, init: RequestInit) {
			if (signal.aborted) throw abortError();
			return bounded(fetcher(url, { ...init, redirect: "error", signal }));
		}
		try {
			if (signal.aborted) throw abortError();
			if (!token || token.until <= Date.now()) {
				const response = await send(`${base}/api/auth/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${encodeURIComponent(options.clientId)}:${encodeURIComponent(options.clientSecret)}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", scope: "creator:read", resource: `${base}/api/connected-apps` }).toString() });
				if (!response.ok) {
					void response.body?.cancel().catch(() => {});
					throw new ClipifySdkError(response.status === 401 || response.status === 400 ? "AUTHENTICATION_REQUIRED" : "SERVICE_UNAVAILABLE", response.status);
				}
				const value = await json(response);
				if (!record(value) || typeof value.access_token !== "string" || !value.access_token || value.access_token.length > 16384 || /[\r\n]/.test(value.access_token) || typeof value.token_type !== "string" || value.token_type.toLowerCase() !== "bearer" || typeof value.expires_in !== "number" || !Number.isFinite(value.expires_in) || value.expires_in <= 0 || value.expires_in > 86400) throw new ClipifySdkError("INVALID_RESPONSE");
				token = { value: value.access_token, until: Date.now() + value.expires_in * 900 };
			}
			const response = await send(`${base}/api/connected-apps`, { method: "POST", headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/json" }, body: JSON.stringify({ operation, input }) });
			if (response.status === 401) token = undefined;
			if (!response.ok) {
				const retry = response.headers.get("retry-after");
				const retryAfter = retry && /^\d{1,6}$/.test(retry) ? Number(retry) : undefined;
				const value = await json(response).catch(() => null);
				const known = record(value) && record(value.error) && typeof value.error.code === "string" && errorCodes.has(value.error.code) ? value.error.code : response.status === 401 ? "AUTHENTICATION_REQUIRED" : response.status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE";
				throw new ClipifySdkError(known, response.status, retryAfter);
			}
			const value = await json(response);
			if (!record(value) || value.ok !== true) throw new ClipifySdkError("INVALID_RESPONSE");
			return validate(value.data, input.creatorId);
		} catch (error) {
			if (signal.aborted) throw abortError();
			if (error instanceof ClipifySdkError) throw error;
			throw new ClipifySdkError("NETWORK_ERROR");
		} finally {
			clearTimeout(timer);
		}
	}
	const search = (input: ClipSearchInput, request?: { signal?: AbortSignal }) => execute("search_clips", input, validateResult, request);
	const resolve = (input: ClipReferenceInput, request?: { signal?: AbortSignal }) => {
		if (!input || typeof input.reference !== "string" || !input.reference || input.reference.length > 2048) return Promise.reject(new ClipifySdkError("INVALID_INPUT"));
		return execute(
			"resolve_clip",
			input,
			(value, creatorId): ClipResolveResult => {
				if (!record(value) || value.creatorId !== creatorId || !record(value.clip) || typeof value.clip.id !== "string" || !value.clip.id || typeof value.clip.title !== "string" || value.clip.broadcasterId !== creatorId) throw new ClipifySdkError("INVALID_RESPONSE");
				return value as ClipResolveResult;
			},
			request,
		);
	};
	const playback = (input: { creatorId: string; clipId: string }, request?: { signal?: AbortSignal }) => {
		if (!input || typeof input.clipId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(input.clipId)) return Promise.reject(new ClipifySdkError("INVALID_INPUT"));
		return execute(
			"get_clip_playback",
			{ creatorId: input.creatorId, reference: input.clipId },
			(value, creatorId): ClipPlaybackResult => {
				if (!record(value) || value.creatorId !== creatorId || value.clipId !== input.clipId || typeof value.playbackUrl !== "string") throw new ClipifySdkError("INVALID_RESPONSE");
				let url: URL;
				try {
					url = new URL(value.playbackUrl);
				} catch {
					throw new ClipifySdkError("INVALID_RESPONSE");
				}
				if (url.protocol !== "https:" || !["production.assets.clips.twitchcdn.net", "d1ndex63qxojbr.cloudfront.net"].includes(url.hostname) || url.username || url.password || url.port) throw new ClipifySdkError("INVALID_RESPONSE");
				return value as ClipPlaybackResult;
			},
			request,
		);
	};
	const searchCategories = (input: CategorySearchInput, request?: { signal?: AbortSignal }) => {
		if (!input || typeof input.query !== "string" || !input.query.trim() || input.query.length > 200 || (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 40))) return Promise.reject(new ClipifySdkError("INVALID_INPUT"));
		return execute(
			"search_categories",
			input,
			(value, creatorId): CategorySearchResult => {
				if (
					!record(value) ||
					value.creatorId !== creatorId ||
					!Array.isArray(value.items) ||
					value.items.length > 40 ||
					!value.items.every((item) => {
						if (!record(item) || typeof item.id !== "string" || !/^\d{1,20}$/.test(item.id) || typeof item.name !== "string" || !item.name || item.name.length > 200 || (item.artworkUrl !== null && typeof item.artworkUrl !== "string")) return false;
						if (item.artworkUrl === null) return true;
						try {
							const url = new URL(item.artworkUrl);
							return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname.endsWith(".jtvnw.net") || url.hostname.endsWith(".twitchcdn.net"));
						} catch {
							return false;
						}
					})
				)
					throw new ClipifySdkError("INVALID_RESPONSE");
				return value as CategorySearchResult;
			},
			request,
		);
	};
	return { clips: { search, resolve, playback }, categories: { search: searchCategories } };
}
