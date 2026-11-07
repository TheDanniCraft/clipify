import type { BrowserArchiveSink } from "./clipBrowserArchive";
import { zipSync, strToU8 } from "fflate";
import { browserExportSchema, browserClipMetadataSchema, type BrowserExport } from "./clipBrowserExport";
import type { ClipExportPlan } from "./clipExportPlan";
import { readBoundedResponse, clipExportFilename, clipExportFailureCode, isRetryableClipExportFailure, type ClipExportSummary } from "./clipExport";
import type { ClipExportProgress } from "./clipExportStream";
import { renderBrowserClip } from "./clipBrowserRender";
async function readBrowserSource(clip: BrowserExport["clips"][number], signal: AbortSignal) {
	if (clip.error) return { ok: true as const, code: clip.error };
	try {
		const raw = await fetch(`/api/clips/export/browser/source?ticket=${encodeURIComponent(clip.sourceToken)}`, { signal });
		if (raw.ok) return { ok: true as const, bytes: await readBoundedResponse(raw, 32 * 1024 * 1024, signal) };
		const error = JSON.parse(new TextDecoder().decode(await readBoundedResponse(raw, 8192, signal)));
		if (["PERMISSION_DENIED", "AUTHENTICATION_REQUIRED", "ACCOUNT_SUSPENDED", "ENTITLEMENT_REQUIRED"].includes(error.code)) return { ok: false as const, code: String(error.code) };
		const reason = error.failures?.[0]?.code;
		const code = ["clip_unavailable", "download_unavailable", "file_size_limit", "invalid_media", "download_timeout"].includes(reason) ? String(reason) : error.code === "RATE_LIMITED" ? "rate_limited" : error.code === "RECONNECT_REQUIRED" ? "reconnect_required" : "provider_error";
		return { ok: true as const, code, retryAt: typeof error.retryAt === "string" ? error.retryAt : undefined };
	} catch (error) {
		signal.throwIfAborted();
		return { ok: true as const, code: error instanceof Error && error.message === "byte_limit" ? "file_size_limit" : "provider_error" };
	}
}
type BrowserBatchResult = { ok: true; bytes: Uint8Array<ArrayBuffer>; summary: ClipExportSummary; partCount: number } | { ok: false; code: string; retryAt?: string; failures?: ClipExportSummary["skipped"] };
export async function buildBrowserBatch(plan: ClipExportPlan, signal: AbortSignal, progress: (event: ClipExportProgress) => void, onPart: ((bytes: Uint8Array<ArrayBuffer>, part: number) => void) | undefined, format: "zip" | "mp4" = "zip", sink?: BrowserArchiveSink): Promise<BrowserBatchResult> {
	if ((!sink && !onPart && format === "zip") || (format === "mp4" && plan.files.length !== 1)) return { ok: false, code: "INVALID_INPUT" };
	const response = await fetch("/api/clips/export/browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan), signal });
	const data = JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 8 * 1024 * 1024, signal)));
	if (!response.ok) return { ok: false as const, code: typeof data.code === "string" ? data.code : "SERVICE_UNAVAILABLE", retryAt: data.retryAt as string | undefined };
	const prepared = browserExportSchema.parse(data),
		files: Record<string, Uint8Array> = {},
		manifest: Record<string, unknown>[] = [],
		used = new Set<string>();
	const summary: ClipExportSummary = { included: [], skipped: [] };
	let total = 0,
		partCount = 1;
	const packageBytes = () => {
		files["manifest.json"] = strToU8(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), clips: manifest }));
		return zipSync(files, { level: 0 });
	};
	const flush = () => {
		onPart?.(packageBytes(), partCount++);
		for (const key of Object.keys(files)) delete files[key];
		manifest.length = 0;
		total = 0;
	};
	for (const clip of prepared.clips) {
		signal.throwIfAborted();
		const metadata = browserClipMetadataSchema.parse(clip);
		const firstIndex = plan.files.findIndex((file) => file.clipId === clip.id);
		progress({ index: firstIndex, stage: "processing" });
		const source = await readBrowserSource(clip, signal);
		if (!source.ok) return source;
		if (source.retryAt) summary.retryAt = source.retryAt;
		for (const output of clip.outputs) {
			const index = plan.files.findIndex((file) => file.clipId === clip.id && file.outputKey === output.key);
			let code = source.code;
			if (source.bytes && !code)
				try {
					if (output.layout || output.preset) progress({ index, stage: "rendering" });
					const bytes = output.layout || output.preset ? await renderBrowserClip(source.bytes, output, signal, () => {}) : source.bytes;
					if (!sink && total && total + bytes.length > 126 * 1024 * 1024) flush();
					let filename = clipExportFilename(`${clip.title} ${output.label}`, `${clip.id}-${output.key}`, index, used);
					if (sink) filename = await sink.add(filename, bytes);
					else files[filename] = bytes;
					total += bytes.length;
					summary.included.push(index);
					manifest.push({ ...metadata, status: "included", filename, bytes: bytes.length, format: output.layout?.format ?? "original", outputLabel: output.label, outputKey: output.key });
					progress({ index, stage: "ready" });
					if (format === "mp4") return { ok: true, bytes, summary, partCount: 1 };
				} catch (error) {
					signal.throwIfAborted();
					if (sink && error instanceof Error && error.message === "browser_storage_error") throw error;
					code = error instanceof Error && ["file_size_limit", "package_size_limit", "preset_size_limit"].includes(error.message) ? error.message : "browser_unsupported";
				}
			if (code) {
				summary.skipped.push({ index, code: code as ClipExportSummary["skipped"][number]["code"], retryable: isRetryableClipExportFailure(code), title: `${clip.title} / ${output.label}` });
				manifest.push({ ...metadata, status: "skipped", code, retryable: isRetryableClipExportFailure(code), outputKey: output.key, outputLabel: output.label });
				progress({ index, stage: "skipped", code });
			}
		}
	}
	if (sink) await sink.manifest(manifest);
	if (!summary.included.length) return { ok: false as const, code: clipExportFailureCode(summary.skipped), failures: summary.skipped, retryAt: summary.retryAt };
	return { ok: true as const, bytes: sink ? new Uint8Array(0) : packageBytes(), summary, partCount };
}
