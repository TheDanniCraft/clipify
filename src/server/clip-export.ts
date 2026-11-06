import "server-only";
import sharp from "sharp";
import { compositionAssets } from "./clip-composition-render";
import { clipifyWatermarkSvg } from "@lib/overlayMetadata";
import { signBrowserClipSource, readBrowserClipSource } from "./clip-browser-source";
import { browserExportSchema, type BrowserOutput } from "@lib/clipBrowserExport";
import { readCreatorBrand } from "./creator-brand";
import { resolveUserEntitlements } from "@lib/entitlements";
import type { ClipExportProgress } from "@lib/clipExportStream";
import { clipLayoutSchema, type ClipLayout } from "@lib/clipLayout";
import { compositionSchema, convertLegacyClipLayout, type ClipComposition } from "@lib/clipComposition";
import { templateCompositions } from "@lib/clipLayoutTemplate";
import { clipExportPlanSchema } from "@lib/clipExportPlan";
import { listClipLayouts } from "@actions/clipLayoutLibrary";
import { renderClipLayout } from "./clip-layout-render";
import { z } from "zod";
import { readBoundedResponse, clipExportFilename, clipExportFailureCode, isRetryableClipExportFailure } from "@lib/clipExport";
export { readBoundedResponse } from "@lib/clipExport";
import { zipSync, strToU8 } from "fflate";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { twitchCacheTable, userContentStatesTable } from "@/db/schema";
import { TwitchCacheType } from "@types";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { getAccessTokenResultInternal } from "@/server/tokens";
import { reserveClipDownloadJob, reserveTwitchClipDownloadRequest, reserveClipExportVolume, reserveClipSourceTransfer } from "./clip-download-limit";
import { providerClipSchema } from "./resources/clip-validation";
import { publicClip } from "./resources/clip-discovery";

export const exportRequestSchema = z.object({
	creatorId: z.string().min(1).max(200),
	layout: z.union([clipLayoutSchema, compositionSchema]).optional(),
	clipIds: z
		.array(z.string().min(1).max(200))
		.max(1000)
		.transform((ids) => [...new Set(ids)])
		.pipe(z.array(z.string()).min(1).max(50)),
});

export { isTrustedClipMediaUrl } from "@lib/clipExport";
import { isTrustedClipMediaUrl } from "@lib/clipExport";

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

export { clipExportFilename } from "@lib/clipExport";

async function readOwnedExportClips(creatorId: string, clipIds: string[]) {
	const keys = clipIds.map((id) => `clip:${creatorId}:${id}`);
	const rows = await db
		.select({ key: twitchCacheTable.key, value: twitchCacheTable.value })
		.from(twitchCacheTable)
		.where(and(eq(twitchCacheTable.type, TwitchCacheType.Clip), inArray(twitchCacheTable.key, keys), or(isNull(twitchCacheTable.expiresAt), gt(twitchCacheTable.expiresAt, new Date()))))
		.execute();
	return clipIds.map((id) => {
		const row = rows.find((entry) => entry.key === `clip:${creatorId}:${id}`);
		if (!row) return null;
		const stored = JSON.parse(row.value);
		const clip = providerClipSchema.safeParse(stored.clip ?? stored);
		return clip.success && clip.data.id === id && clip.data.broadcaster_id === creatorId ? { clip: clip.data, unavailable: stored.unavailable === true } : null;
	});
}
export async function buildClipArchive(input: unknown, parentSignal?: AbortSignal, format: "zip" | "mp4" = "zip", progress?: (event: ClipExportProgress) => void): Promise<ArchiveResult> {
	return prepareClipArchive(input, parentSignal, format, progress);
}
async function prepareClipExportAccess(creatorId: string, count: number, reserved = false) {
	const job = reserved ? { allowed: true as const } : await reserveClipDownloadJob(creatorId);
	if (!job.allowed) return failure("RATE_LIMITED", 429, new Date(Date.now() + job.retryAfterSeconds * 1000).toISOString());
	const token = (await getAccessTokenResultInternal(creatorId)).token;
	if (!token || !token.scope?.some((scope) => scope === "channel:manage:clips" || scope === "editor:manage:clips")) return failure("RECONNECT_REQUIRED", 403);
	const volume = reserved ? { allowed: true as const } : await reserveClipExportVolume(creatorId, count);
	if (!volume.allowed) return failure("RATE_LIMITED", 429, new Date(Date.now() + volume.retryAfterSeconds * 1000).toISOString());
	return { ok: true as const, token };
}

function exportAbortResult(signal: AbortSignal, parentSignal?: AbortSignal) {
	if (parentSignal?.aborted) return failure("EXPORT_CANCELLED", 499);
	return signal.aborted ? failure("EXPORT_TIMEOUT", 504) : failure("SERVICE_UNAVAILABLE", 503);
}
function plannedFailureCode(result: Extract<ArchiveResult, { ok: false }>) {
	return result.failures?.[0]?.code ?? { RATE_LIMITED: "rate_limited", RECONNECT_REQUIRED: "reconnect_required", EXPORT_TIMEOUT: "download_timeout", INVALID_INPUT: "clip_unavailable" }[result.code] ?? "provider_error";
}
async function authorizeClipExport(creatorId: string) {
	const read = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	return read.allowed ? authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "clips:export" }) : read;
}
type ExportClips = Awaited<ReturnType<typeof readOwnedExportClips>>;
type ExportSource = { url: string; variant: "landscape" | "portrait" };
function exportRetryAt(response: Response) {
	const after = response.headers.get("retry-after");
	const reset = Number(response.headers.get("ratelimit-reset"));
	const numeric = Number(after);
	const parsedDate = after ? Date.parse(after) : NaN;
	return new Date(reset > 0 ? reset * 1000 : Number.isFinite(numeric) && numeric > 0 ? Date.now() + numeric * 1000 : Number.isFinite(parsedDate) ? parsedDate : Date.now() + 60000).toISOString();
}
function recordExportSources(indices: number[], clipIds: string[], data: { clip_id: string; landscape_download_url?: string | null; portrait_download_url?: string | null }[], landscapeOnly: boolean, sources: Map<number, ExportSource>, skip: (index: number, code: string) => void) {
	for (const index of indices) {
		const matching = data.filter((item) => item.clip_id === clipIds[index]);
		if (matching.length !== 1) {
			skip(index, "download_unavailable");
			continue;
		}
		const item = matching[0];
		const mediaUrl = landscapeOnly ? item.landscape_download_url : item.landscape_download_url || item.portrait_download_url;
		if (!mediaUrl) {
			skip(index, "download_unavailable");
			continue;
		}
		sources.set(index, { url: mediaUrl, variant: item.landscape_download_url ? "landscape" : "portrait" });
	}
}
async function resolveExportSources(creatorId: string, clipIds: string[], clips: ExportClips, token: { accessToken: string }, signal: AbortSignal, landscapeOnly: boolean, summary: ExportSummary, sources: Map<number, ExportSource>, skip: (index: number, code: string) => void) {
	const authorize = () => authorizeClipExport(creatorId);
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
				summary.retryAt = exportRetryAt(response);
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
			recordExportSources(indices, clipIds, payload.data, landscapeOnly, sources, skip);
		} catch {
			signal.throwIfAborted();
			indices.forEach((index) => skip(index, "provider_error"));
		}
	}
	return null;
}
async function downloadExportClip(index: number, url: string, creatorId: string, clip: NonNullable<ExportClips[number]>["clip"], layout: ClipLayout | ClipComposition | undefined, permission: Extract<Awaited<ReturnType<typeof authorizeClipExport>>, { allowed: true }>, signal: AbortSignal, progress?: (event: ClipExportProgress) => void) {
	const fileSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
	try {
		progress?.({ index, stage: "processing" });
		const transfer = await reserveClipSourceTransfer(creatorId);
		if (!transfer.allowed) return { index, code: "rate_limited", retryAt: new Date(Date.now() + Math.max(1, transfer.retryAfterSeconds ?? 1) * 1000).toISOString() };
		let bytes = await downloadMedia(url, fileSignal);
		if (layout) {
			progress?.({ index, stage: "rendering" });
			const [{ brand }, entitlement] = await Promise.all([readCreatorBrand(creatorId), resolveUserEntitlements(permission.creator)]);
			bytes = await renderClipLayout(bytes, layout, publicClip(clip), signal, { avatar: permission.creator?.avatar, brand: brand ?? undefined, watermark: !entitlement.proAccess || (layout.version === 2 ? (layout.watermark ?? true) : true) });
		}
		return { index, bytes };
	} catch (error) {
		return { index, code: fileSignal.aborted ? "download_timeout" : error instanceof Error && ["clip_unavailable", "download_unavailable", "file_size_limit", "invalid_media", "render_busy", "render_failed", "font_unavailable"].includes(error.message) ? error.message : "provider_error" };
	}
}
function emptyArchiveResult(summary: ExportSummary) {
	const code = clipExportFailureCode(summary.skipped);
	return { ...failure(code, code === "EXPORT_LIMIT" ? 413 : code === "RECONNECT_REQUIRED" ? 403 : code === "RATE_LIMITED" ? 429 : code === "PROVIDER_UNAVAILABLE" ? 502 : code === "EXPORT_TIMEOUT" ? 504 : 409, summary.retryAt), failures: summary.skipped };
}
async function finishClipArchive(creatorId: string, clipIds: string[], clips: ExportClips, files: Record<string, Uint8Array>, manifest: Record<string, unknown>[], summary: ExportSummary, format: "zip" | "mp4", signal: AbortSignal): Promise<ArchiveResult> {
	const authorize = () => authorizeClipExport(creatorId);
	signal.throwIfAborted();
	const permission = await authorize();
	if (!permission.allowed) return failure(permission.code, 403);
	summary.skipped.sort((a, b) => a.index - b.index);
	if (!summary.included.length) return emptyArchiveResult(summary);
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
}
function appendArchiveResults(results: Awaited<ReturnType<typeof downloadExportClip>>[], clips: ExportClips, sources: Map<number, ExportSource>, layout: ClipLayout | ClipComposition | undefined, files: Record<string, Uint8Array>, manifest: Record<string, unknown>[], used: Set<string>, summary: ExportSummary, totalBytes: number, skip: (index: number, code: string) => void, progress?: (event: ClipExportProgress) => void) {
	for (const result of results) {
		if (!result.bytes) {
			if (result.retryAt && (!summary.retryAt || result.retryAt > summary.retryAt)) summary.retryAt = result.retryAt;
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
		progress?.({ index: result.index, stage: "ready" });
		manifest.push({ ...publicClip(clip), status: "included", filename, bytes: result.bytes.length, variant: layout ? "portrait" : sources.get(result.index)!.variant });
	}
	return totalBytes;
}
function createArchiveSkip(clips: ExportClips, summary: ExportSummary, progress?: (event: ClipExportProgress) => void) {
	return (index: number, code: string) => {
		if (!summary.skipped.some((item) => item.index === index)) {
			const title = Array.from(clips[index]!.clip.title).slice(0, 80);
			while (strToU8(title.join("")).length > 80) title.pop();
			progress?.({ index, stage: "skipped", code });
			summary.skipped.push({ index, code, retryable: isRetryableClipExportFailure(code), title: title.join("") });
		}
	};
}
async function prepareClipArchive(input: unknown, parentSignal?: AbortSignal, format: "zip" | "mp4" = "zip", progress?: (event: ClipExportProgress) => void, reserved = false, landscapeOnly = false): Promise<ArchiveResult> {
	const parsed = exportRequestSchema.safeParse(input);
	if (!parsed.success) return failure("INVALID_INPUT", 400);
	const { creatorId, clipIds } = parsed.data;
	if (format === "mp4" && clipIds.length !== 1) return failure("INVALID_INPUT", 400);
	const authorize = () => authorizeClipExport(creatorId);
	const grant = await authorize();
	if (!grant.allowed) return failure(grant.code, grant.code === "AUTHENTICATION_REQUIRED" ? 401 : 403);
	const signal = AbortSignal.any([...(parentSignal ? [parentSignal] : []), AbortSignal.timeout(120000)]);
	try {
		const clips = await readOwnedExportClips(creatorId, clipIds);
		if (clips.some((clip) => !clip)) return failure("INVALID_INPUT", 400);
		const access = await prepareClipExportAccess(creatorId, clipIds.length, reserved);
		if (!access.ok) return access;
		const { token } = access;
		clips.forEach((item, index) => progress?.({ index, stage: "queued", title: item!.clip.title.slice(0, 1000) }));
		const summary: ExportSummary = { included: [], skipped: [] };
		const sources = new Map<number, { url: string; variant: "landscape" | "portrait" }>();
		const skip = createArchiveSkip(clips, summary, progress);
		const sourceFailure = await resolveExportSources(creatorId, clipIds, clips, token, signal, Boolean(parsed.data.layout || landscapeOnly), summary, sources, skip);
		if (sourceFailure) return sourceFailure;
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
			const results = await Promise.all(pair.map((index) => downloadExportClip(index, sources.get(index)!.url, creatorId, clips[index]!.clip, parsed.data.layout, permission, signal, progress)));
			totalBytes = appendArchiveResults(results, clips, sources, parsed.data.layout, files, manifest, used, summary, totalBytes, skip, progress);
		}
		return await finishClipArchive(creatorId, clipIds, clips, files, manifest, summary, format, signal);
	} catch {
		return exportAbortResult(signal, parentSignal);
	}
}

async function resolveExportLayouts(plan: z.infer<typeof clipExportPlanSchema>, creatorId: string) {
	const outputLayouts = new Map(plan.outputs.map((output) => [output.key, output.layout]));
	const outputFormat = (key: string) => {
		const layout = outputLayouts.get(key);
		return layout?.version === 2 ? layout.format : undefined;
	};
	const templated = plan.outputs.filter((output) => output.templateId);
	const overrides = new Map<string, ReturnType<typeof compositionSchema.parse>>();
	if (templated.length) {
		const library = await listClipLayouts(creatorId);
		if (!library.ok) return { error: failure(library.code, 503) };
		for (const output of templated) {
			const entry = library.templates.find((entry) => entry.id === output.templateId);
			if (!entry) return { error: failure("LAYOUT_UNAVAILABLE", 409) };
			const format = output.format ?? (output.layout?.version === 2 ? output.layout.format : entry.composition.format);
			if (output.layout && (output.layout.version !== 2 || output.layout.format !== format)) return { error: failure("LAYOUT_UNAVAILABLE", 409) };
			outputLayouts.set(output.key, output.layout ?? templateCompositions(entry)[format]);
		}
		const keys = plan.files.flatMap((file) => {
			const output = templated.find((output) => output.key === file.outputKey);
			return output ? [`clip-layout-override:v2:${output.templateId}:${file.clipId}`, `clip-layout-override:v2:${output.templateId}:${file.clipId}:${outputFormat(output.key)}`] : [];
		});
		if (keys.length) {
			const rows = await db
				.select({ contentKey: userContentStatesTable.contentKey, state: userContentStatesTable.state })
				.from(userContentStatesTable)
				.where(and(eq(userContentStatesTable.userId, creatorId), inArray(userContentStatesTable.contentKey, keys)))
				.execute();
			for (const row of rows) {
				const composition = compositionSchema.parse(JSON.parse(row.state).composition);
				overrides.set(row.contentKey, composition);
			}
		}
	}
	return { outputLayouts, overrides };
}
function plannedOverride(templateId: string | undefined, clipId: string, base: ClipLayout | ClipComposition | undefined, overrides: Map<string, ClipComposition>) {
	if (!templateId) return undefined;
	const format = base?.version === 2 ? base.format : undefined;
	const legacy = overrides.get(`clip-layout-override:v2:${templateId}:${clipId}`);
	return overrides.get(`clip-layout-override:v2:${templateId}:${clipId}:${format}`) ?? (legacy?.format === format ? legacy : undefined);
}
function plannedOutputFormat(layout: ClipLayout | ClipComposition | undefined, legacy: boolean) {
	return layout?.version === 2 ? layout.format : legacy ? "mobile" : "original";
}
async function renderPlannedExport(plan: z.infer<typeof clipExportPlanSchema>, file: z.infer<typeof clipExportPlanSchema>["files"][number], index: number, outputLayouts: Map<string, ClipLayout | ClipComposition | undefined>, overrides: Map<string, ClipComposition>, signal: AbortSignal, title: (index: number) => string, progress?: (event: ClipExportProgress) => void) {
	const creatorId = plan.creatorId;

	const output = plan.outputs.find((output) => output.key === file.outputKey)!;
	const base = outputLayouts.get(output.key);
	const override = plannedOverride(output.templateId, file.clipId, base, overrides);
	if (override && (!base || base.version !== 2 || override.format !== base.format)) return { index, result: failure("LAYOUT_UNAVAILABLE", 409), output };
	const layout = override ?? base;
	const result = await prepareClipArchive({ creatorId, clipIds: [file.clipId], ...(layout ? { layout } : {}) }, signal, "mp4", (event) => progress?.({ ...event, index, title: title(index) }), true, true);
	return { index, result, output };
}
type ExportPackage = { files: Record<string, Uint8Array>; manifest: Record<string, unknown>[]; used: Set<string>; summary: ExportSummary; total: number };
function appendPlanResults(results: Awaited<ReturnType<typeof renderPlannedExport>>[], plan: z.infer<typeof clipExportPlanSchema>, known: Map<string, NonNullable<ExportClips[number]>["clip"]>, outputLayouts: Map<string, ClipLayout | ClipComposition | undefined>, state: ExportPackage, title: (index: number) => string, progress?: (event: ClipExportProgress) => void) {
	const skip = (index: number, code: string, retryable: boolean) => {
		state.summary.skipped.push({ index, code, retryable, title: title(index).slice(0, 80) });
		progress?.({ index, stage: "skipped", code });
	};
	for (const { index, result, output } of results) {
		if (!result.ok) {
			if (["AUTHENTICATION_REQUIRED", "PERMISSION_DENIED", "ACCOUNT_SUSPENDED", "ENTITLEMENT_REQUIRED", "LAYOUT_UNAVAILABLE"].includes(result.code)) return result;
			const item = result.failures?.[0],
				code = plannedFailureCode(result);
			skip(index, code, item?.retryable ?? isRetryableClipExportFailure(code));
			if (result.retryAt && (!state.summary.retryAt || result.retryAt > state.summary.retryAt)) state.summary.retryAt = result.retryAt;
			continue;
		}
		if (state.total + result.bytes.length > EXPORT_LIMITS.media) {
			skip(index, "package_size_limit", false);
			continue;
		}
		const clip = known.get(plan.files[index].clipId)!,
			filename = clipExportFilename(`${clip.title} ${output.label}`, `${clip.id}-${output.key}`, index, state.used);
		state.files[filename] = result.bytes;
		state.total += result.bytes.length;
		state.summary.included.push(index);
		state.manifest.push({ ...publicClip(clip), status: "included", filename, bytes: result.bytes.length, outputKey: output.key, outputLabel: output.label, format: plannedOutputFormat(outputLayouts.get(output.key), Boolean(output.layout)) });
		progress?.({ index, stage: "ready", title: title(index) });
	}
	return null;
}
async function finishExportPlan(plan: z.infer<typeof clipExportPlanSchema>, known: Map<string, NonNullable<ExportClips[number]>["clip"]>, files: Record<string, Uint8Array>, manifest: Record<string, unknown>[], summary: ExportSummary, format: "zip" | "mp4", signal: AbortSignal): Promise<ArchiveResult> {
	const authorize = () => authorizeClipExport(plan.creatorId);
	signal.throwIfAborted();
	const permission = await authorize();
	if (!permission.allowed) return failure(permission.code, 403);
	summary.skipped.sort((a, b) => a.index - b.index);
	if (!summary.included.length) {
		const code = summary.skipped.some((item) => item.code === "package_size_limit" || item.code === "file_size_limit") ? "EXPORT_LIMIT" : summary.skipped.some((item) => item.code === "reconnect_required") ? "RECONNECT_REQUIRED" : summary.skipped.some((item) => item.code === "rate_limited") ? "RATE_LIMITED" : "EXPORT_UNAVAILABLE";
		return { ...failure(code, code === "RATE_LIMITED" ? 429 : 422, summary.retryAt), failures: summary.skipped };
	}
	if (format === "mp4") return { ok: true, bytes: files[String(manifest[0].filename)], filename: String(manifest[0].filename), summary };
	for (const item of summary.skipped) {
		const file = plan.files[item.index],
			output = plan.outputs.find((output) => output.key === file.outputKey)!;
		manifest.push({ ...publicClip(known.get(file.clipId)!), status: "skipped", outputKey: output.key, outputLabel: output.label, code: item.code, retryable: item.retryable });
	}
	const data = strToU8(JSON.stringify({ version: 2, createdAt: new Date().toISOString(), clips: manifest, skipped: summary.skipped }, null, 2));
	if (data.length > EXPORT_LIMITS.manifest) return failure("EXPORT_LIMIT", 413);
	files["manifest.json"] = data;
	const bytes = zipSync(files, { level: 0 });
	if (bytes.length > EXPORT_LIMITS.archive) return failure("EXPORT_LIMIT", 413);
	const finalGrant = await authorize();
	if (!finalGrant.allowed) return failure(finalGrant.code, 403);
	return { ok: true, bytes, summary };
}
export async function buildClipExportPlan(input: unknown, parentSignal?: AbortSignal, format: "zip" | "mp4" = "zip", progress?: (event: ClipExportProgress) => void): Promise<ArchiveResult> {
	const parsed = clipExportPlanSchema.safeParse(input);
	if (!parsed.success || (format === "mp4" && parsed.data.files.length !== 1)) return failure("INVALID_INPUT", 400);
	const plan = parsed.data,
		{ creatorId } = plan;
	const authorize = () => authorizeClipExport(creatorId);
	const grant = await authorize();
	if (!grant.allowed) return failure(grant.code, grant.code === "AUTHENTICATION_REQUIRED" ? 401 : 403);
	const signal = AbortSignal.any([...(parentSignal ? [parentSignal] : []), AbortSignal.timeout(120000)]);
	try {
		const ids = [...new Set(plan.files.map((file) => file.clipId))],
			clips = await readOwnedExportClips(creatorId, ids);
		if (clips.some((clip) => !clip)) return failure("INVALID_INPUT", 400);
		const known = new Map(ids.map((id, index) => [id, clips[index]!.clip]));
		const resolved = await resolveExportLayouts(plan, creatorId);
		if (resolved.error) return resolved.error;
		const { outputLayouts, overrides } = resolved;
		const access = await prepareClipExportAccess(creatorId, plan.files.length);
		if (!access.ok) return access;
		const summary: ExportSummary = { included: [], skipped: [] },
			files: Record<string, Uint8Array> = {},
			manifest: Record<string, unknown>[] = [],
			used = new Set<string>();
		const state: ExportPackage = { files, manifest, used, summary, total: 0 };
		const title = (index: number) => {
			const file = plan.files[index],
				output = plan.outputs.find((output) => output.key === file.outputKey)!;
			return `${known.get(file.clipId)!.title} / ${output.label}`.slice(0, 1000);
		};
		plan.files.forEach((_, index) => progress?.({ index, stage: "queued", title: title(index) }));

		for (let offset = 0; offset < plan.files.length; offset += 2) {
			signal.throwIfAborted();
			const results = await Promise.all(plan.files.slice(offset, offset + 2).map((file, position) => renderPlannedExport(plan, file, offset + position, outputLayouts, overrides, signal, title, progress)));
			const appendFailure = appendPlanResults(results, plan, known, outputLayouts, state, title, progress);
			if (appendFailure) return appendFailure;
		}
		return await finishExportPlan(plan, known, files, manifest, summary, format, signal);
	} catch {
		return exportAbortResult(signal, parentSignal);
	}
}
export async function prepareBrowserClipExport(input: unknown, signal: AbortSignal) {
	const parsed = clipExportPlanSchema.safeParse(input);
	if (!parsed.success) return failure("INVALID_INPUT", 400);
	const plan = parsed.data,
		creatorId = plan.creatorId;
	const grant = await authorizeClipExport(creatorId);
	if (!grant.allowed) return failure(grant.code, 403);
	const ids = [...new Set(plan.files.map((file) => file.clipId))];
	const owned = await readOwnedExportClips(creatorId, ids);
	if (owned.some((clip) => !clip)) return failure("INVALID_INPUT", 400);
	const resolved = await resolveExportLayouts(plan, creatorId);
	if (resolved.error) return resolved.error;
	const access = await prepareClipExportAccess(creatorId, plan.files.length);
	if (!access.ok) return access;
	const [{ brand }, entitlement] = await Promise.all([readCreatorBrand(creatorId), resolveUserEntitlements(grant.creator)]);
	const mark = await sharp(Buffer.from(clipifyWatermarkSvg())).png().toBuffer();
	const clips = [];
	let imageBytes = 0;
	for (const [index, id] of ids.entries()) {
		signal.throwIfAborted();
		const clip = publicClip(owned[index]!.clip);
		const unavailable = owned[index]!.unavailable;
		const outputs: BrowserOutput[] = [];
		for (const file of plan.files.filter((file) => file.clipId === id)) {
			const output = plan.outputs.find((output) => output.key === file.outputKey)!;
			if (unavailable) {
				outputs.push({ key: output.key, label: output.label, layout: null, assets: {}, watermark: null });
				continue;
			}
			const base = resolved.outputLayouts.get(output.key);
			const raw = plannedOverride(output.templateId, id, base, resolved.overrides) ?? base;
			const layout = raw ? (raw.version === 2 ? raw : convertLegacyClipLayout(raw)) : null;
			const assets = layout ? await compositionAssets(layout, clip, signal, grant.creator?.avatar, brand ?? undefined) : {};
			const watermark = layout && (!entitlement.proAccess || (layout.watermark ?? true));
			// Reserve space for public metadata/layouts before encoding repeated PNG payloads.
			imageBytes += [...Object.values(assets), ...(watermark ? [mark] : [])].reduce((sum, bytes) => sum + Math.ceil(bytes.length / 3) * 4 + 32, 0);
			if (imageBytes > 6 * 1024 * 1024) return failure("EXPORT_LIMIT", 413);
			outputs.push({ key: output.key, label: output.label, layout, assets: Object.fromEntries(Object.entries(assets).map(([key, value]) => [key, `data:image/png;base64,${value.toString("base64")}`])), watermark: watermark ? `data:image/png;base64,${mark.toString("base64")}` : null });
		}
		clips.push({ ...clip, sourceToken: unavailable ? "" : signBrowserClipSource(creatorId, id), error: unavailable ? ("clip_unavailable" as const) : undefined, outputs });
	}
	const final = await authorizeClipExport(creatorId);
	if (!final.allowed) return failure(final.code, 403);
	const result = browserExportSchema.parse({ ok: true, clips });
	if (Buffer.byteLength(JSON.stringify(result)) > 8 * 1024 * 1024) return failure("EXPORT_LIMIT", 413);
	return result;
}
export async function downloadBrowserClipSource(ticket: string, signal: AbortSignal) {
	const claims = readBrowserClipSource(ticket);
	if (!claims) return failure("PERMISSION_DENIED", 403);
	return prepareClipArchive({ creatorId: claims.creatorId, clipIds: [claims.clipId] }, signal, "mp4", undefined, true, true);
}
