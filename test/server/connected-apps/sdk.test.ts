/** @jest-environment node */
import { createClipifyClient } from "../../../packages/sdk/src/index";

it("searches through client credentials and reuses the short-lived token", async () => {
	const data = { creatorId: "owner", items: [{ id: "ClipA", title: "A clip", broadcasterId: "owner" }], complete: true, nextCursor: null };
	const fetcher = jest
		.fn()
		.mockResolvedValueOnce(Response.json({ access_token: "machine-token", token_type: "Bearer", expires_in: 300 }))
		.mockImplementation(async () => Response.json({ ok: true, data }));
	const client = createClipifyClient({ baseUrl: "https://clipify.example", clientId: "app", clientSecret: "private-secret", fetch: fetcher });
	await expect(client.clips.search({ creatorId: "owner", filters: { title: "clip" } })).resolves.toEqual(data);
	await expect(client.clips.search({ creatorId: "owner" })).resolves.toEqual(data);
	expect(fetcher).toHaveBeenCalledTimes(3);
	const token = fetcher.mock.calls[0];
	expect(token[0]).toBe("https://clipify.example/api/auth/oauth2/token");
	expect(new URLSearchParams(token[1].body).get("resource")).toBe("https://clipify.example/api/connected-apps");
	expect(token[1].redirect).toBe("error");
	expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer machine-token");
	expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ operation: "search_clips", input: { creatorId: "owner", filters: { title: "clip" } } });
});

it.each(["http://public.example", "https://user:pass@clipify.example", "https://clipify.example/prefix", "https://clipify.example?token=secret", "file:///tmp/app"])("rejects unsafe base URL %s before sending credentials", (baseUrl) => {
	expect(() => createClipifyClient({ baseUrl, clientId: "app", clientSecret: "secret" })).toThrow("INVALID_CONFIGURATION");
});
it("allows explicitly opted-in private Docker HTTP but never arbitrary public HTTP", () => {
	expect(() => createClipifyClient({ baseUrl: "http://clipify:3000", clientId: "app", clientSecret: "secret", allowInsecureHttp: true })).not.toThrow();
	expect(() => createClipifyClient({ baseUrl: "http://public.example", clientId: "app", clientSecret: "secret", allowInsecureHttp: true })).toThrow("INVALID_CONFIGURATION");
});
it.each(["", "contains\nnewline"])("rejects invalid client identifiers without requests", (clientId) => {
	expect(() => createClipifyClient({ baseUrl: "https://clipify.example", clientId, clientSecret: "secret" })).toThrow("INVALID_CONFIGURATION");
});
it.each([0, -1, Infinity, 120001])("rejects invalid request timeout %s", (timeoutMs) => {
	expect(() => createClipifyClient({ baseUrl: "https://clipify.example", clientId: "app", clientSecret: "secret", timeoutMs })).toThrow("INVALID_CONFIGURATION");
});

const config = { baseUrl: "https://clipify.example", clientId: "app", clientSecret: "private-secret" };
const tokenResponse = async () => Response.json({ access_token: "machine-token", token_type: "Bearer", expires_in: 300 });
const resultResponse = (creatorId = "owner") => Response.json({ ok: true, data: { creatorId, items: [{ id: "ClipA", title: "A clip", broadcasterId: creatorId }], complete: true, nextCursor: null } });
it.each([Response.json({ error: "private-secret" }, { status: 401 }), new Response("private-secret", { status: 502 }), Response.json({ access_token: "private-secret", token_type: "Basic", expires_in: 300 }), Response.json({ access_token: "private-secret", token_type: "Bearer", expires_in: 0 })])("rejects invalid token responses without exposing provider bodies", async (response) => {
	const client = createClipifyClient({ ...config, fetch: jest.fn().mockResolvedValue(response) });
	await expect(client.clips.search({ creatorId: "owner" })).rejects.toMatchObject({ name: "ClipifySdkError" });
});
it("preserves known permission errors and retry metadata without reflecting arbitrary response content", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => Response.json({ ok: false, error: { code: "ACCESS_DENIED", detail: "private-secret" } }, { status: 403, headers: { "Retry-After": "30" } }));
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "ACCESS_DENIED", status: 403, retryAfterSeconds: 30, message: "Clipify request failed: ACCESS_DENIED" });
});
it.each(["foreign-owner", "malformed", "foreign-clip", "html", "oversized", "oversized-stream"])("rejects an invalid gateway result: %s", async (variant) => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => {
			if (variant === "foreign-owner") return resultResponse("foreign");
			if (variant === "foreign-clip") return Response.json({ ok: true, data: { creatorId: "owner", items: [{ id: "ClipA", title: "A clip", broadcasterId: "foreign" }], complete: true, nextCursor: null } });
			if (variant === "html") return new Response("<html>private-secret</html>");
			if (variant === "oversized") return new Response("{}", { headers: { "Content-Length": String(4 * 1024 * 1024 + 1) } });
			if (variant === "oversized-stream") return new Response("x".repeat(4 * 1024 * 1024 + 1));
			return Response.json({ ok: true, data: { creatorId: "owner", items: [], complete: "yes" } });
		});
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ name: "ClipifySdkError", code: "INVALID_RESPONSE" });
});
it("redacts network failures that may contain credentials", async () => {
	const client = createClipifyClient({ ...config, fetch: jest.fn().mockRejectedValue(new Error("private-secret machine-token")) });
	await expect(client.clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "NETWORK_ERROR", message: "Clipify request failed: NETWORK_ERROR" });
});
it("rejects already aborted calls without issuing a token request", async () => {
	const fetcher = jest.fn();
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" }, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: "ABORTED" });
	expect(fetcher).not.toHaveBeenCalled();
});
it("bounds a stalled response body", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} })));
	await expect(createClipifyClient({ ...config, fetch: fetcher, timeoutMs: 10 }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "TIMEOUT" });
});
it("invalidates a rejected cached token so the next attempt reacquires credentials", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => new Response(null, { status: 401 }))
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => resultResponse());
	const client = createClipifyClient({ ...config, fetch: fetcher });
	await expect(client.clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
	await expect(client.clips.search({ creatorId: "owner" })).resolves.toMatchObject({ creatorId: "owner" });
	expect(fetcher).toHaveBeenCalledTimes(4);
});

it("refreshes token at its safety deadline rather than sending an expired credential", async () => {
	const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => resultResponse())
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => resultResponse());
	try {
		const client = createClipifyClient({ ...config, fetch: fetcher });
		await client.clips.search({ creatorId: "owner" });
		clock.mockReturnValue(271000);
		await client.clips.search({ creatorId: "owner" });
		expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/token"))).toHaveLength(2);
	} finally {
		clock.mockRestore();
	}
});
it("does not reflect an unknown application error into its public error code", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => Response.json({ ok: false, error: { code: "private-secret" } }, { status: 503 }));
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Clipify request failed: SERVICE_UNAVAILABLE" });
});
it("bounds a fetch that never resolves", async () => {
	const fetcher = jest.fn().mockImplementation(() => new Promise(() => {}));
	await expect(createClipifyClient({ ...config, fetch: fetcher, timeoutMs: 10 }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "TIMEOUT" });
});
it("propagates caller cancellation while reading a response", async () => {
	const abort = new AbortController();
	const fetcher = jest.fn().mockImplementation(async () => {
		queueMicrotask(() => abort.abort());
		return new Response(new ReadableStream({ start() {} }));
	});
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" }, { signal: abort.signal })).rejects.toMatchObject({ code: "ABORTED" });
});

it.each(["127.attacker.example", "10.attacker.example", "192.168.attacker.example", "172.16.attacker.example"])("never treats a DNS name as a private address: %s", (host) => {
	expect(() => createClipifyClient({ ...config, baseUrl: `http://${host}`, allowInsecureHttp: true })).toThrow("INVALID_CONFIGURATION");
});

it.each([
	["INVALID_CURSOR", 400],
	["REQUEST_TOO_LARGE", 413],
])("preserves the expected gateway error %s", async (code, status) => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(async () => Response.json({ ok: false, error: { code } }, { status }));
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code, status, message: `Clipify request failed: ${code}` });
});

it("rejects a malformed base URL before touching the network", () => {
	expect(() => createClipifyClient({ ...config, baseUrl: ":not-a-url" })).toThrow("INVALID_CONFIGURATION");
});
it("retains authentication failure when cancelling the provider's error body also fails", async () => {
	const fetcher = jest.fn().mockResolvedValue(
		new Response(
			new ReadableStream({
				cancel() {
					throw new Error("private provider cleanup failure");
				},
			}),
			{ status: 401 },
		),
	);
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
});
it("rejects declared oversized data even when the upstream body cannot be cancelled cleanly", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(
			async () =>
				new Response(
					new ReadableStream({
						cancel() {
							throw new Error("private upstream cleanup failure");
						},
					}),
					{ headers: { "Content-Length": String(4 * 1024 * 1024 + 1) } },
				),
		);
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "INVALID_RESPONSE", message: "Clipify request failed: INVALID_RESPONSE" });
});
it("rejects oversized streamed data without allowing a failing cleanup to replace its error", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockImplementationOnce(
			async () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
						},
						cancel() {
							throw new Error("private upstream cleanup failure");
						},
					}),
				),
		);
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "INVALID_RESPONSE", message: "Clipify request failed: INVALID_RESPONSE" });
});
it("rejects a successful response that contains no body", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.search({ creatorId: "owner" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
it("resolves creator-bound clip metadata using the same token cache", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockResolvedValueOnce(Response.json({ ok: true, data: { creatorId: "owner", clip: { id: "ClipA", title: "A clip", broadcasterId: "owner" } } }));
	const client = createClipifyClient({ ...config, fetch: fetcher });
	await expect(client.clips.resolve({ creatorId: "owner", reference: "ClipA" })).resolves.toMatchObject({ clip: { id: "ClipA" } });
	expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ operation: "resolve_clip", input: { creatorId: "owner", reference: "ClipA" } });
});
it("resolves trusted playback only for the requested creator and clip", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockResolvedValueOnce(Response.json({ ok: true, data: { creatorId: "owner", clipId: "ClipA", playbackUrl: "https://production.assets.clips.twitchcdn.net/c.mp4" } }));
	const client = createClipifyClient({ ...config, fetch: fetcher });
	await expect(client.clips.playback({ creatorId: "owner", clipId: "ClipA" })).resolves.toMatchObject({ clipId: "ClipA" });
	expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ operation: "get_clip_playback", input: { creatorId: "owner", reference: "ClipA" } });
});
it.each([{ creatorId: "foreign" }, { clipId: "Other" }, { playbackUrl: "https://attacker.example/c.mp4" }, { playbackUrl: "http://production.assets.clips.twitchcdn.net/c.mp4" }])("rejects foreign or untrusted playback metadata %j", async (change) => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockResolvedValueOnce(Response.json({ ok: true, data: { creatorId: "owner", clipId: "ClipA", playbackUrl: "https://production.assets.clips.twitchcdn.net/c.mp4", ...change } }));
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.playback({ creatorId: "owner", clipId: "ClipA" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
it("rejects resolved metadata from a foreign creator", async () => {
	const fetcher = jest
		.fn()
		.mockImplementationOnce(tokenResponse)
		.mockResolvedValueOnce(Response.json({ ok: true, data: { creatorId: "owner", clip: { id: "ClipA", title: "T", broadcasterId: "foreign" } } }));
	await expect(createClipifyClient({ ...config, fetch: fetcher }).clips.resolve({ creatorId: "owner", reference: "ClipA" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
