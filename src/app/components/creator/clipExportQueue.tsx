"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Disclosure, Link, Modal, Spinner, ProgressBar, toast } from "@heroui/react";
import { IconCheck, IconClock, IconDownload, IconRefresh, IconX } from "@tabler/icons-react";
import ControlledModal from "@components/controlledModal";
import LocalizedDate from "@components/localizedDate";
import { notify } from "@lib/toast";
import { buildBrowserBatch } from "@lib/clipBrowserBatch";
import type { ExportEngine } from "@lib/clipBrowserExport";
import { clipExportPlanSchema, type ClipExportPlan } from "@lib/clipExportPlan";
import type { ClipLayout } from "@lib/clipLayout";
import type { ClipExportSummary } from "@lib/clipExport";
import { readClipExportResponse, type ClipExportProgress } from "@lib/clipExportStream";
const messages: Record<string, string> = {
	BROWSER_UNSUPPORTED: "Video export is unavailable on this device. Try a supported browser or choose server processing.",
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
	invalid_response: "The download response was incomplete. Please try again.",
	LAYOUT_UNAVAILABLE: "A selected layout is no longer available. Open export settings and choose another layout.",
};
const reasons: Record<string, string> = {
	browser_unsupported: "Browser rendering unavailable. You can process this file on the server.",
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

export type ExportRequest = { creatorId: string; clipIds: string[]; scope: string; format: "zip" | "mp4"; layout?: ClipLayout; clipNames?: Record<string, string>; plan?: ClipExportPlan; engine?: ExportEngine };
type Batch = { id: number; group: string; request: ExportRequest; status: "queued" | "waiting" | "processing" | "completed" | "failed" | "cancelled"; clips: ClipExportProgress[]; summary?: ClipExportSummary; error?: string; failures?: ClipExportSummary["skipped"]; retryAt?: string; downloadUrl?: string };
const pending = (batch: Batch) => ["queued", "waiting", "processing"].includes(batch.status);
export const clipExportRequestKey = (request: ExportRequest) => JSON.stringify(request.plan ? [request.scope, request.clipIds, request.format, request.layout, request.plan, request.engine] : [request.scope, request.clipIds, request.format, request.layout, request.engine]);
const unit = (batch: Batch, count: number) => (batch.request.plan ? (count === 1 ? "file" : "files") : count === 1 ? "clip" : "clips");
function subset(request: ExportRequest, indices: number[]): ExportRequest {
	const clipIds = indices.map((index) => request.clipIds[index]);
	if (!request.plan) return { ...request, clipIds };
	const files = indices.map((index) => request.plan!.files[index]),
		keys = new Set(files.map((file) => file.outputKey));
	return { ...request, clipIds, format: "zip", plan: { ...request.plan, files, outputs: request.plan.outputs.filter((output) => keys.has(output.key)) } };
}
const downloadName = (batch: Batch) => (batch.request.format === "mp4" ? `clipify-${encodeURIComponent(batch.request.clipIds[0])}${batch.request.plan ? "-" + batch.request.plan.files[0].outputKey.slice(0, 40) : ""}.mp4` : `clipify-clips-batch-${batch.id}.zip`);
const ExportContext = createContext<{ batches: Batch[]; enqueue: (request: ExportRequest) => void; enqueuePlans: (plans: ClipExportPlan[], clipNames: Record<string, string> | undefined, scope: string, engine?: ExportEngine) => boolean; show: () => void } | null>(null);
export const useClipExports = () => useContext(ExportContext);
export function ClipExportProvider({ children, creatorId }: { children: ReactNode; creatorId: string }) {
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
		const activeUrls = urls.current;
		return () => {
			alive.current = false;
			controller.current?.abort();
			activeUrls.forEach((url) => URL.revokeObjectURL(url));
		};
	}, []);
	useEffect(() => {
		if (!batches.some((batch) => batch.retryAt && Date.parse(batch.retryAt) > Date.now())) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [batches]);
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
					const nextAt = Math.max(batch.retryAt ? Date.parse(batch.retryAt) : 0, budget.current.used + batch.request.clipIds.length > 50 ? budget.current.resetAt : 0);
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
					budget.current.used += batch.request.clipIds.length;
					patch(batch.id, { status: "processing", error: undefined, retryAt: undefined });
					const { format, clipIds, layout } = batch.request;
					const response = batch.request.engine === "browser" && batch.request.plan ? null : await fetch(`/api/clips/export?format=${format}&progress=1${batch.request.plan ? "&plan=1" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch.request.plan ?? { creatorId, clipIds, ...(layout ? { layout } : {}) }), signal: abort.signal });
					const report = (event: ClipExportProgress) => {
						update((list) => list.map((job) => (job.id === batch.id ? { ...job, clips: job.clips.map((clip, index) => (index === event.index ? { ...clip, ...event } : clip)) } : job)));
					};
					const result = batch.request.engine === "browser" && batch.request.plan ? await buildBrowserBatch(batch.request.plan, abort.signal, report) : await readClipExportResponse(response!, clipIds.length, format, abort.signal, report);
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
					urls.current.forEach((url) => URL.revokeObjectURL(url));
					urls.current.clear();
					update((list) => list.map((job) => ({ ...job, downloadUrl: undefined })));
					const url = URL.createObjectURL(new Blob([result.bytes], { type: format === "mp4" ? "video/mp4" : "application/zip" }));
					urls.current.add(url);
					const anchor = document.createElement("a");
					anchor.href = url;
					anchor.download = downloadName(batch);
					document.body.append(anchor);
					anchor.click();
					anchor.remove();
					const failures = new Map(result.summary.skipped.map((item) => [item.index, item]));
					patch(batch.id, { status: "completed", downloadUrl: url, summary: result.summary, retryAt: result.summary.retryAt, clips: (jobs.current.find((job) => job.id === batch.id)?.clips ?? batch.clips).map((clip, index) => ({ ...clip, stage: failures.has(index) ? "skipped" : "ready", code: failures.get(index)?.code })) });
					announce({ title: result.summary.skipped.length ? "Download started with skipped clips" : "Download started", color: result.summary.skipped.length ? "warning" : "success" });
				} catch (error) {
					if (alive.current) {
						const code = abort.signal.aborted ? "CANCELLED" : error instanceof Error && error.message === "invalid_response" ? "invalid_response" : "SERVICE_UNAVAILABLE";
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
		const count = jobs.current.filter(pending).reduce((sum, job) => sum + job.request.clipIds.length, 0),
			addedCount = requests.reduce((sum, request) => sum + request.clipIds.length, 0);
		if (!addedCount || count + addedCount > 10000) {
			notify({ title: "The export queue is full", description: "Wait for a batch to finish before adding more files.", color: "warning" });
			return false;
		}
		const added: Batch[] = requests.map((request) => ({
			id: ++sequence.current,
			group,
			request: { ...request, layout: request.layout ? structuredClone(request.layout) : undefined, plan: request.plan ? clipExportPlanSchema.parse(request.plan) : undefined },
			status: "queued",
			clips: request.clipIds.map((id, index) => ({ index, stage: "queued", title: request.plan ? `${request.clipNames?.[id] || `Clip ${index + 1}`} / ${request.plan.outputs.find((output) => output.key === request.plan!.files[index].outputKey)?.label || "Output"}` : request.clipNames?.[id] || `Clip ${index + 1}` })),
		}));
		update((list) => [...list.filter(pending), ...list.filter((job) => !pending(job)).slice(-20), ...added]);
		changeOpen(true);
		void run();
		return true;
	};
	const enqueue = (request: ExportRequest) => {
		if (request.creatorId !== creatorId || !request.clipIds.length || request.clipIds.length > 500 || (request.format === "mp4" && request.clipIds.length !== 1)) return;
		if (request.plan) {
			appendRequests([request], clipExportRequestKey(request));
			return;
		}
		const ids = [...new Set(request.clipIds)],
			requests: ExportRequest[] = [];
		for (let offset = 0; offset < ids.length; offset += 50) requests.push({ ...request, clipIds: ids.slice(offset, offset + 50) });
		appendRequests(requests, clipExportRequestKey(request));
	};
	const enqueuePlans = (plans: ClipExportPlan[], clipNames: Record<string, string> | undefined, scope: string, engine?: ExportEngine) => {
		if (!plans.length || plans.some((plan) => plan.creatorId !== creatorId || !plan.files.length || plan.files.length > 50)) return false;
		const requests: ExportRequest[] = plans.flatMap((plan) => {
			const size = engine === "server" && plan.outputs.some((o) => o.layout) ? 2 : 50;
			const chunks: ExportRequest[] = [];
			for (let offset = 0; offset < plan.files.length; offset += size) {
				const files = plan.files.slice(offset, offset + size),
					keys = new Set(files.map((f) => f.outputKey));
				chunks.push({ creatorId, scope, clipNames, clipIds: files.map((f) => f.clipId), plan: { ...plan, files, outputs: plan.outputs.filter((o) => keys.has(o.key)) }, format: "zip", engine });
			}
			return chunks;
		});
		return appendRequests(requests, JSON.stringify(["plan", scope, plans, engine]));
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
		const retry = failures ? failures.filter((item) => item.retryable && ["provider_error", "download_timeout", "rate_limited", "render_busy", "render_failed", "font_unavailable", "browser_unsupported"].includes(item.code)).map((item) => item.index) : ["PROVIDER_UNAVAILABLE", "EXPORT_TIMEOUT", "SERVICE_UNAVAILABLE", "invalid_response"].includes(batch.error ?? "") ? batch.request.clipIds.map((_, index) => index) : [];
		const reconnectIds = failures ? failures.filter((item) => item.code === "reconnect_required").map((item) => item.index) : batch.error === "RECONNECT_REQUIRED" ? batch.request.clipIds.map((_, index) => index) : [];
		const reconnect = reconnectIds.length > 0;
		const processed = batch.clips.filter((clip) => ["ready", "skipped"].includes(clip.stage)).length;
		return (
			<div className='space-y-4'>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<h3 className='font-medium'>Batch {batch.id}</h3>
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
						{batch.summary.included.length} {unit(batch, batch.summary.included.length)} ready. Download initiated.{batch.summary.skipped.length ? ` ${batch.summary.skipped.length} ${unit(batch, batch.summary.skipped.length)} skipped.` : ""}
					</p>
				) : null}
				<ul aria-label={`Batch ${batch.id} clips`} className='max-h-72 divide-y divide-separator overflow-y-auto overscroll-contain'>
					{batch.clips.map((clip, index) => {
						const failure = failures?.find((item) => item.index === index),
							finished = batch.status === "completed" && !failure,
							busy = pending(batch) && ["processing", "rendering"].includes(clip.stage);
						const label = failure ? reasons[failure.code] : batch.status === "cancelled" ? "Cancelled" : batch.status === "failed" ? "Not downloaded" : finished ? "Ready" : clip.stage === "ready" ? "Prepared" : clip.stage === "rendering" ? "Rendering video" : clip.stage === "processing" ? "Downloading" : "Queued";
						return (
							<li key={index} className='flex items-center gap-3 py-3'>
								<span className='shrink-0' aria-hidden='true'>
									{finished || (pending(batch) && clip.stage === "ready") ? <IconCheck className='size-5 text-success' /> : failure || batch.status === "failed" ? <IconX className='size-5 text-danger' /> : busy ? <Spinner size='sm' /> : <IconClock className='size-5 text-muted' />}
								</span>
								<div className='min-w-0 flex-1'>
									<p className='line-clamp-2 text-sm font-medium'>{batch.request.clipNames?.[batch.request.clipIds[index]] || failure?.title || clip.title}</p>
									{batch.request.plan ? <p className='text-xs text-muted'>{batch.request.plan.outputs.find((output) => output.key === batch.request.plan!.files[index].outputKey)?.label}</p> : null}
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
							{batch.request.plan ? "Retry failed files" : "Retry failed clips"}
						</Button>
					) : null}
					{batch.request.engine === "browser" && retry.length && !pending(batch) ? (
						<Button
							variant='secondary'
							onPress={() => {
								const request = subset(batch.request, retry);
								if (request.plan) enqueuePlans([request.plan], request.clipNames, request.scope, "server");
							}}
						>
							Process failed files on server
						</Button>
					) : null}
					{reconnect ? (
						<Button variant='secondary' onPress={() => enqueue(subset(batch.request, reconnectIds))}>
							Retry after reconnect
						</Button>
					) : null}
					{batch.status === "completed" ? (
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
								} else enqueue(batch.request);
							}}
						>
							<IconDownload className='size-4 shrink-0' />
							{batch.downloadUrl ? `Download ${batch.request.format.toUpperCase()}` : "Export batch again"}
						</Button>
					) : null}
					{pending(batch) ? (
						<Button variant='secondary' onPress={() => cancel(batch)}>
							Cancel export
						</Button>
					) : null}
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
					<p className='text-sm text-muted'>Keep this tab open. Your downloads start automatically when ready.</p>
					{current.map((batch) => (
						<section key={batch.id} aria-label={`Batch ${batch.id}`} className='space-y-4'>
							{batch.status === "queued" ? (
								<div className='flex items-center justify-between gap-3'>
									<p className='text-sm'>
										Batch {batch.id}, {batch.request.clipIds.length} {unit(batch, batch.request.clipIds.length)} queued
									</p>
									<Button size='sm' variant='ghost' aria-label={`Cancel batch ${batch.id}`} onPress={() => cancel(batch)}>
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
							<h3 className='text-sm font-medium text-muted'>Previous batches</h3>
							{history.map((batch) => (
								<Disclosure className='border-b border-separator last:border-b-0' key={batch.id} isExpanded={expanded.includes(batch.id)} onExpandedChange={(value) => setExpanded((ids) => (value ? [...ids, batch.id] : ids.filter((id) => id !== batch.id)))}>
									<Disclosure.Heading>
										<Button slot='trigger' variant='ghost' className='h-auto w-full justify-start gap-3 rounded-none px-0 py-3 text-sm' aria-label={`Batch ${batch.id}, ${batch.status}, ${batch.request.clipIds.length} ${unit(batch, batch.request.clipIds.length)}`}>
											<span className='min-w-0 flex-1 text-left'>Batch {batch.id}</span>
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
				<Modal.Footer>
					{active.length > 1 ? (
						<Button
							variant='danger-soft'
							onPress={() => {
								update((list) => list.map((job) => (pending(job) ? { ...job, status: "cancelled", error: "CANCELLED" } : job)));
								controller.current?.abort();
							}}
						>
							Cancel all batches
						</Button>
					) : null}
					<Button variant='secondary' onPress={() => changeOpen(false)}>
						{active.length ? "Continue in background" : "Close exports"}
					</Button>
				</Modal.Footer>
			</ControlledModal>
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
