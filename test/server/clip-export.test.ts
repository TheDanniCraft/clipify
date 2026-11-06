/** @jest-environment node */
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { exportRequestSchema, buildClipArchive, buildClipExportPlan, isTrustedClipMediaUrl, isCompleteMp4, clipExportFilename, readBoundedResponse } from "@/server/clip-export";

describe("manual clip export selection", () => {
	it("U97: freezes a deduplicated nonempty selection of at most fifty IDs", () => {
		expect(exportRequestSchema.parse({ creatorId: "owner", clipIds: ["ClipA", "ClipA", "ClipB"] })).toEqual({ creatorId: "owner", clipIds: ["ClipA", "ClipB"] });
	});
});

it("permits manual exports only through explicit creator/export roles", async () => {
	const { STANDARD_ROLES } = await import("@/auth/permissions");
	expect(STANDARD_ROLES.contentManager).toContain("clips:export");
	expect(STANDARD_ROLES.contentManager).toContain("creator:read");
	expect(STANDARD_ROLES.analyst).not.toContain("clips:export");
	expect(STANDARD_ROLES.billingManager).not.toContain("clips:export");
});

it("U117: permits only the official exact HTTPS media host", async () => {
	const { isTrustedClipMediaUrl } = await import("@/server/clip-export");
	expect(isTrustedClipMediaUrl("https://production.assets.clips.twitchcdn.net/clip.mp4?signature=temporary")).toBe(true);
});

it("U124: accepts the existing complete MP4 media fixture", async () => {
	const { isCompleteMp4 } = await import("@/server/clip-export");
	const { readFileSync } = await import("node:fs");
	expect(isCompleteMp4(readFileSync("test/fixtures/runner/presentation.mp4"))).toBe(true);
});

it("U121: rejects actual bytes over the cap despite a smaller Content-Length", async () => {
	const { readBoundedResponse } = await import("@/server/clip-export");
	await expect(readBoundedResponse(new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-length": "1" } }), 3)).rejects.toThrow("byte_limit");
});

const exportBrand = jest.fn();
const exportEntitlements = jest.fn();
jest.mock("@/server/creator-brand", () => ({ readCreatorBrand: (...args: unknown[]) => exportBrand(...args) }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: (...args: unknown[]) => exportEntitlements(...args) }));
const afterZip = jest.fn();
jest.mock("fflate", () => {
	const actual = jest.requireActual("fflate");
	return {
		...actual,
		zipSync: (...args: unknown[]) => {
			const bytes = actual.zipSync(...args);
			afterZip();
			return bytes;
		},
	};
});
const authorize = jest.fn();
const getToken = jest.fn();
const rateLimit = jest.fn();
const render = jest.fn();
jest.mock("@/server/clip-layout-render", () => ({ renderClipLayout: (...args: unknown[]) => render(...args) }));
const layouts = jest.fn();
jest.mock("@actions/clipLayoutLibrary", () => ({ listClipLayouts: (...args: unknown[]) => layouts(...args) }));
const cacheRead = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/server/tokens", () => ({ getAccessTokenResultInternal: (...args: unknown[]) => getToken(...args) }));
const providerCapacity = jest.fn();
jest.mock("@/server/clip-download-limit", () => ({
	reserveClipDownloadJob: async (creatorId: string) => {
		const result = await rateLimit(creatorId);
		return result.success ? { allowed: true, remaining: 2 } : { allowed: false, retryAfterSeconds: 60 };
	},
	reserveTwitchClipDownloadRequest: (...args: unknown[]) => providerCapacity(...args),
	reserveClipSourceTransfer: jest.fn().mockResolvedValue({ allowed: true, remaining: 0 }),
	reserveClipExportVolume: jest.fn().mockResolvedValue({ allowed: true, remaining: 0 }),
}));
jest.mock("@/db/client", () => ({
	db: {
		select: () => {
			const query = { from: () => query, where: () => query, execute: () => cacheRead() };
			return query;
		},
	},
}));
afterEach(() => jest.restoreAllMocks());
const video = readFileSync("test/fixtures/runner/presentation.mp4");
const ownedEntry = (id = "ClipA", extra: Record<string, unknown> = {}) => ({ key: `clip:owner:${id}`, value: JSON.stringify({ clip: { id, title: "My clip", duration: 12, broadcaster_id: "owner", created_at: "2026-11-01T00:00:00Z", ...extra } }) });
beforeEach(() => {
	afterZip.mockReset();
	exportBrand.mockReset().mockResolvedValue({ brand: null, revision: 0 });
	exportEntitlements.mockReset().mockResolvedValue({ proAccess: true });
	authorize.mockReset();
	getToken.mockReset();
	rateLimit.mockReset();
	providerCapacity.mockReset().mockResolvedValue({ allowed: true, remaining: 99 });
	cacheRead.mockReset();
	layouts.mockReset().mockResolvedValue({ ok: true, templates: [], defaults: {} });
	render.mockReset().mockImplementation(jest.requireActual("@/server/clip-layout-render").renderClipLayout);
	authorize.mockResolvedValue({ allowed: true, authUserId: "actor" });
	rateLimit.mockResolvedValue({ success: true });
	getToken.mockResolvedValue({ token: { accessToken: "private-token", scope: ["channel:manage:clips"] } });
	cacheRead.mockResolvedValue([{ key: "clip:owner:ClipA", value: JSON.stringify({ clip: { id: "ClipA", title: "My clip", duration: 12, broadcaster_id: "owner", created_at: "2026-11-01T00:00:00Z" } }) }]);
	jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/ClipA.mp4" }] }) : new Response(video, { headers: { "Content-Type": "video/mp4" } })));
});
it("U105: creates one ZIP containing complete selected media and a public manifest", async () => {
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] });
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.code);
	const entries = unzipSync(result.bytes);
	const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
	expect(result.summary).toEqual({ included: [0], skipped: [] });
	expect(manifest.clips).toHaveLength(1);
	expect(manifest.clips[0]).toMatchObject({ id: "ClipA", status: "included", variant: "landscape", bytes: video.byteLength });
	expect(entries[manifest.clips[0].filename]).toEqual(new Uint8Array(video));
	expect(strFromU8(entries["manifest.json"])).not.toContain("private-token");
});

it.each(["http://production.assets.clips.twitchcdn.net/a.mp4", "https://user:pass@production.assets.clips.twitchcdn.net/a.mp4", "https://production.assets.clips.twitchcdn.net:444/a.mp4", "https://evil.production.assets.clips.twitchcdn.net/a.mp4", "https://127.0.0.1/a.mp4", "https://[::1]/a.mp4", "not a URL"])("rejects unsafe media URL %s", (url) => expect(isTrustedClipMediaUrl(url)).toBe(false));
it.each([new Uint8Array(), new TextEncoder().encode("<html>error</html>"), new Uint8Array([0, 0, 0, 4, 102, 116, 121, 112]), new Uint8Array(video.subarray(0, video.length - 1))])("rejects incomplete or non-MP4 data %#", (bytes) => expect(isCompleteMp4(bytes)).toBe(false));
it.each([[], [""], ["x".repeat(201)], Array.from({ length: 51 }, (_, i) => String(i))].map((ids) => [ids]))("rejects invalid export selections %#", async (clipIds) => {
	expect(await buildClipArchive({ creatorId: "owner", clipIds })).toMatchObject({ ok: false, code: "INVALID_INPUT", status: 400 });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("accepts a fifty-ID selection and deduplicates repeated IDs", () => {
	expect(exportRequestSchema.parse({ creatorId: "owner", clipIds: Array.from({ length: 50 }, (_, i) => String(i)) }).clipIds).toHaveLength(50);
	expect(exportRequestSchema.parse({ creatorId: "owner", clipIds: ["A", "A"] }).clipIds).toEqual(["A"]);
});
it.each(["AUTHENTICATION_REQUIRED", "PERMISSION_DENIED", "ACCOUNT_SUSPENDED"])("withholds media for %s", async (code) => {
	authorize.mockResolvedValue({ allowed: false, code });
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code, status: code === "AUTHENTICATION_REQUIRED" ? 401 : 403 });
	expect(cacheRead).not.toHaveBeenCalled();
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("requires export permission as well as creator-read permission", async () => {
	authorize.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
	expect(cacheRead).not.toHaveBeenCalled();
});
it.each([[], [ownedEntry("ClipA", { broadcaster_id: "foreign" })], [ownedEntry("Other")]].map((rows) => [rows]))("rejects a missing or foreign cache selection before provider access %#", async (rows) => {
	cacheRead.mockResolvedValue(rows);
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("reports a database failure without exposing its message", async () => {
	cacheRead.mockRejectedValue(new Error("private connection details"));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE", status: 503 });
});
it.each([null, { accessToken: "private", scope: [] }])("requires current Twitch download authorization %#", async (token) => {
	getToken.mockResolvedValue({ token });
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "RECONNECT_REQUIRED", status: 403 });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("shares export admission by creator account", async () => {
	rateLimit.mockResolvedValue({ success: false });
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "RATE_LIMITED", status: 429, retryAt: expect.any(String) });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it.each([
	[401, "RECONNECT_REQUIRED", 403],
	[403, "RECONNECT_REQUIRED", 403],
	[429, "RATE_LIMITED", 429],
	[500, "PROVIDER_UNAVAILABLE", 502],
])("maps provider %s to actionable %s", async (status, code, http) => {
	jest.mocked(globalThis.fetch).mockResolvedValue(Response.json({}, { status: Number(status), headers: { "retry-after": "30" } }));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code, status: http });
});
it("matches the requested provider ID exactly without falling back to the first record", async () => {
	jest.mocked(globalThis.fetch).mockResolvedValue(Response.json({ data: [{ clip_id: "Foreign", landscape_download_url: "https://production.assets.clips.twitchcdn.net/foreign.mp4" }] }));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE" });
	expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
it.each([{}, { landscape_download_url: null }, { portrait_download_url: null }])("handles unavailable media URLs %#", async (source) => {
	jest.mocked(globalThis.fetch).mockResolvedValue(Response.json({ data: [{ clip_id: "ClipA", ...source }] }));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE" });
});
it("records portrait fallback and does not send API credentials to media", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", portrait_download_url: "https://production.assets.clips.twitchcdn.net/portrait.mp4" }] }) : new Response(video)));
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] });
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.code);
	expect(JSON.parse(strFromU8(unzipSync(result.bytes)["manifest.json"])).clips[0].variant).toBe("portrait");
	expect(jest.mocked(globalThis.fetch).mock.calls[1][1]?.headers).toBeUndefined();
});
it("blocks a media redirect to an untrusted host", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/a.mp4" }] }) : new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } })));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE" });
	expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});
it("accepts a validated relative redirect on the official host", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/start.mp4" }] }) : String(input).endsWith("start.mp4") ? new Response(null, { status: 302, headers: { location: "/final.mp4" } }) : new Response(video)));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: true });
});
it("rejects HTML returned as a successful media response", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/a.mp4" }] }) : new Response("<html>temporary failure</html>")));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE" });
});
it("withholds a prepared package after a grant is revoked", async () => {
	let checks = 0;
	authorize.mockImplementation(async () => (++checks >= 7 ? { allowed: false, code: "PERMISSION_DENIED" } : { allowed: true, authUserId: "actor" }));
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] });
	expect(result).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
	expect(result).not.toHaveProperty("bytes");
});
it("cancels a disconnected request without preparing an archive", async () => {
	const controller = new AbortController();
	controller.abort();
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] }, controller.signal)).toMatchObject({ ok: false, code: "EXPORT_CANCELLED", status: 499 });
});
it("caps the number of media redirects", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/start.mp4" }] }) : new Response(null, { status: 302, headers: { location: "/again.mp4" } })));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false });
	expect(globalThis.fetch).toHaveBeenCalledTimes(5);
});
it("makes safe unique filenames for traversal, reserved and colliding names", () => {
	const used = new Set<string>();
	const first = clipExportFilename("../CON/a\\b", "A/B", 0, used);
	const second = clipExportFilename("../CON/a\\b", "A/B", 1, used);
	expect(first).not.toMatch(/[\\/\x00-\x1f]/);
	expect(first).not.toMatch(/^\./);
	expect(second).not.toBe(first);
	expect(clipExportFilename("CON", "A", 2, used)).toMatch(/^clip_CON/);
});
it("bounds complete responses exactly and accepts an empty body", async () => {
	await expect(readBoundedResponse(new Response(new Uint8Array([1, 2, 3])), 3)).resolves.toEqual(new Uint8Array([1, 2, 3]));
	await expect(readBoundedResponse(new Response(null), 3)).resolves.toEqual(new Uint8Array());
});

it("bounds UTF-8 filename bytes for non-Latin titles and IDs", () => {
	expect(new TextEncoder().encode(clipExportFilename("界".repeat(80), "字".repeat(80), 0, new Set())).length).toBeLessThanOrEqual(200);
});

it("identifies retryable unsuccessful positions when every download fails", async () => {
	jest.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 500 }));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "PROVIDER_UNAVAILABLE", failures: [{ index: 0, code: "provider_error", retryable: true }] });
});

it("reports a file-size denial as an export limit", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/a.mp4" }] }) : new Response(video, { headers: { "content-length": String(33 * 1024 * 1024) } })));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_LIMIT", status: 413 });
});

it("rechecks the grant after archive construction before releasing any ZIP", async () => {
	afterZip.mockImplementation(() => authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" }));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
});

test("does not overwrite a filename that already contains the collision suffix", () => {
	const used = new Set(["a--A.mp4", "a--A--1.mp4"]);
	const name = clipExportFilename("a", "A", 0, used);
	expect(name).not.toBe("a--A.mp4");
	expect(name).not.toBe("a--A--1.mp4");
	expect(used.size).toBe(3);
});

it("batches official download requests and never downloads more than two media files concurrently", async () => {
	const ids = Array.from({ length: 25 }, (_, i) => `Clip${i}`);
	cacheRead.mockResolvedValue(ids.map((id) => ownedEntry(id)));
	let active = 0,
		peak = 0;
	const batches: string[][] = [];
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => {
		const url = new URL(String(input));
		if (url.hostname === "api.twitch.tv") {
			const selected = url.searchParams.getAll("clip_id");
			batches.push(selected);
			return Response.json({ data: selected.map((clip_id) => ({ clip_id, landscape_download_url: `https://production.assets.clips.twitchcdn.net/${clip_id}.mp4` })) });
		}
		active++;
		peak = Math.max(peak, active);
		await new Promise((resolve) => setTimeout(resolve, 1));
		active--;
		return new Response(video);
	});
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ids });
	expect(result).toMatchObject({ ok: true, summary: { included: ids.map((_, index) => index), skipped: [] } });
	expect(batches.map((batch) => batch.length)).toEqual([10, 10, 5]);
	expect(peak).toBe(2);
});
it("continues with an eligible clip when another clip has been removed", async () => {
	cacheRead.mockResolvedValue([ownedEntry("A"), ownedEntry("B")]);
	jest.mocked(globalThis.fetch).mockImplementation(async (input) =>
		String(input).includes("api.twitch.tv")
			? Response.json({
					data: [
						{ clip_id: "A", landscape_download_url: "https://production.assets.clips.twitchcdn.net/A.mp4" },
						{ clip_id: "B", landscape_download_url: "https://production.assets.clips.twitchcdn.net/B.mp4" },
					],
				})
			: String(input).includes("/A.mp4")
				? new Response(null, { status: 404 })
				: new Response(video),
	);
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["A", "B"] });
	expect(result).toMatchObject({ ok: true, summary: { included: [1], skipped: [{ index: 0, code: "clip_unavailable", retryable: false }] } });
	if (!result.ok) throw new Error(result.code);
	const manifest = JSON.parse(strFromU8(unzipSync(result.bytes)["manifest.json"]));
	expect(manifest.clips.map((clip: { id: string }) => clip.id)).toEqual(["A", "B"]);
	expect(manifest.clips[0]).toMatchObject({ status: "skipped", code: "clip_unavailable" });
});
it("does not request a clip explicitly marked unavailable in cache", async () => {
	cacheRead.mockResolvedValue([{ ...ownedEntry(), value: JSON.stringify({ clip: JSON.parse(ownedEntry().value).clip, unavailable: true }) }]);
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE" });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("reports media transport failures as retryable rather than missing clips", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).includes("api.twitch.tv") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/A.mp4" }] }) : Promise.reject(new Error("network"))));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "PROVIDER_UNAVAILABLE", failures: [{ code: "provider_error", retryable: true }] });
});
it("enforces actual media bytes despite a misleading content-length", async () => {
	const large = new Uint8Array(32 * 1024 * 1024 + 1);
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).includes("api.twitch.tv") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/A.mp4" }] }) : new Response(large, { headers: { "content-length": "1" } })));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_LIMIT", failures: [{ code: "file_size_limit", retryable: false }] });
});
it("stops subsequent provider batches after a reconnect denial", async () => {
	const ids = Array.from({ length: 11 }, (_, i) => `Clip${i}`);
	cacheRead.mockResolvedValue(ids.map((id) => ownedEntry(id)));
	jest.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 401 }));
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ids });
	expect(result).toMatchObject({ ok: false, code: "RECONNECT_REQUIRED" });
	expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	if (result.ok) throw new Error("Unexpected archive");
	expect(result.failures).toHaveLength(11);
});
it("rejects a redirect with no location", async () => {
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).includes("api.twitch.tv") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/A.mp4" }] }) : new Response(null, { status: 302 })));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE" });
});
it("accepts a complete extended-size MP4 box and rejects truncated extended headers", () => {
	const extended = new Uint8Array(video.length + 8);
	extended.set(video);
	const view = new DataView(extended.buffer);
	view.setUint32(video.length, 1);
	extended.set([102, 114, 101, 101], video.length + 4);
	expect(isCompleteMp4(extended)).toBe(false);
	const valid = new Uint8Array(video.length + 16);
	valid.set(video);
	const validView = new DataView(valid.buffer);
	validView.setUint32(video.length, 1);
	valid.set([102, 114, 101, 101], video.length + 4);
	validView.setBigUint64(video.length + 8, 16n);
	expect(isCompleteMp4(valid)).toBe(true);
	validView.setBigUint64(video.length + 8, BigInt(valid.length + 1));
	expect(isCompleteMp4(valid)).toBe(false);
});
it("reports a per-file timeout with an eligible retry position", async () => {
	const timeout = jest.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => (milliseconds === 30000 ? AbortSignal.abort(new DOMException("timeout", "TimeoutError")) : new AbortController().signal));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_TIMEOUT", failures: [{ index: 0, code: "download_timeout", retryable: true }] });
	timeout.mockRestore();
});
it("enforces the overall export deadline", async () => {
	jest.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new DOMException("timeout", "TimeoutError")));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "EXPORT_TIMEOUT", status: 504 });
});
it("accepts a final size-zero MP4 box extending to end of file", () => {
	const bytes = new Uint8Array(video.length + 8);
	bytes.set(video);
	bytes.set([0, 0, 0, 0, 102, 114, 101, 101], video.length);
	expect(isCompleteMp4(bytes)).toBe(true);
});
it("includes exactly 128 MiB of complete media and skips the next clip within the 130 MiB archive cap", async () => {
	const large = new Uint8Array(32 * 1024 * 1024);
	large.set(video);
	new DataView(large.buffer).setUint32(video.length, large.length - video.length);
	large.set([102, 114, 101, 101], video.length + 4);
	expect(isCompleteMp4(large)).toBe(true);
	const ids = ["A", "B", "C", "D", "E"];
	cacheRead.mockResolvedValue(ids.map((id) => ownedEntry(id)));
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => {
		const url = new URL(String(input));
		if (url.hostname === "api.twitch.tv") return Response.json({ data: ids.map((clip_id) => ({ clip_id, landscape_download_url: `https://production.assets.clips.twitchcdn.net/${clip_id}.mp4` })) });
		return new Response(url.pathname === "/E.mp4" ? video : large);
	});
	const initial = process.memoryUsage().rss;
	const started = performance.now();
	let packaged = 0;
	afterZip.mockImplementation(() => (packaged = process.memoryUsage().rss));
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ids });
	expect(result).toMatchObject({ ok: true, summary: { included: [0, 1, 2, 3], skipped: [{ index: 4, code: "package_size_limit", retryable: false }] } });
	if (!result.ok) throw new Error(result.code);
	expect(result.bytes.length).toBeGreaterThan(128 * 1024 * 1024);
	expect(result.bytes.length).toBeLessThanOrEqual(130 * 1024 * 1024);
	console.info(JSON.stringify({ benchmark: "128MiB-export", elapsedMs: Math.round(performance.now() - started), archiveBytes: result.bytes.length, rssAtPackageBytes: packaged, rssDeltaBytes: packaged - initial }));
});

it("downloads older Twitch clips served by the verified legacy CDN", async () => {
	cacheRead.mockResolvedValue([ownedEntry()]);
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).includes("api.twitch.tv") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://d1ndex63qxojbr.cloudfront.net/clip.mp4?sig=temporary" }] }) : new Response(video)));
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] });
	expect(result).toMatchObject({ ok: true, summary: { included: [0], skipped: [] } });
	if (result.ok) expect(Object.values(unzipSync(result.bytes)).some((bytes) => Buffer.from(bytes).equals(video))).toBe(true);
});

it("returns one complete MP4 for an individual download", async () => {
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] }, undefined, "mp4");
	expect(result.ok).toBe(true);
	if (result.ok) expect(Buffer.from(result.bytes)).toEqual(video);
});

it("shares provider capacity with single downloads and sends no request after exhaustion", async () => {
	providerCapacity.mockResolvedValue({ allowed: false, retryAfterSeconds: 15 });
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] }, undefined, "mp4");
	expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED", status: 429 });
	expect(providerCapacity).toHaveBeenCalledWith("owner");
	expect(rateLimit).toHaveBeenCalledWith("owner");
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("rejects multiple IDs in an individual download before reading metadata", async () => {
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["A", "B"] }, undefined, "mp4")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(cacheRead).not.toHaveBeenCalled();
});

it("renders a custom portrait through the existing authorized single-download path", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	const progress = jest.fn();
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"], layout: defaultClipLayout }, undefined, "mp4", progress);
	expect(progress.mock.calls.map(([event]) => event.stage)).toEqual(["queued", "processing", "rendering", "ready"]);
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(isCompleteMp4(result.bytes)).toBe(true);
		expect(result.summary.included).toEqual([0]);
	}
	expect(rateLimit).toHaveBeenCalledWith("owner");
	expect(providerCapacity).toHaveBeenCalledWith("owner");
}, 30000);
it("rejects invalid custom framing before provider or rate-limit access", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"], layout: { ...defaultClipLayout, gameplay: { x: 1, y: 0, w: 1, h: 1 } } })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(rateLimit).not.toHaveBeenCalled();
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("returns an actionable render failure while preserving export recovery metadata", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	const fake = Buffer.concat(
		["ftyp", "moov", "mdat"].map((type) => {
			const b = Buffer.alloc(8);
			b.writeUInt32BE(8);
			b.write(type, 4);
			return b;
		}),
	);
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/ClipA.mp4" }] }) : new Response(fake)));
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"], layout: defaultClipLayout }, undefined, "mp4")).toMatchObject({ ok: false, failures: [{ index: 0, code: "render_failed", retryable: true }] });
});
it("renders a selected batch with each clip metadata and a portrait manifest", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	cacheRead.mockResolvedValue([ownedEntry("ClipA", { title: "First moment" }), ownedEntry("ClipB", { title: "Second moment" })]);
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: ["ClipA", "ClipB"].map((clip_id) => ({ clip_id, landscape_download_url: `https://production.assets.clips.twitchcdn.net/${clip_id}.mp4` })) }) : new Response(video)));
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA", "ClipB"], layout: { ...defaultClipLayout, textLayers: [{ field: "title", x: 5, y: 80, size: 24 }] } });
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const files = unzipSync(result.bytes);
	const manifest = JSON.parse(strFromU8(files["manifest.json"]));
	expect(manifest.clips).toEqual(expect.arrayContaining([expect.objectContaining({ id: "ClipA", title: "First moment", variant: "portrait" }), expect.objectContaining({ id: "ClipB", title: "Second moment", variant: "portrait" })]));
	const media = Object.entries(files).filter(([name]) => name.endsWith(".mp4"));
	expect(media).toHaveLength(2);
	expect(Buffer.from(media[0][1]).equals(Buffer.from(media[1][1]))).toBe(false);
}, 30000);
it("reports owned clip progress before returning the archive", async () => {
	const progress = jest.fn();
	const result = await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] }, undefined, "zip", progress);
	expect(result.ok).toBe(true);
	expect(progress.mock.calls.map(([event]) => event.stage)).toEqual(["queued", "processing", "ready"]);
	expect(progress).toHaveBeenCalledWith(expect.objectContaining({ index: 0, title: "My clip", stage: "queued" }));
	expect(JSON.stringify(progress.mock.calls)).not.toContain("private-token");
});

it("rejects exhausted account clip volume before contacting Twitch", async () => {
	const volume = jest.requireMock("@/server/clip-download-limit").reserveClipExportVolume;
	volume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });
	expect(await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] })).toMatchObject({ ok: false, code: "RATE_LIMITED", status: 429 });
	expect(volume).toHaveBeenLastCalledWith("owner", 1);
	expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("packages Original, Desktop and two Mobile versions as four distinct complete files with one quota reservation", async () => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	const { createClipComposition } = await import("@lib/clipComposition");
	const plan = createClipExportPlan(
		"owner",
		["ClipA"],
		[
			{ key: "original", label: "Original" },
			{ key: "desktop", label: "Desktop main", layout: createClipComposition("desktop") },
			{ key: "mobile1", label: "Mobile camera", layout: createClipComposition("mobile") },
			{ key: "mobile2", label: "Mobile second", layout: createClipComposition("mobile") },
		],
	)[0];
	const volume = jest.requireMock("@/server/clip-download-limit").reserveClipExportVolume;
	volume.mockClear();
	const progress = jest.fn();
	const result = await buildClipExportPlan(plan, undefined, "zip", progress);
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.code);
	const files = unzipSync(result.bytes),
		manifest = JSON.parse(strFromU8(files["manifest.json"]));
	expect(Object.keys(files).filter((name) => name.endsWith(".mp4"))).toHaveLength(4);
	expect(manifest.clips.map((clip: any) => clip.outputKey)).toEqual(["original", "desktop", "mobile1", "mobile2"]);
	expect(files[manifest.clips[0].filename]).toEqual(new Uint8Array(video));
	expect(rateLimit).toHaveBeenCalledTimes(1);
	expect(volume).toHaveBeenCalledTimes(1);
	expect(volume).toHaveBeenCalledWith("owner", 4);
	expect(result.summary.included).toEqual([0, 1, 2, 3]);
	expect(progress.mock.calls.some((call) => call[0].index === 3 && call[0].stage === "ready")).toBe(true);
}, 30000);
it("records the clip and version for every skipped output in a partial package", async () => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	const plan = createClipExportPlan(
		"owner",
		["ClipA"],
		[
			{ key: "first", label: "Original one" },
			{ key: "second", label: "Original two" },
		],
	)[0];
	let media = 0;
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => (String(input).startsWith("https://api.twitch.tv/") ? Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/ClipA.mp4" }] }) : ++media === 1 ? new Response(video) : new Response(null, { status: 404 })));
	const result = await buildClipExportPlan(plan);
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const manifest = JSON.parse(strFromU8(unzipSync(result.bytes)["manifest.json"]));
	expect(manifest.clips).toEqual(expect.arrayContaining([expect.objectContaining({ id: "ClipA", outputKey: "second", outputLabel: "Original two", status: "skipped", code: "clip_unavailable" })]));
});
it("rejects malformed plans and foreign clips before reserving download quota", async () => {
	expect(await buildClipExportPlan({ creatorId: "owner", outputs: [], files: [] })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	cacheRead.mockResolvedValue([ownedEntry("ClipA", { broadcaster_id: "foreign" })]);
	expect(await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "original", label: "Original" }])[0])).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(rateLimit).not.toHaveBeenCalled();
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("rechecks creator access before releasing a multi-version package", async () => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	let downloaded = false;
	authorize.mockImplementation(async () => (downloaded ? { allowed: false, code: "PERMISSION_DENIED" } : { allowed: true }));
	jest.mocked(globalThis.fetch).mockImplementation(async (input) => {
		if (String(input).startsWith("https://api.twitch.tv/")) return Response.json({ data: [{ clip_id: "ClipA", landscape_download_url: "https://production.assets.clips.twitchcdn.net/ClipA.mp4" }] });
		downloaded = true;
		return new Response(video);
	});
	expect(await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "original", label: "Original" }])[0])).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
});
it("never substitutes a Twitch portrait variant for configured Original output", async () => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	jest.mocked(globalThis.fetch).mockResolvedValue(Response.json({ data: [{ clip_id: "ClipA", portrait_download_url: "https://production.assets.clips.twitchcdn.net/ClipA.mp4" }] }));
	expect(await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "original", label: "Original" }])[0])).toMatchObject({ ok: false, code: "EXPORT_UNAVAILABLE", failures: [{ index: 0, code: "download_unavailable" }] });
	expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

it("applies the saved clip/template override while keeping global layouts unchanged", async () => {
	const { createClipComposition } = await import("@lib/clipComposition"),
		{ createClipExportPlan } = await import("@lib/clipExportPlan");
	const composition = createClipComposition("desktop"),
		override = { ...composition, layers: [...composition.layers, { id: "title", kind: "title" as const, label: "Clip title", fontSize: 64, frame: { x: 0, y: 0, w: 1, h: 0.2 } }] };
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "desktop", name: "Desktop", composition }], defaults: {} });
	cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([{ contentKey: "clip-layout-override:v2:desktop:ClipA", state: JSON.stringify({ composition: override }) }]);
	render.mockResolvedValueOnce(new Uint8Array(video));
	const result = await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "desktop", label: "Desktop", templateId: "desktop", layout: composition }])[0]);
	expect(result.ok).toBe(true);
	expect(render).toHaveBeenCalledWith(expect.any(Uint8Array), override, expect.objectContaining({ id: "ClipA" }), expect.any(AbortSignal), expect.any(Object));
	expect(composition.layers).toHaveLength(1);
});
it("rejects deleted templates or conflicting output orientation before reserving quota", async () => {
	const { createClipComposition } = await import("@lib/clipComposition"),
		{ createClipExportPlan } = await import("@lib/clipExportPlan");
	const composition = createClipComposition("desktop");
	const packet = createClipExportPlan("owner", ["ClipA"], [{ key: "desktop", label: "Desktop", templateId: "desktop", layout: composition }])[0];
	expect(await buildClipExportPlan(packet)).toMatchObject({ ok: false, code: "LAYOUT_UNAVAILABLE" });
	expect(rateLimit).not.toHaveBeenCalled();
	packet.outputs[0].format = "mobile";
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "desktop", name: "Desktop", composition }], defaults: {} });
	expect(await buildClipExportPlan(packet)).toMatchObject({ ok: false, code: "LAYOUT_UNAVAILABLE" });
	expect(rateLimit).not.toHaveBeenCalled();
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("refuses an incompatible saved override rather than exporting the wrong orientation", async () => {
	const { createClipComposition } = await import("@lib/clipComposition"),
		{ createClipExportPlan } = await import("@lib/clipExportPlan");
	const composition = createClipComposition("desktop");
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "desktop", name: "Desktop", composition }], defaults: {} });
	cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([{ contentKey: "clip-layout-override:v2:desktop:ClipA:desktop", state: JSON.stringify({ composition: createClipComposition("mobile") }) }]);
	expect(await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "desktop", label: "Desktop", templateId: "desktop", layout: composition }])[0])).toMatchObject({ ok: false, code: "LAYOUT_UNAVAILABLE" });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});

async function originalPlan() {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	return createClipExportPlan("owner", ["ClipA"], [{ key: "original", label: "Original" }])[0];
}
it.each(["AUTHENTICATION_REQUIRED", "PERMISSION_DENIED"])("rejects planned exports with %s before provider access", async (code) => {
	authorize.mockResolvedValue({ allowed: false, code });
	expect(await buildClipExportPlan(await originalPlan())).toMatchObject({ ok: false, code, status: code === "AUTHENTICATION_REQUIRED" ? 401 : 403 });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("returns a single planned Original as untouched MP4 and rejects multi-file MP4 transport", async () => {
	const plan = await originalPlan();
	const result = await buildClipExportPlan(plan, undefined, "mp4");
	expect(result).toMatchObject({ ok: true, bytes: new Uint8Array(video), filename: expect.stringMatching(/\.mp4$/) });
	plan.files.push({ clipId: "ClipB", outputKey: "original" });
	expect(await buildClipExportPlan(plan, undefined, "mp4")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
});
it.each(["job", "volume", "token"])("rejects planned exports when %s access is unavailable", async (kind) => {
	if (kind === "job") rateLimit.mockResolvedValue({ success: false });
	if (kind === "volume") jest.requireMock("@/server/clip-download-limit").reserveClipExportVolume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 5 });
	if (kind === "token") getToken.mockResolvedValue({ token: null });
	expect(await buildClipExportPlan(await originalPlan())).toMatchObject({ ok: false, code: kind === "token" ? "RECONNECT_REQUIRED" : "RATE_LIMITED" });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it.each([401, 403, 429, 500, 404])("returns actionable per-version provider failure for HTTP %s", async (status) => {
	jest.mocked(globalThis.fetch).mockImplementation(async () => new Response(null, { status, headers: { "retry-after": "5" } }));
	const result = await buildClipExportPlan(await originalPlan());
	expect(result.ok).toBe(false);
	if (result.ok) throw Error("unexpected success");
	expect(result.failures).toHaveLength(1);
	expect(result.failures![0].index).toBe(0);
});
it("uses authoritative template contents when no composition snapshot was supplied", async () => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan"),
		{ createClipComposition } = await import("@lib/clipComposition");
	const composition = createClipComposition("desktop");
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "desk", composition }], defaults: {} });
	cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([]);
	render.mockResolvedValueOnce(new Uint8Array(video));
	expect(await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "desk", label: "Desktop", templateId: "desk" }])[0])).toMatchObject({ ok: true });
	expect(render).toHaveBeenCalledWith(expect.anything(), composition, expect.anything(), expect.anything(), expect.anything());
});
it("reports failed template reads and corrupt saved overrides without downloading", async () => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan"),
		{ createClipComposition } = await import("@lib/clipComposition");
	const composition = createClipComposition("desktop"),
		plan = createClipExportPlan("owner", ["ClipA"], [{ key: "desk", label: "Desktop", templateId: "desk", layout: composition }])[0];
	layouts.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	expect(await buildClipExportPlan(plan)).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "desk", composition }], defaults: {} });
	cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([{ contentKey: "clip-layout-override:v2:desk:ClipA", state: "bad json" }]);
	expect(await buildClipExportPlan(plan)).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
	expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("honors cancellation, cache failure and final ZIP access revocation for planned exports", async () => {
	const plan = await originalPlan(),
		abort = new AbortController();
	abort.abort();
	expect(await buildClipExportPlan(plan, abort.signal)).toMatchObject({ ok: false, code: "EXPORT_CANCELLED" });
	cacheRead.mockRejectedValueOnce(Error("offline"));
	expect(await buildClipExportPlan(plan)).toMatchObject({ ok: false, code: "SERVICE_UNAVAILABLE" });
	afterZip.mockImplementation(() => authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" }));
	expect(await buildClipExportPlan(plan)).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
});
it.each(["media", "manifest", "archive"] as const)("enforces the planned package %s cap before release", async (cap) => {
	const { EXPORT_LIMITS } = await import("@/server/clip-export");
	const limits = EXPORT_LIMITS as Record<string, number>,
		saved = limits[cap];
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	const plan = createClipExportPlan(
		"owner",
		["ClipA"],
		[
			{ key: "a", label: "First" },
			{ key: "b", label: "Second" },
		],
	)[0];
	try {
		if (cap === "media") limits[cap] = video.length;
		else {
			const fetchImpl = jest.mocked(globalThis.fetch).getMockImplementation()!;
			jest.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
				const response = await fetchImpl(input, init);
				if (!String(input).startsWith("https://api.twitch.tv/")) limits[cap] = 1;
				return response;
			});
		}
		const result = await buildClipExportPlan(plan);
		if (cap === "media") {
			expect(result).toMatchObject({ ok: true, summary: { included: [0], skipped: [{ index: 1, code: "package_size_limit", retryable: false }] } });
		} else expect(result).toMatchObject({ ok: false, code: "EXPORT_LIMIT", status: 413 });
	} finally {
		limits[cap] = saved;
	}
});
it.each(["token", "cache", "missing"])("records a planned output failure after %s disappears mid-export", async (kind) => {
	if (kind === "token") getToken.mockResolvedValueOnce({ token: { accessToken: "private-token", scope: ["channel:manage:clips"] } }).mockResolvedValue({ token: null });
	if (kind === "cache") cacheRead.mockResolvedValueOnce([ownedEntry()]).mockRejectedValueOnce(Error("offline"));
	if (kind === "missing") cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([]);
	const result = await buildClipExportPlan(await originalPlan());
	expect(result).toMatchObject({ ok: false, failures: [{ index: 0, code: kind === "token" ? "reconnect_required" : kind === "cache" ? "provider_error" : "clip_unavailable", retryable: kind === "cache" }] });
});
it("exports both formats from the same named template with independent format overrides", async () => {
	const { createClipComposition } = await import("@lib/clipComposition"),
		{ createClipExportPlan } = await import("@lib/clipExportPlan");
	const desktop = createClipComposition("desktop"),
		mobile = createClipComposition("mobile");
	const desktopOverride = { ...desktop, layers: desktop.layers.map((layer) => ({ ...layer, label: "Desktop override" })) },
		mobileOverride = { ...mobile, layers: mobile.layers.map((layer) => ({ ...layer, label: "Mobile override" })) };
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "pair", name: "Stream", composition: mobile, compositions: { desktop, mobile } }], defaults: {} });
	cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([
		{ contentKey: "clip-layout-override:v2:pair:ClipA:desktop", state: JSON.stringify({ composition: desktopOverride }) },
		{ contentKey: "clip-layout-override:v2:pair:ClipA:mobile", state: JSON.stringify({ composition: mobileOverride }) },
	]);
	render.mockResolvedValue(new Uint8Array(video));
	const plan = createClipExportPlan(
		"owner",
		["ClipA"],
		[
			{ key: "desktop", label: "Desktop", templateId: "pair", format: "desktop" },
			{ key: "mobile", label: "Mobile", templateId: "pair", format: "mobile" },
		],
	)[0];
	const result = await buildClipExportPlan(plan);
	expect(result.ok).toBe(true);
	expect(render.mock.calls.map((call) => call[1])).toEqual([desktopOverride, mobileOverride]);
	expect(desktop.layers[0].label).toBe("Gameplay");
	expect(mobile.layers[0].label).toBe("Camera");
});
it("does not apply a historical Mobile override to the Desktop composition of its collection", async () => {
	const { createClipComposition } = await import("@lib/clipComposition"),
		{ createClipExportPlan } = await import("@lib/clipExportPlan");
	const desktop = createClipComposition("desktop"),
		mobile = createClipComposition("mobile");
	layouts.mockResolvedValue({ ok: true, templates: [{ id: "pair", name: "Stream", composition: mobile, compositions: { desktop, mobile } }], defaults: {} });
	cacheRead.mockResolvedValueOnce([ownedEntry()]).mockResolvedValueOnce([{ contentKey: "clip-layout-override:v2:pair:ClipA", state: JSON.stringify({ composition: mobile }) }]);
	render.mockResolvedValueOnce(new Uint8Array(video));
	expect(await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "desktop", label: "Desktop", templateId: "pair", format: "desktop" }])[0])).toMatchObject({ ok: true });
	expect(render.mock.calls[0][1]).toEqual(desktop);
});
it("retains legacy untemplated portrait export plans", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout"),
		{ createClipExportPlan } = await import("@lib/clipExportPlan");
	render.mockResolvedValueOnce(new Uint8Array(video));
	const result = await buildClipExportPlan(createClipExportPlan("owner", ["ClipA"], [{ key: "legacy", label: "Legacy portrait", layout: defaultClipLayout }])[0]);
	expect(result.ok).toBe(true);
	if (!result.ok) throw Error(result.code);
	expect(JSON.parse(strFromU8(unzipSync(result.bytes)["manifest.json"])).clips[0]).toMatchObject({ outputLabel: "Legacy portrait", format: "mobile" });
});

it("enforces free composed-export branding on the server and honors Pro removal", async () => {
	const { createClipComposition } = await import("@lib/clipComposition");
	const layout = { ...createClipComposition("mobile"), watermark: false };
	render.mockResolvedValue(new Uint8Array(video));
	exportBrand.mockResolvedValue({ brand: { watermark: false, themeTextColor: "#fff", themeBackgroundColor: "#000", themeAccentColor: "#fff", borderSize: 0, borderRadius: 10, fontFamily: "DejaVu Sans", fontSource: "builtin" }, revision: 1 });
	exportEntitlements.mockResolvedValue({ proAccess: false });
	expect((await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"], layout }, undefined, "mp4")).ok).toBe(true);
	expect(render.mock.calls.at(-1)?.[4]).toMatchObject({ watermark: true, brand: { watermark: false } });
	exportEntitlements.mockResolvedValue({ proAccess: true });
	expect((await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"], layout }, undefined, "mp4")).ok).toBe(true);
	expect(render.mock.calls.at(-1)?.[4]).toMatchObject({ watermark: false });
	expect((await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"], layout: { ...layout, watermark: true } }, undefined, "mp4")).ok).toBe(true);
	expect(render.mock.calls.at(-1)?.[4]).toMatchObject({ watermark: true });
	render.mockClear();
	expect((await buildClipArchive({ creatorId: "owner", clipIds: ["ClipA"] }, undefined, "mp4")).ok).toBe(true);
	expect(render).not.toHaveBeenCalled();
});
it("prepares authorized browser outputs with scoped source access without rendering or downloading video", async () => {
	const { prepareBrowserClipExport } = await import("@/server/clip-export");
	const { readBrowserClipSource } = await import("@/server/clip-browser-source");
	const { createClipComposition } = await import("@lib/clipComposition");
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	cacheRead.mockResolvedValue([ownedEntry()]);
	const layout = { ...createClipComposition("desktop"), watermark: false };
	const plan = createClipExportPlan(
		"owner",
		["ClipA"],
		[
			{ key: "original", label: "Original" },
			{ key: "desktop", label: "Desktop", layout },
		],
	)[0];
	const result = await prepareBrowserClipExport(plan, AbortSignal.timeout(5000));
	expect(result.ok).toBe(true);
	if (result.ok) {
		expect(result.clips).toHaveLength(1);
		expect(readBrowserClipSource(result.clips[0].sourceToken)).toEqual({ creatorId: "owner", clipId: "ClipA" });
		expect(result.clips[0].outputs.map((o: any) => o.key)).toEqual(["original", "desktop"]);
	}
	expect(render).not.toHaveBeenCalled();
	expect(jest.requireMock("@/server/clip-download-limit").reserveClipExportVolume).toHaveBeenCalledWith("owner", 2);
});
it("rechecks browser source permission and blocks replayed transfers when the shared budget is exhausted", async () => {
	const { downloadBrowserClipSource } = await import("@/server/clip-export");
	const { signBrowserClipSource } = await import("@/server/clip-browser-source");
	const transfer = jest.requireMock("@/server/clip-download-limit").reserveClipSourceTransfer;
	cacheRead.mockResolvedValue([ownedEntry()]);
	transfer.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
	const ticket = signBrowserClipSource("owner", "ClipA");
	const result = await downloadBrowserClipSource(ticket, AbortSignal.timeout(5000));
	expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED", status: 429 });
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	await expect(downloadBrowserClipSource(ticket, AbortSignal.timeout(5000))).resolves.toMatchObject({ ok: false, code: "PERMISSION_DENIED", status: 403 });
	await expect(downloadBrowserClipSource("forged", AbortSignal.timeout(5000))).resolves.toMatchObject({ ok: false, code: "PERMISSION_DENIED", status: 403 });
});
