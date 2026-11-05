import "server-only";
import { clipLayoutSchema } from "@lib/clipLayout";
import { renderClipLayout } from "./clip-layout-render";
import { z } from "zod";
import { readBoundedResponse } from "@lib/clipExport";
export { readBoundedResponse } from "@lib/clipExport";
import { zipSync, strToU8 } from "fflate";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { twitchCacheTable } from "@/db/schema";
import { TwitchCacheType } from "@types";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { getAccessTokenResultInternal } from "@/server/tokens";
import { reserveClipDownloadJob, reserveTwitchClipDownloadRequest } from "./clip-download-limit";
import { providerClipSchema } from "./resources/clip-validation";
import { publicClip } from "./resources/clip-discovery";

export const exportRequestSchema = z.object({
	creatorId: z.string().min(1).max(200),
	layout: clipLayoutSchema.optional(),
	clipIds: z
		.array(z.string().min(1).max(200))
		.max(1000)
		.transform((ids) => [...new Set(ids)])
		.pipe(z.array(z.string()).min(1).max(50)),
});

// Older Twitch clips use this exact CloudFront distribution; other tenants remain blocked.
export function isTrustedClipMediaUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && ["production.assets.clips.twitchcdn.net", "d1ndex63qxojbr.cloudfront.net"].includes(url.hostname) && !url.username && !url.password && !url.port;
	} catch {
		return false;
	}
}

export function isCompleteMp4(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const kinds = new Set<string>();
	let offset = 0;
	while (offset < bytes.length) {
		if (offset + 8 > bytes.length) return false;
		let size = view.getUint32(offset);
		const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		let header = 8;
		if (size === 1) {
			if (offset + 16 > bytes.length) return false;
			const large = view.getBigUint64(offset + 8);
			if (large > BigInt(bytes.length)) return false;
			size = Number(large);
			header = 16;
		}
		if (size === 0) size = bytes.length - offset;
		if (size < header || offset + size > bytes.length || (offset === 0 && kind !== "ftyp")) return false;
		kinds.add(kind);
		offset += size;
	}
	return kinds.has("ftyp") && kinds.has("moov") && kinds.has("mdat");
}

export const EXPORT_LIMITS = { file: 32 * 1024 * 1024, media: 128 * 1024 * 1024, manifest: 1024 * 1024, archive: 130 * 1024 * 1024 } as const;
export type ExportSummary = { included: number[]; skipped: { index: number; code: string; retryable: boolean; title?: string }[]; retryAt?: string };
type ArchiveResult = { ok: true; bytes: Uint8Array; summary: ExportSummary; filename?: string } | { ok: false; code: string; status: number; retryAt?: string; failures?: ExportSummary["skipped"] };
const failure = (code: string, status: number, retryAt?: string): Extract<ArchiveResult, { ok: false }> => ({ ok: false, code, status, ...(retryAt ? { retryAt } : {}) });

async function downloadMedia(url: string, signal: AbortSignal) {
	for (let redirects = 0; redirects <= 3; redirects++) {
		if (!isTrustedClipMediaUrl(url)) throw new Error("download_unavailable");
		const response = await fetch(url, { signal, redirect: "manual" });
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			await response.body?.cancel();
			if (!location || redirects === 3) throw new Error("download_unavailable");
			url = new URL(location, url).href;
			continue;
		}
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(response.status === 404 ? "clip_unavailable" : "provider_error");
		}
		if (Number(response.headers.get("content-length")) > EXPORT_LIMITS.file) {
			await response.body?.cancel();
			throw new Error("file_size_limit");
		}
		let bytes: Uint8Array;
		try {
			bytes = await readBoundedResponse(response, EXPORT_LIMITS.file, signal);
		} catch (error) {
			if (error instanceof Error && error.message === "byte_limit") throw new Error("file_size_limit");
			throw error;
		}
		if (!isCompleteMp4(bytes)) throw new Error("invalid_media");
		return bytes;
	}
	throw new Error("download_unavailable");
}

export function clipExportFilename(title: string, id: string, index: number, used: Set<string>) {
	const clean = (value: string) => {
		const characters = Array.from(
			value
				.normalize("NFKC")
				.replace(/[^\p{L}\p{N} _-]/gu, "_")
				.trim(),
		).slice(0, 80);
		while (strToU8(characters.join("")).length > 80) characters.pop();
		return characters.join("") || "clip";
	};
	let base = clean(title);
	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[ ._]|$)/i.test(base)) base = `clip_${base}`;
	const stem = `${base}--${clean(id)}`;
	let filename = `${stem}.mp4`;
	let suffix = index + 1;
	while (used.has(filename)) filename = `${stem}--${suffix++}.mp4`;
	used.add(filename);
	return filename;
}

export async function buildClipArchive(input: unknown, parentSignal?: AbortSignal, format: "zip" | "mp4" = "zip"): Promise<ArchiveResult> {
	const parsed = exportRequestSchema.safeParse(input);
	if (!parsed.success) return failure("INVALID_INPUT", 400);
	const { creatorId, clipIds } = parsed.data;
	if (format === "mp4" && clipIds.length !== 1) return failure("INVALID_INPUT", 400);
	const authorize = async () => {
		const read = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
		return read.allowed ? authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "clips:export" }) : read;
	};
	const grant = await authorize();
	if (!grant.allowed) return failure(grant.code, grant.code === "AUTHENTICATION_REQUIRED" ? 401 : 403);
	const signal = AbortSignal.any([...(parentSignal ? [parentSignal] : []), AbortSignal.timeout(120000)]);
	try {
		const keys = clipIds.map((id) => `clip:${creatorId}:${id}`);
		const rows = await db
			.select({ key: twitchCacheTable.key, value: twitchCacheTable.value })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), inArray(twitchCacheTable.key, keys), or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, new Date()))))
			.execute();
		const clips = clipIds.map((id) => {
			const row = rows.find((entry) => entry.key === `clip:${creatorId}:${id}`);
			if (!row) return null;
			const stored = JSON.parse(row.value);
			const clip = providerClipSchema.safeParse(stored.clip ?? stored);
			return clip.success && clip.data.id === id && clip.data.broadcaster_id === creatorId ? { clip: clip.data, unavailable: stored.unavailable === true } : null;
		});
		if (clips.some((clip) => !clip)) return failure("INVALID_INPUT", 400);
		const limit = await reserveClipDownloadJob(creatorId);
		if (!limit.allowed) return failure("RATE_LIMITED", 429, new Date(Date.now() + limit.retryAfterSeconds * 1000).toISOString());
		const tokenResult = await getAccessTokenResultInternal(creatorId);
		const token = tokenResult.token;
		if (!token || !token.scope?.some((scope) => scope === "channel:manage:clips" || scope === "editor:manage:clips")) return failure("RECONNECT_REQUIRED", 403);
		const summary: ExportSummary = { included: [], skipped: [] };
		const sources = new Map<number, { url: string; variant: "landscape" | "portrait" }>();
		const skip = (index: number, code: string) => {
			if (!summary.skipped.some((item) => item.index === index)) {
				const title = Array.from(clips[index]!.clip.title).slice(0, 80);
				while (strToU8(title.join("")).length > 80) title.pop();
				summary.skipped.push({ index, code, retryable: ["provider_error", "download_timeout", "rate_limited", "render_busy", "render_failed"].includes(code), title: title.join("") });
			}
		};
		let blocked: string | undefined;
		const providerSchema = z.object({ data: z.array(z.object({ clip_id: z.string(), landscape_download_url: z.string().nullable().optional(), portrait_download_url: z.string().nullable().optional() })).max(10) });
		for (let offset = 0; offset < clipIds.length; offset += 10) {
			const permission = await authorize();
			if (!permission.allowed) return failure(permission.code, 403);
			const indices = clipIds
				.slice(offset, offset + 10)
				.map((_, position) => offset + position)
				.filter((index) => {
					if (clips[index]!.unavailable) {
						skip(index, "clip_unavailable");
						return false;
					}
					return true;
				});
			if (!indices.length) continue;
			if (blocked) {
				indices.forEach((index) => skip(index, blocked!));
				continue;
			}
			const capacity = await reserveTwitchClipDownloadRequest(creatorId);
			if (!capacity.allowed) {
				blocked = "rate_limited";
				summary.retryAt = new Date(Date.now() + capacity.retryAfterSeconds * 1000).toISOString();
				indices.forEach((index) => skip(index, blocked!));
				continue;
			}
			const url = new URL("https://api.twitch.tv/helix/clips/downloads");
			url.searchParams.set("broadcaster_id", creatorId);
			url.searchParams.set("editor_id", creatorId);
			indices.forEach((index) => url.searchParams.append("clip_id", clipIds[index]));
			try {
				const response = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal, redirect: "error" });
				if (response.status === 401 || response.status === 403) blocked = "reconnect_required";
				if (response.status === 429) {
					blocked = "rate_limited";
					const after = response.headers.get("retry-after");
					const reset = Number(response.headers.get("ratelimit-reset"));
					const numeric = Number(after);
					const parsedDate = after ? Date.parse(after) : NaN;
					summary.retryAt = new Date(reset > 0 ? reset * 1000 : Number.isFinite(numeric) && numeric > 0 ? Date.now() + numeric * 1000 : Number.isFinite(parsedDate) ? parsedDate : Date.now() + 60000).toISOString();
				}
				if (blocked) {
					await response.body?.cancel();
					indices.forEach((index) => skip(index, blocked!));
					continue;
				}
				if (!response.ok) {
					await response.body?.cancel();
					indices.forEach((index) => skip(index, "provider_error"));
					continue;
				}
				const payload = providerSchema.parse(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, EXPORT_LIMITS.manifest, signal))));
				for (const index of indices) {
					const matching = payload.data.filter((item) => item.clip_id === clipIds[index]);
					if (matching.length !== 1) {
						skip(index, "download_unavailable");
						continue;
					}
					const item = matching[0];
					const mediaUrl = parsed.data.layout ? item.landscape_download_url : item.landscape_download_url || item.portrait_download_url;
					if (!mediaUrl) {
						skip(index, "download_unavailable");
						continue;
					}
					sources.set(index, { url: mediaUrl, variant: item.landscape_download_url ? "landscape" : "portrait" });
				}
			} catch {
				signal.throwIfAborted();
				indices.forEach((index) => skip(index, "provider_error"));
			}
		}
		const files: Record<string, Uint8Array> = {};
		const manifest: Record<string, unknown>[] = [];
		const used = new Set<string>();
		let totalBytes = 0;
		const indices = [...sources.keys()];
		for (let offset = 0; offset < indices.length; offset += 2) {
			signal.throwIfAborted();
			const permission = await authorize();
			if (!permission.allowed) return failure(permission.code, 403);
			const pair = indices.slice(offset, offset + 2);
			const results = await Promise.all(
				pair.map(async (index) => {
					const fileSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
					try {
						let bytes = await downloadMedia(sources.get(index)!.url, fileSignal);
						if (parsed.data.layout) bytes = await renderClipLayout(bytes, parsed.data.layout, publicClip(clips[index]!.clip), signal);
						return { index, bytes };
					} catch (error) {
						return { index, code: fileSignal.aborted ? "download_timeout" : error instanceof Error && ["clip_unavailable", "download_unavailable", "file_size_limit", "invalid_media", "render_busy", "render_failed"].includes(error.message) ? error.message : "provider_error" };
					}
				}),
			);
			for (const result of results) {
				if (!result.bytes) {
					skip(result.index, result.code!);
					continue;
				}
				if (totalBytes + result.bytes.length > EXPORT_LIMITS.media) {
					skip(result.index, "package_size_limit");
					continue;
				}
				const clip = clips[result.index]!.clip;
				const filename = clipExportFilename(clip.title, clip.id, result.index, used);
				files[filename] = result.bytes;
				totalBytes += result.bytes.length;
				summary.included.push(result.index);
				manifest.push({ ...publicClip(clip), status: "included", filename, bytes: result.bytes.length, variant: parsed.data.layout ? "portrait" : sources.get(result.index)!.variant });
			}
		}
		signal.throwIfAborted();
		const permission = await authorize();
		if (!permission.allowed) return failure(permission.code, 403);
		summary.skipped.sort((a, b) => a.index - b.index);
		if (!summary.included.length) {
			const limited = summary.skipped.some((item) => item.code === "file_size_limit" || item.code === "package_size_limit");
			const code = limited ? "EXPORT_LIMIT" : summary.skipped.some((item) => item.code === "reconnect_required") ? "RECONNECT_REQUIRED" : summary.skipped.some((item) => item.code === "rate_limited") ? "RATE_LIMITED" : summary.skipped.some((item) => item.code === "provider_error") ? "PROVIDER_UNAVAILABLE" : summary.skipped.some((item) => item.code === "download_timeout") ? "EXPORT_TIMEOUT" : "EXPORT_UNAVAILABLE";
			return { ...failure(code, code === "EXPORT_LIMIT" ? 413 : code === "RECONNECT_REQUIRED" ? 403 : code === "RATE_LIMITED" ? 429 : code === "PROVIDER_UNAVAILABLE" ? 502 : code === "EXPORT_TIMEOUT" ? 504 : 409, summary.retryAt), failures: summary.skipped };
		}
		if (format === "mp4") {
			const finalGrant = await authorize();
			if (!finalGrant.allowed) return failure(finalGrant.code, 403);
			const filename = String(manifest[0].filename);
			return { ok: true, bytes: files[filename], filename, summary };
		}
		for (const skipped of summary.skipped) manifest.push({ ...publicClip(clips[skipped.index]!.clip), status: "skipped", code: skipped.code, retryable: skipped.retryable });
		manifest.sort((a, b) => clipIds.indexOf(String(a.id)) - clipIds.indexOf(String(b.id)));
		const manifestBytes = strToU8(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), clips: manifest }));
		if (manifestBytes.length > EXPORT_LIMITS.manifest) return failure("EXPORT_LIMIT", 413);
		files["manifest.json"] = manifestBytes;
		const bytes = zipSync(files, { level: 0 });
		if (bytes.length > EXPORT_LIMITS.archive) return failure("EXPORT_LIMIT", 413);
		const finalGrant = await authorize();
		if (!finalGrant.allowed) return failure(finalGrant.code, 403);
		return { ok: true, bytes, summary };
	} catch {
		return failure(parentSignal?.aborted ? "EXPORT_CANCELLED" : signal.aborted ? "EXPORT_TIMEOUT" : "SERVICE_UNAVAILABLE", parentSignal?.aborted ? 499 : signal.aborted ? 504 : 503);
	}
}
