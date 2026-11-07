"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Disclosure, Link, Modal, Spinner, ProgressBar, toast } from "@heroui/react";
import { IconCheck, IconClock, IconDeviceDesktop, IconDeviceMobile, IconDownload, IconRefresh, IconVideo, IconX } from "@tabler/icons-react";
import ConfirmModal from "@components/confirmModal";
import ControlledModal from "@components/controlledModal";
import LocalizedDate from "@components/localizedDate";
import { notify } from "@lib/toast";
import { buildBrowserArchive, cleanupBrowserExports, exportArchiveName } from "@lib/clipBrowserArchive";
import { buildBrowserBatch } from "@lib/clipBrowserBatch";
import type { ExportEngine } from "@lib/clipBrowserExport";
import { clipExportPlanSchema, createClipExportPlan, type ClipExportPlan } from "@lib/clipExportPlan";
import type { ClipLayout } from "@lib/clipLayout";
import { clipExportFilename, type ClipExportSummary } from "@lib/clipExport";
import { readClipExportResponse, type ClipExportProgress } from "@lib/clipExportStream";
const messages: Record<string, string> = {
	BROWSER_PROCESSING_REQUIRED: "Use a supported browser to process videos on this device.",
	PRESET_SIZE_LIMIT: "This video could not fit the chosen size. Open export settings and choose a larger target.",
	BROWSER_UNSUPPORTED: "Video export is unavailable on this device. Try a supported browser or another device.",
	RECONNECT_REQUIRED: "Reconnect Twitch to download clips, then retry here.",
	RATE_LIMITED: "The download limit was reached. Wait before trying again.",
	INVALID_INPUT: "Refresh your clips and select them again.",
	EXPORT_UNAVAILABLE: "No selected clips could be downloaded. Refresh the library and try a different selection.",
	EXPORT_LIMIT: "This package is too large. Select fewer or shorter clips.",
	PROVIDER_UNAVAILABLE: "Twitch could not prepare these clips. Please try again.",
	EXPORT_TIMEOUT: "The export took too long. Try fewer clips.",
	PERMISSION_DENIED: "You no longer have permission to export these clips.",
	AUTHENTICATION_REQUIRED: "Sign in again before exporting clips.",
	ACCOUNT_SUSPENDED: "This creator account is suspended. Contact support before exporting clips.",
	ENTITLEMENT_REQUIRED: "This team access needs an active Pro plan. Ask the creator to review their plan.",
	SERVICE_UNAVAILABLE: "The export could not be prepared. Please try again.",
	browser_storage_unavailable: "This browser cannot save export ZIPs. Allow site storage or use a supported browser.",
	browser_storage_full: "There is not enough browser storage for this export. Free space and retry.",
	browser_storage_error: "The ZIP could not be saved. Check available storage and retry.",
	invalid_response: "The download response was incomplete. Please try again.",
	LAYOUT_UNAVAILABLE: "A selected layout is no longer available. Open export settings and choose another layout.",
};
const reasons: Record<string, string> = {
	preset_size_limit: "This video could not fit the chosen size. Choose a larger target in export settings.",
	browser_unsupported: "Video encoding is unavailable in this browser. Try another supported browser or device.",
	clip_unavailable: "Clip unavailable",
	download_unavailable: "Download unavailable",
	file_size_limit: "Clip exceeds 32 MiB",
	package_size_limit: "Package exceeds 128 MiB",
	invalid_media: "Twitch returned an incomplete video",
	provider_error: "Twitch download failed",
	render_busy: "Video rendering is busy. Retry shortly.",
	render_failed: "Rendering failed. Your layout is kept.",
	font_unavailable: "Your brand font could not be loaded. Retry or choose another font in Brand styling.",
	download_timeout: "Download timed out",
	rate_limited: "Twitch download limit reached",
	reconnect_required: "Reconnect Twitch",
};

export type ExportRequest = { creatorId: string; clipIds: string[]; scope: string; format: "zip" | "mp4"; layout?: ClipLayout; clipNames?: Record<string, string>; plan?: ClipExportPlan; plans?: ClipExportPlan[]; engine?: ExportEngine };
type Batch = { startedAt: string; id: number; group: string; request: ExportRequest; status: "queued" | "waiting" | "processing" | "completed" | "failed" | "cancelled"; clips: (ClipExportProgress & { outputLabel?: string; outputFormat?: "original" | "desktop" | "mobile" })[]; summary?: ClipExportSummary; error?: string; failures?: ClipExportSummary["skipped"]; retryAt?: string; downloadUrl?: string; videoFile?: File; packageCount?: number };
const pending = (batch: Batch) => ["queued", "waiting", "processing"].includes(batch.status);
export const clipExportRequestKey = (request: ExportRequest) => JSON.stringify(request.plan || request.plans ? [request.plans, request.scope, request.clipIds, request.format, request.layout, request.plan, request.engine] : [request.scope, request.clipIds, request.format, request.layout, request.engine]);
const unit = (batch: Batch, count: number) => (batch.request.plan || batch.request.plans ? (count === 1 ? "file" : "files") : count === 1 ? "clip" : "clips");
function subset(request: ExportRequest, indices: number[]): ExportRequest {
	const clipIds = indices.map((index) => request.clipIds[index]);
	if (request.plans) {
		const chosen = new Set(indices);
		let offset = 0;
		const plans = request.plans.flatMap((plan) => {
			const files = plan.files.filter((_, index) => chosen.has(index + offset));
			offset += plan.files.length;
			return files.length ? [{ ...plan, files, outputs: plan.outputs.filter((output) => files.some((file) => file.outputKey === output.key)) }] : [];
		});
		return { ...request, clipIds, plans };
	}
	if (!request.plan) return { ...request, clipIds };
	const files = indices.map((index) => request.plan!.files[index]),
		keys = new Set(files.map((file) => file.outputKey));
	return { ...request, clipIds, format: files.length === 1 ? "mp4" : "zip", plan: { ...request.plan, files, outputs: request.plan.outputs.filter((output) => keys.has(output.key)) } };
}
function downloadName(batch: Batch) {
	if (batch.request.format === "zip") return exportArchiveName(batch.startedAt);
	const plan = batch.request.plan,
		output = plan?.outputs.find((output) => output.key === plan.files[0].outputKey);
	return clipExportFilename(`${batch.request.clipNames?.[batch.request.clipIds[0]] ?? "clip"} ${output?.label ?? "Original"}`, batch.request.clipIds[0], 0, new Set());
}
function requestFiles(request: ExportRequest) {
	return (request.plans ?? (request.plan ? [request.plan] : [])).flatMap((plan) =>
		plan.files.map((file) => {
			const output = plan.outputs.find((output) => output.key === file.outputKey);
			const format = output?.format ?? (output?.layout ? ("format" in output.layout ? output.layout.format : "mobile") : "original");
			return { clipId: file.clipId, format, label: output?.templateId ? `Layout: ${output.label.replace(/ (Desktop|Mobile)$/, "")}` : (output?.label ?? "Output") } as const;
		}),
	);
}
function ExportDownloadButton({ batch, onRepeat }: { batch: Batch; onRepeat: (request: ExportRequest) => void }) {
	return (
		<Button
			variant={batch.downloadUrl ? "primary" : "secondary"}
			onPress={() => {
				if (batch.downloadUrl) {
					const link = document.createElement("a");
					link.href = batch.downloadUrl;
					link.download = downloadName(batch);
					document.body.append(link);
					link.click();
					link.remove();
				} else onRepeat(batch.request);
			}}
		>
			<IconDownload className='size-4 shrink-0' />
			{batch.downloadUrl ? `Download ${batch.packageCount && batch.packageCount > 1 ? "latest " : ""}${batch.request.format.toUpperCase()}` : "Export again"}
		</Button>
	);
}

const ExportContext = createContext<{ batches: Batch[]; enqueue: (request: ExportRequest) => void; enqueuePlans: (plans: ClipExportPlan[], clipNames: Record<string, string> | undefined, scope: string, engine?: ExportEngine) => boolean; show: () => void } | null>(null);
export const useClipExports = () => useContext(ExportContext);
export function ClipExportProvider({ children, creatorId }: { children: ReactNode; creatorId: string }) {
	const [cancelIds, setCancelIds] = useState<number[]>([]);
	const [batches, setBatches] = useState<Batch[]>([]),
		[open, setOpen] = useState(false),
		[expanded, setExpanded] = useState<number[]>([]),
		[now, setNow] = useState(() => Date.now());
	const modalOpen = useRef(false),
		notice = useRef<string | undefined>(undefined);
	const changeOpen = (value: boolean) => {
		modalOpen.current = value;
		if (value && notice.current) {
			toast.close(notice.current);
			notice.current = undefined;
		}
		setOpen(value);
	};
	const announce = (options: Parameters<typeof notify>[0]) => {
		if (!modalOpen.current) notice.current = notify(options);
	};
	const jobs = useRef<Batch[]>([]),
		running = useRef(false),
		alive = useRef(true),
		sequence = useRef(0),
		controller = useRef<AbortController | null>(null),
		urls = useRef(new Set<string>()),
		disposals = useRef(new Map<string, () => Promise<void>>()),
		budget = useRef({ used: 0, resetAt: 0 });
	const update = (fn: (jobs: Batch[]) => Batch[]) => {
		if (!alive.current) return;
		jobs.current = fn(jobs.current);
		setBatches(jobs.current);
	};
	const patch = (id: number, value: Partial<Batch>) => {
		update((list) => list.map((batch) => (batch.id === id ? { ...batch, ...value } : batch)));
	};
	useEffect(() => {
		alive.current = true;
		void cleanupBrowserExports().catch(() => {});
		const activeUrls = urls.current;
		const activeDisposals = disposals.current;
		return () => {
			alive.current = false;
			controller.current?.abort();
			activeUrls.forEach((url) => URL.revokeObjectURL(url));
			activeDisposals.forEach((dispose) => {
				void dispose();
			});
		};
	}, []);
	useEffect(() => {
		if (!batches.some((batch) => batch.retryAt && Date.parse(batch.retryAt) > Date.now())) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [batches]);
	useEffect(() => {
		if (!batches.some(pending)) return;
		const protect = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", protect);
		return () => window.removeEventListener("beforeunload", protect);
	}, [batches]);

	const publish = (bytes: Uint8Array<ArrayBuffer> | Blob, batch: Batch, name: string) => {
		disposals.current.forEach((dispose) => {
			void dispose();
		});
		disposals.current.clear();
		urls.current.forEach((url) => URL.revokeObjectURL(url));
		urls.current.clear();
		update((list) => list.map((job) => ({ ...job, downloadUrl: undefined, videoFile: undefined })));
		const file = bytes instanceof File ? bytes : new File([bytes], name, { type: batch.request.format === "mp4" ? "video/mp4" : "application/zip" });
		const url = URL.createObjectURL(file);
		if (batch.request.format === "mp4") patch(batch.id, { videoFile: file });
		urls.current.add(url);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = name;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		return url;
	};
	const run = async () => {
		if (running.current) return;
		running.current = true;
		try {
			while (alive.current) {
				const batch = jobs.current.find((batch) => batch.status === "queued");
				if (!batch) break;
				const abort = new AbortController();
				controller.current = abort;
				try {
					if (Date.now() >= budget.current.resetAt) budget.current = { used: 0, resetAt: Date.now() + 60000 };
					const nextAt = Math.max(batch.retryAt ? Date.parse(batch.retryAt) : 0, !batch.request.plans && budget.current.used + batch.request.clipIds.length > 50 ? budget.current.resetAt : 0);
					if (nextAt > Date.now()) {
						patch(batch.id, { status: "waiting", retryAt: new Date(nextAt).toISOString() });
						await new Promise<void>((resolve, reject) => {
							const timer = setTimeout(() => {
								abort.signal.removeEventListener("abort", cancel);
								resolve();
							}, nextAt - Date.now());
							const cancel = () => {
								clearTimeout(timer);
								reject(new Error("CANCELLED"));
							};
							abort.signal.addEventListener("abort", cancel, { once: true });
						});
					}
					abort.signal.throwIfAborted();
					if (Date.now() >= budget.current.resetAt) budget.current = { used: 0, resetAt: Date.now() + 60000 };
					if (!batch.request.plans) budget.current.used += batch.request.clipIds.length;
					patch(batch.id, { status: "processing", error: undefined, retryAt: undefined });
					const { format, clipIds, layout } = batch.request;
					const response = batch.request.plan || batch.request.plans ? null : await fetch(`/api/clips/export?format=${format}&progress=1${batch.request.plan ? "&plan=1" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch.request.plan ?? { creatorId, clipIds, ...(layout ? { layout } : {}) }), signal: abort.signal });
					const report = (event: ClipExportProgress) => {
						update((list) => list.map((job) => (job.id === batch.id ? { ...job, clips: job.clips.map((clip, index) => (index === event.index ? { ...clip, ...event } : clip)) } : job)));
					};
					const result = batch.request.plans ? await buildBrowserArchive(batch.request.plans, batch.startedAt, abort.signal, report, (retryAt) => patch(batch.id, { status: retryAt ? "waiting" : "processing", retryAt })) : batch.request.plan ? await buildBrowserBatch(batch.request.plan, abort.signal, report, (bytes, part) => publish(bytes, batch, `clipify-clips-batch-${batch.id}-part-${part}.zip`), format) : await readClipExportResponse(response!, clipIds.length, format, abort.signal, report);
					if (!alive.current) return;
					setNow(Date.now());
					abort.signal.throwIfAborted();
					if (!result.ok) {
						if (result.code === "RATE_LIMITED") {
							patch(batch.id, { status: "queued", retryAt: result.retryAt ?? new Date(Date.now() + 60000).toISOString(), error: "RATE_LIMITED" });
							continue;
						}
						patch(batch.id, { status: "failed", error: result.code, failures: result.failures, retryAt: result.retryAt });
						announce({ title: messages[result.code] ?? "The export could not be prepared.", color: "danger" });
						// Account access failures require a deliberate retry after the account is repaired.
						if (["RECONNECT_REQUIRED", "AUTHENTICATION_REQUIRED", "PERMISSION_DENIED", "ACCOUNT_SUSPENDED", "ENTITLEMENT_REQUIRED"].includes(result.code)) update((list) => list.map((job) => (job.status === "queued" ? { ...job, status: "failed", error: result.code } : job)));
						continue;
					}
					const packageCount = "partCount" in result && typeof result.partCount === "number" ? result.partCount : 1;
					const url = publish(result.bytes, batch, packageCount > 1 ? `clipify-clips-batch-${batch.id}-part-${packageCount}.zip` : downloadName(batch));
					if ("dispose" in result && typeof result.dispose === "function") disposals.current.set(url, result.dispose);
					const failures = new Map(result.summary.skipped.map((item) => [item.index, item]));
					patch(batch.id, { status: "completed", downloadUrl: url, packageCount, summary: result.summary, retryAt: result.summary.retryAt, clips: (jobs.current.find((job) => job.id === batch.id)?.clips ?? batch.clips).map((clip, index) => ({ ...clip, stage: failures.has(index) ? "skipped" : "ready", code: failures.get(index)?.code })) });
					announce({ title: result.summary.skipped.length ? "Download started with skipped clips" : "Download started", color: result.summary.skipped.length ? "warning" : "success" });
				} catch (error) {
					if (alive.current) {
						const code = abort.signal.aborted ? "CANCELLED" : error instanceof DOMException ? (error.name === "QuotaExceededError" ? "browser_storage_full" : "browser_storage_error") : error instanceof Error && ["invalid_response", "browser_storage_unavailable", "browser_storage_full", "browser_storage_error"].includes(error.message) ? error.message : "SERVICE_UNAVAILABLE";
						patch(batch.id, { status: code === "CANCELLED" ? "cancelled" : "failed", error: code });
						announce({ title: code === "CANCELLED" ? "Export cancelled. Your selection is kept." : messages[code], color: code === "CANCELLED" ? "default" : "danger" });
					}
				} finally {
					if (controller.current === abort) controller.current = null;
				}
			}
		} finally {
			running.current = false;
		}
	};
	const appendRequests = (requests: ExportRequest[], group: string) => {
		if (jobs.current.some((job) => pending(job) && job.group === group)) {
			changeOpen(true);
			return true;
		}
		if (!requests.length) return false;
		const added: Batch[] = requests.map((request) => {
			const files = requestFiles(request);
			return {
				startedAt: new Date().toISOString(),
				id: ++sequence.current,
				group,
				request: { ...request, layout: request.layout ? structuredClone(request.layout) : undefined, plans: request.plans?.map((plan) => clipExportPlanSchema.parse(plan)), plan: request.plan ? clipExportPlanSchema.parse(request.plan) : undefined },
				status: "queued",
				clips: request.clipIds.map((id, index) => ({ index, stage: "queued", outputLabel: files[index]?.label, outputFormat: files[index]?.format, title: request.clipNames?.[id] || `Clip ${index + 1}` })),
			};
		});
		update((list) => [...list.filter(pending), ...list.filter((job) => !pending(job)).slice(-20), ...added]);
		changeOpen(true);
		void run();
		return true;
	};
	const enqueue = (request: ExportRequest) => {
		if (request.creatorId !== creatorId || !request.clipIds.length || (request.format === "mp4" && request.clipIds.length !== 1)) return;
		if (request.plans) {
			enqueuePlans(request.plans, request.clipNames, request.scope, request.engine);
			return;
		}
		if (request.plan) {
			appendRequests([{ ...request, ...(request.format === "zip" ? { plans: [request.plan], plan: undefined } : {}), engine: "browser" }], clipExportRequestKey(request));
			return;
		}
		if (request.layout) {
			const plans = createClipExportPlan(creatorId, request.clipIds, [{ key: "preview", label: "Layout", layout: request.layout }]);
			if (request.format === "zip") appendRequests([{ ...request, layout: undefined, plans, clipIds: plans.flatMap((plan) => plan.files.map((file) => file.clipId)), engine: "browser" }], clipExportRequestKey(request));
			else
				appendRequests(
					plans.map((plan) => ({ ...request, layout: undefined, clipIds: plan.files.map((file) => file.clipId), plan, engine: "browser" })),
					clipExportRequestKey(request),
				);
			return;
		}
		const ids = [...new Set(request.clipIds)],
			requests: ExportRequest[] = [];
		for (let offset = 0; offset < ids.length; offset += 50) requests.push({ ...request, clipIds: ids.slice(offset, offset + 50) });
		appendRequests(requests, clipExportRequestKey(request));
	};
	const enqueuePlans = (plans: ClipExportPlan[], clipNames: Record<string, string> | undefined, scope: string, engine: ExportEngine = "browser") => {
		if (!plans.length || plans.some((plan) => plan.creatorId !== creatorId || !plan.files.length || plan.files.length > 50)) return false;
		const single = plans.length === 1 && plans[0].files.length === 1;
		const request: ExportRequest = { creatorId, scope, clipNames, clipIds: plans.flatMap((plan) => plan.files.map((file) => file.clipId)), ...(single ? { plan: plans[0], format: "mp4" as const } : { plans, format: "zip" as const }), engine };
		return appendRequests([request], JSON.stringify(["plan", scope, plans, engine]));
	};
	const active = batches.filter(pending),
		latest = batches.at(-1),
		current = active.length ? active : latest ? [latest] : [],
		history = batches.filter((batch) => !current.includes(batch));
	const cancel = (batch: Batch) => {
		if (batch.status === "processing" || batch.status === "waiting") controller.current?.abort();
		else patch(batch.id, { status: "cancelled", error: "CANCELLED" });
	};
	const view = (batch: Batch) => {
		const failures = batch.summary?.skipped ?? batch.failures;
		const retry = failures ? failures.filter((item) => item.retryable && ["provider_error", "download_timeout", "rate_limited", "render_busy", "render_failed", "font_unavailable", "browser_unsupported"].includes(item.code)).map((item) => item.index) : ["PROVIDER_UNAVAILABLE", "EXPORT_TIMEOUT", "SERVICE_UNAVAILABLE", "invalid_response", "browser_storage_unavailable", "browser_storage_full", "browser_storage_error"].includes(batch.error ?? "") ? batch.request.clipIds.map((_, index) => index) : [];
		const reconnectIds = failures ? failures.filter((item) => item.code === "reconnect_required").map((item) => item.index) : batch.error === "RECONNECT_REQUIRED" ? batch.request.clipIds.map((_, index) => index) : [];
		const reconnect = reconnectIds.length > 0;
		const processed = batch.clips.filter((clip) => ["ready", "skipped"].includes(clip.stage)).length;
		return (
			<div className='space-y-4'>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<h3 className='font-medium'>
						Export <LocalizedDate value={batch.startedAt} showTime />
					</h3>
					<span className='text-sm text-muted'>
						{batch.request.clipIds.length} {unit(batch, batch.request.clipIds.length)} ({batch.request.format.toUpperCase()})
					</span>
				</div>
				{pending(batch) ? (
					<div className='space-y-2'>
						<div className='flex items-center justify-between gap-3 text-sm'>
							<span>{batch.status === "waiting" ? "Waiting" : "Preparing your files"}</span>
							<span className='text-muted tabular-nums'>
								{processed} of {batch.clips.length} prepared
							</span>
						</div>
						<ProgressBar aria-label={`Batch ${batch.id} progress`} value={processed} maxValue={batch.clips.length} size='sm'>
							<ProgressBar.Track>
								<ProgressBar.Fill />
							</ProgressBar.Track>
						</ProgressBar>
					</div>
				) : null}
				{batch.status === "waiting" ? (
					<p role='status' className='text-sm text-muted'>
						Waiting for the download limit. Resumes in {Math.max(0, Math.ceil(((batch.retryAt ? Date.parse(batch.retryAt) : now) - now) / 1000))}s.
					</p>
				) : null}
				{batch.error && batch.error !== "RATE_LIMITED" ? (
					<p role='alert' className='text-sm'>
						{batch.error === "CANCELLED" ? "Export cancelled. Your selection is kept." : (messages[batch.error] ?? "The export could not be prepared.")}
					</p>
				) : null}
				{batch.summary ? (
					<p role='status' className='text-sm'>
						{batch.summary.included.length} {unit(batch, batch.summary.included.length)} ready. {batch.packageCount && batch.packageCount > 1 ? `${batch.packageCount} ZIP parts downloaded. Allow multiple downloads if your browser asks.` : "Download initiated."}
						{batch.summary.skipped.length ? ` ${batch.summary.skipped.length} ${unit(batch, batch.summary.skipped.length)} skipped.` : ""}
					</p>
				) : null}
				{batch.status === "completed" && batch.request.format === "mp4" && batch.downloadUrl && batch.videoFile ? (
					<div className='space-y-2'>
						<video
							src={batch.downloadUrl}
							controls
							playsInline
							draggable
							aria-label='Exported video'
							className='max-h-72 w-full cursor-grab rounded-xl bg-black active:cursor-grabbing'
							onDragStart={(event) => {
								event.dataTransfer.clearData();
								event.dataTransfer.items.add(batch.videoFile!);
								event.dataTransfer.effectAllowed = "copy";
							}}
						/>
						<p className='text-xs text-muted'>Drag the video to an upload area, or use Download MP4. Dragging support depends on your browser and the destination.</p>
					</div>
				) : null}
				<ul aria-label={`Export ${batch.id} files`} className='max-h-72 divide-y divide-separator overflow-y-auto overscroll-contain'>
					{batch.clips.map((clip, index) => {
						const failure = failures?.find((item) => item.index === index),
							finished = batch.status === "completed" && !failure,
							busy = pending(batch) && ["processing", "rendering"].includes(clip.stage);
						const label = failure ? reasons[failure.code] : batch.status === "cancelled" ? "Cancelled" : batch.status === "failed" ? "Not downloaded" : finished ? "Ready" : clip.stage === "ready" ? "Prepared" : clip.stage === "rendering" ? "Rendering video" : clip.stage === "processing" ? "Downloading" : "Queued";
						const format = clip.outputFormat === "desktop" ? "Desktop" : clip.outputFormat === "mobile" ? "Mobile" : "Original";
						const FormatIcon = clip.outputFormat === "desktop" ? IconDeviceDesktop : clip.outputFormat === "mobile" ? IconDeviceMobile : IconVideo;
						return (
							<li key={index} className='flex items-center gap-3 py-3'>
								<span className='shrink-0' aria-hidden='true'>
									{finished || (pending(batch) && clip.stage === "ready") ? <IconCheck className='size-5 text-success' /> : failure || batch.status === "failed" ? <IconX className='size-5 text-danger' /> : busy ? <Spinner size='sm' /> : <IconClock className='size-5 text-muted' />}
								</span>
								<div className='min-w-0 flex-1'>
									<p className='line-clamp-2 text-sm font-medium'>{batch.request.clipNames?.[batch.request.clipIds[index]] || failure?.title || clip.title}</p>
									{clip.outputLabel ? (
										<div className='flex items-center gap-1.5 text-xs text-muted'>
											<FormatIcon role='img' aria-label={format} className='size-3.5 shrink-0'>
												<title>{format}</title>
											</FormatIcon>
											<span>{clip.outputLabel}</span>
										</div>
									) : null}
									<p className={`text-xs ${failure || batch.status === "failed" ? "text-danger" : "text-muted"}`}>{label}</p>
								</div>
							</li>
						);
					})}
				</ul>
				<div className='flex flex-wrap items-center justify-end gap-2 border-t border-separator pt-4'>
					{reconnect ? (
						<Link href='/dashboard/settings?tab=connections' target='_blank' rel='noopener noreferrer'>
							Reconnect Twitch (opens in a new tab)
						</Link>
					) : null}
					{!pending(batch) && batch.status !== "cancelled" && (batch.error || failures?.length) && retry.length ? (
						<Button variant={batch.downloadUrl ? "secondary" : "primary"} isDisabled={Boolean(batch.retryAt && Date.parse(batch.retryAt) > now)} onPress={() => enqueue(subset(batch.request, retry))}>
							<IconRefresh className='size-4 shrink-0' />
							{batch.request.plan || batch.request.plans ? "Retry failed files" : "Retry failed clips"}
						</Button>
					) : null}
					{reconnect ? (
						<Button variant='secondary' onPress={() => enqueue(subset(batch.request, reconnectIds))}>
							Retry after reconnect
						</Button>
					) : null}
					{batch.status === "completed" && batch.id !== latest?.id ? <ExportDownloadButton batch={batch} onRepeat={enqueue} /> : null}
				</div>
				{batch.retryAt && Date.parse(batch.retryAt) > now && batch.status !== "waiting" ? (
					<p className='text-sm text-muted'>
						Please wait until <LocalizedDate value={batch.retryAt} showTime /> before retrying.
					</p>
				) : null}
			</div>
		);
	};
	return (
		<ExportContext.Provider value={{ batches, enqueue, enqueuePlans, show: () => changeOpen(true) }}>
			{children}
			<ControlledModal ariaLabel='Clip exports' isOpen={open} onClose={() => changeOpen(false)} size='lg'>
				<Modal.Header>
					<Modal.Heading>Clip exports</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='max-h-[60dvh] space-y-6 overflow-y-auto'>
					<p className='text-sm text-muted'>Keep this tab open. Your download starts when the export is ready.</p>
					{current.map((batch) => (
						<section key={batch.id} aria-label={`Export ${batch.id}`} className='space-y-4'>
							{batch.status === "queued" ? (
								<div className='flex items-center justify-between gap-3'>
									<p className='text-sm'>
										Export <LocalizedDate value={batch.startedAt} showTime />, {batch.request.clipIds.length} {unit(batch, batch.request.clipIds.length)} queued
									</p>
									<Button size='sm' variant='danger-soft' aria-label={`Cancel queued export ${batch.id}`} onPress={() => setCancelIds([batch.id])}>
										Cancel
									</Button>
								</div>
							) : (
								view(batch)
							)}
						</section>
					))}
					{history.length ? (
						<div className='space-y-2'>
							<h3 className='text-sm font-medium text-muted'>Previous exports</h3>
							{history.map((batch) => (
								<Disclosure className='border-b border-separator last:border-b-0' key={batch.id} isExpanded={expanded.includes(batch.id)} onExpandedChange={(value) => setExpanded((ids) => (value ? [...ids, batch.id] : ids.filter((id) => id !== batch.id)))}>
									<Disclosure.Heading>
										<Button slot='trigger' variant='ghost' className='h-auto w-full justify-start gap-3 rounded-none px-0 py-3 text-sm' data-export-id={batch.id}>
											<span className='min-w-0 flex-1 text-left'>
												Export <LocalizedDate value={batch.startedAt} showTime />
											</span>
											<span className='text-muted capitalize'>{batch.status}</span>
											<span className='text-muted'>
												{batch.request.clipIds.length} {unit(batch, batch.request.clipIds.length)}
											</span>
											<Disclosure.Indicator className='size-4 shrink-0' />
										</Button>
									</Disclosure.Heading>
									<Disclosure.Content>
										<Disclosure.Body className='pb-4'>{expanded.includes(batch.id) ? view(batch) : null}</Disclosure.Body>
									</Disclosure.Content>
								</Disclosure>
							))}
						</div>
					) : null}
				</Modal.Body>
				<Modal.Footer className='flex flex-row flex-nowrap items-center justify-end gap-2'>
					{active.length ? (
						<Button variant='danger-soft' className='shrink-0 px-3' onPress={() => setCancelIds(active.map((batch) => batch.id))}>
							Cancel export
						</Button>
					) : null}
					{!active.length && latest?.status === "completed" ? <ExportDownloadButton batch={latest} onRepeat={enqueue} /> : null}
					<Button variant={!active.length && latest?.status === "completed" ? "secondary" : "primary"} className='min-w-0 px-3' onPress={() => changeOpen(false)}>
						{active.length ? "Continue in background" : "Close exports"}
					</Button>
				</Modal.Footer>
			</ControlledModal>
			<ConfirmModal
				isOpen={cancelIds.length > 0}
				onOpenChange={(open) => {
					if (!open) setCancelIds([]);
				}}
				title='Cancel export?'
				description='Stop the selected unfinished work? Files already downloaded are kept.'
				confirmLabel='Stop export'
				cancelLabel='Keep exporting'
				onConfirm={() => {
					jobs.current.filter((batch) => cancelIds.includes(batch.id) && pending(batch)).forEach(cancel);
					setCancelIds([]);
				}}
			/>
		</ExportContext.Provider>
	);
}
export function ExportQueueLauncher({ compact = false }: { compact?: boolean }) {
	const context = useClipExports();
	if (!context?.batches.length) return null;
	const count = context.batches.filter(pending).length;
	return (
		<Button variant='ghost' isIconOnly={compact} aria-label='Exports' data-dashboard-launcher='exports' onPress={context.show} className={compact ? "" : "w-full justify-start text-sm text-muted"}>
			{count ? <Spinner size='sm' /> : <IconDownload className='size-4' />}
			{compact ? null : <>Exports {count ? `(${count})` : null}</>}
		</Button>
	);
}
