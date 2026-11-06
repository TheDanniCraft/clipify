import { zipSync, strToU8 } from "fflate";
import { browserExportSchema } from "./clipBrowserExport";
import type { ClipExportPlan } from "./clipExportPlan";
import { readBoundedResponse, clipExportFilename, type ClipExportSummary } from "./clipExport";
import type { ClipExportProgress } from "./clipExportStream";
import { renderBrowserClip } from "./clipBrowserRender";
export async function buildBrowserBatch(plan: ClipExportPlan, signal: AbortSignal, progress: (event: ClipExportProgress) => void) {
	const response = await fetch("/api/clips/export/browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan), signal });
	const data = JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 8 * 1024 * 1024, signal)));
	if (!response.ok) return { ok: false as const, code: typeof data.code === "string" ? data.code : "SERVICE_UNAVAILABLE", retryAt: data.retryAt as string | undefined };
	const prepared = browserExportSchema.parse(data),
		files: Record<string, Uint8Array> = {},
		manifest: Record<string, unknown>[] = [],
		used = new Set<string>();
	const summary: ClipExportSummary = { included: [], skipped: [] };
	let total = 0;
	for (const clip of prepared.clips) {
		signal.throwIfAborted();
		let source: Uint8Array | undefined, sourceCode: string | undefined;
		const firstIndex = plan.files.findIndex((file) => file.clipId === clip.id);
		progress({ index: firstIndex, stage: "processing" });
		try {
			const raw = await fetch(`/api/clips/export/browser/source?ticket=${encodeURIComponent(clip.sourceToken)}`, { signal });
			if (!raw.ok) {
				const error = await raw.json();
				return { ok: false as const, code: typeof error.code === "string" ? error.code : "PROVIDER_UNAVAILABLE", retryAt: error.retryAt as string | undefined };
			}
			source = await readBoundedResponse(raw, 32 * 1024 * 1024, signal);
		} catch (error) {
			signal.throwIfAborted();
			sourceCode = error instanceof Error && error.message === "byte_limit" ? "file_size_limit" : "provider_error";
		}
		for (const output of clip.outputs) {
			const index = plan.files.findIndex((file) => file.clipId === clip.id && file.outputKey === output.key);
			let code = sourceCode;
			if (source && !code)
				try {
					if (output.layout) progress({ index, stage: "rendering" });
					const bytes = output.layout ? await renderBrowserClip(source, output, signal, () => {}) : source;
					if (total + bytes.length > 128 * 1024 * 1024) throw new Error("package_size_limit");
					const filename = clipExportFilename(clip.title, `${clip.id}-${output.key}`, index, used);
					files[filename] = bytes;
					total += bytes.length;
					summary.included.push(index);
					manifest.push({ id: clip.id, title: clip.title, status: "included", filename, format: output.layout?.format ?? "original", outputLabel: output.label, outputKey: output.key });
					progress({ index, stage: "ready" });
				} catch (error) {
					signal.throwIfAborted();
					code = error instanceof Error && ["file_size_limit", "package_size_limit"].includes(error.message) ? error.message : "browser_unsupported";
				}
			if (code) {
				summary.skipped.push({ index, code: code as ClipExportSummary["skipped"][number]["code"], retryable: !["file_size_limit", "package_size_limit"].includes(code), title: `${clip.title} / ${output.label}` });
				manifest.push({ id: clip.id, title: clip.title, status: "skipped", code, outputLabel: output.label });
				progress({ index, stage: "skipped", code });
			}
		}
	}
	if (!summary.included.length) return { ok: false as const, code: summary.skipped.some((item) => item.code === "browser_unsupported") ? "BROWSER_UNSUPPORTED" : "EXPORT_UNAVAILABLE", failures: summary.skipped };
	files["manifest.json"] = strToU8(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), clips: manifest }));
	return { ok: true as const, bytes: zipSync(files, { level: 0 }), summary };
}
