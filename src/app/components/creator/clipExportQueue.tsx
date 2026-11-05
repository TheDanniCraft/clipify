"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Disclosure, Link, Modal, Spinner, toast } from "@heroui/react";
import { IconCheck, IconClock, IconDownload, IconX } from "@tabler/icons-react";
import ControlledModal from "@components/controlledModal";
import LocalizedDate from "@components/localizedDate";
import { notify } from "@lib/toast";
import type { ClipLayout } from "@lib/clipLayout";
import type { ClipExportSummary } from "@lib/clipExport";
import { readClipExportResponse, type ClipExportProgress } from "@lib/clipExportStream";
const messages: Record<string, string> = {
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
};
const reasons: Record<string, string> = {
	clip_unavailable: "Clip unavailable",
	download_unavailable: "Download unavailable",
	file_size_limit: "Clip exceeds 32 MiB",
	package_size_limit: "Package exceeds 128 MiB",
	invalid_media: "Twitch returned an incomplete video",
	provider_error: "Twitch download failed",
	render_busy: "Portrait rendering is busy. Retry shortly.",
	render_failed: "Portrait rendering failed. Your layout is kept.",
	download_timeout: "Download timed out",
	rate_limited: "Twitch download limit reached",
	reconnect_required: "Reconnect Twitch",
};

export type ExportRequest = { creatorId: string; clipIds: string[]; scope: string; format: "zip" | "mp4"; layout?: ClipLayout; clipNames?: Record<string, string> };
type Batch = { id: number; group: string; request: ExportRequest; status: "queued" | "waiting" | "processing" | "completed" | "failed" | "cancelled"; clips: ClipExportProgress[]; summary?: ClipExportSummary; error?: string; failures?: ClipExportSummary["skipped"]; retryAt?: string; downloadUrl?: string };
const pending = (batch: Batch) => ["queued", "waiting", "processing"].includes(batch.status);
const requestKey = (request: ExportRequest) => JSON.stringify([request.scope, request.clipIds, request.format, request.layout]);
const ExportContext = createContext<{ batches: Batch[]; enqueue: (request: ExportRequest) => void; show: () => void } | null>(null);
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
		timers = useRef(new Set<ReturnType<typeof setTimeout>>()),
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
		const activeUrls = urls.current,
			activeTimers = timers.current;
		return () => {
			alive.current = false;
			controller.current?.abort();
			activeUrls.forEach((url) => URL.revokeObjectURL(url));
			activeTimers.forEach(clearTimeout);
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
					const response = await fetch(`/api/clips/export?format=${format}&progress=1`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId, clipIds, ...(layout ? { layout } : {}) }), signal: abort.signal });
					const result = await readClipExportResponse(response, clipIds.length, format, abort.signal, (event) => {
						update((list) => list.map((job) => (job.id === batch.id ? { ...job, clips: job.clips.map((clip, index) => (index === event.index ? { ...clip, ...event } : clip)) } : job)));
					});
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
					anchor.download = format === "mp4" ? `clipify-${encodeURIComponent(clipIds[0])}.mp4` : `clipify-clips-batch-${batch.id}.zip`;
					document.body.append(anchor);
					anchor.click();
					anchor.remove();
					const failures = new Map(result.summary.skipped.map((item) => [item.index, item]));
					patch(batch.id, { status: "completed", downloadUrl: url, summary: result.summary, retryAt: result.summary.retryAt, clips: (jobs.current.find((job) => job.id === batch.id)?.clips ?? batch.clips).map((clip, index) => ({ ...clip, stage: failures.has(index) ? "skipped" : "ready", code: failures.get(index)?.code })) });
					const timer = setTimeout(() => {
						URL.revokeObjectURL(url);
						urls.current.delete(url);
						timers.current.delete(timer);
						update((list) => list.map((job) => (job.id === batch.id ? { ...job, downloadUrl: undefined } : job)));
					}, 60000);
					timers.current.add(timer);
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
	const enqueue = (request: ExportRequest) => {
		if (request.creatorId !== creatorId || !request.clipIds.length || request.clipIds.length > 500 || (request.format === "mp4" && request.clipIds.length !== 1)) return;
		if (jobs.current.some((job) => pending(job) && job.group === requestKey(request))) {
			changeOpen(true);
			return;
		}
		const ids = [...new Set(request.clipIds)];
		const count = jobs.current.filter(pending).reduce((sum, job) => sum + job.request.clipIds.length, 0);
		if (count + ids.length > 500) {
			notify({ title: "The export queue is full", description: "Wait for a batch to finish before adding more clips.", color: "warning" });
			return;
		}
		const added: Batch[] = [];
		for (let index = 0; index < ids.length; index += 50) {
			const clipIds = ids.slice(index, index + 50);
			added.push({ id: ++sequence.current, group: requestKey(request), request: { ...request, clipIds, layout: request.layout ? structuredClone(request.layout) : undefined }, status: "queued", clips: clipIds.map((id, index) => ({ index, stage: "queued", title: request.clipNames?.[id] || `Clip ${index + 1}` })) });
		}
		update((list) => [...list.filter(pending), ...list.filter((job) => !pending(job)).slice(-20), ...added]);
		changeOpen(true);
		void run();
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
		const retry = failures ? failures.filter((item) => item.retryable && ["provider_error", "download_timeout", "rate_limited", "render_busy", "render_failed"].includes(item.code)).map((item) => batch.request.clipIds[item.index]) : ["PROVIDER_UNAVAILABLE", "EXPORT_TIMEOUT", "SERVICE_UNAVAILABLE", "invalid_response"].includes(batch.error ?? "") ? batch.request.clipIds : [];
		const reconnectIds = failures ? failures.filter((item) => item.code === "reconnect_required").map((item) => batch.request.clipIds[item.index]) : batch.error === "RECONNECT_REQUIRED" ? batch.request.clipIds : [];
		const reconnect = reconnectIds.length > 0;
		return (
			<div className='space-y-4'>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<h3 className='font-medium'>Batch {batch.id}</h3>
					<span className='text-sm text-muted'>
						{batch.request.layout ? "Portrait" : "Original"} {batch.request.format.toUpperCase()} / {batch.request.clipIds.length} {batch.request.clipIds.length === 1 ? "clip" : "clips"}
					</span>
				</div>
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
						{batch.summary.included.length} {batch.summary.included.length === 1 ? "clip" : "clips"} ready. Download initiated.{batch.summary.skipped.length ? ` ${batch.summary.skipped.length} ${batch.summary.skipped.length === 1 ? "clip" : "clips"} skipped.` : ""}
					</p>
				) : null}
				<ul aria-label={`Batch ${batch.id} clips`} className='divide-y divide-separator'>
					{batch.clips.map((clip, index) => {
						const failure = failures?.find((item) => item.index === index),
							finished = batch.status === "completed" && !failure,
							busy = pending(batch) && ["processing", "rendering"].includes(clip.stage);
						const label = failure ? reasons[failure.code] : batch.status === "cancelled" ? "Cancelled" : batch.status === "failed" ? "Not downloaded" : finished ? "Ready" : clip.stage === "ready" ? "Prepared" : clip.stage === "rendering" ? "Rendering portrait" : clip.stage === "processing" ? "Downloading" : "Queued";
						return (
							<li key={index} className='flex items-center gap-3 py-3'>
								<span className='shrink-0' aria-hidden='true'>
									{finished || (pending(batch) && clip.stage === "ready") ? <IconCheck className='size-5 text-success' /> : failure || batch.status === "failed" ? <IconX className='size-5 text-danger' /> : busy ? <Spinner size='sm' /> : <IconClock className='size-5 text-muted' />}
								</span>
								<div className='min-w-0 flex-1'>
									<p className='line-clamp-2 text-sm font-medium'>{failure?.title || clip.title}</p>
									<p className='text-xs text-muted'>{label}</p>
								</div>
							</li>
						);
					})}
				</ul>
				{reconnect ? (
					<Link href='/dashboard/settings?tab=connections' target='_blank' rel='noopener noreferrer'>
						Reconnect Twitch (opens in a new tab)
					</Link>
				) : null}
				{!pending(batch) && batch.status !== "cancelled" && (batch.error || failures?.length) && retry.length ? (
					<Button variant='secondary' isDisabled={Boolean(batch.retryAt && Date.parse(batch.retryAt) > now)} onPress={() => enqueue({ ...batch.request, clipIds: retry })}>
						Retry failed clips
					</Button>
				) : null}
				{reconnect ? (
					<Button variant='secondary' onPress={() => enqueue({ ...batch.request, clipIds: reconnectIds })}>
						Retry after reconnect
					</Button>
				) : null}
				{batch.status === "completed" ? (
					<Button
						variant='secondary'
						onPress={() => {
							if (batch.downloadUrl) {
								const link = document.createElement("a");
								link.href = batch.downloadUrl;
								link.download = batch.request.format === "mp4" ? `clipify-${encodeURIComponent(batch.request.clipIds[0])}.mp4` : `clipify-clips-batch-${batch.id}.zip`;
								document.body.append(link);
								link.click();
								link.remove();
							} else enqueue(batch.request);
						}}
					>
						{batch.downloadUrl ? `Save ${batch.request.format.toUpperCase()}` : "Export batch again"}
					</Button>
				) : null}
				{pending(batch) ? (
					<Button variant='secondary' onPress={() => cancel(batch)}>
						Cancel export
					</Button>
				) : null}
				{batch.retryAt && Date.parse(batch.retryAt) > now && batch.status !== "waiting" ? (
					<p className='text-sm text-muted'>
						Please wait until <LocalizedDate value={batch.retryAt} showTime /> before retrying.
					</p>
				) : null}
			</div>
		);
	};
	return (
		<ExportContext.Provider value={{ batches, enqueue, show: () => changeOpen(true) }}>
			{children}
			<ControlledModal isOpen={open} onClose={() => changeOpen(false)} size='lg'>
				<Modal.Header>
					<Modal.Heading>Clip exports</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='max-h-[60dvh] space-y-6 overflow-y-auto'>
					<p className='text-sm text-muted'>Up to 50 clips per minute. Keep Clipify open while exporting. Downloads start as each batch finishes; your browser may ask to allow multiple downloads.</p>
					{current.map((batch) => (
						<section key={batch.id} aria-label={`Batch ${batch.id}`} className='space-y-4'>
							{batch.status === "queued" ? (
								<div className='flex items-center justify-between gap-3'>
									<p className='text-sm'>
										Batch {batch.id}, {batch.request.clipIds.length} {batch.request.clipIds.length === 1 ? "clip" : "clips"} queued
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
								<Disclosure key={batch.id} isExpanded={expanded.includes(batch.id)} onExpandedChange={(value) => setExpanded((ids) => (value ? [...ids, batch.id] : ids.filter((id) => id !== batch.id)))}>
									<Disclosure.Heading>
										<Disclosure.Trigger>
											Batch {batch.id}, {batch.status}, {batch.request.clipIds.length} {batch.request.clipIds.length === 1 ? "clip" : "clips"}
											<Disclosure.Indicator />
										</Disclosure.Trigger>
									</Disclosure.Heading>
									<Disclosure.Content>{expanded.includes(batch.id) ? view(batch) : null}</Disclosure.Content>
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
		<Button variant='ghost' isIconOnly={compact} aria-label='Exports' onPress={context.show} className={compact ? "" : "w-full justify-start text-sm text-muted"}>
			{count ? <Spinner size='sm' /> : <IconDownload className='size-4' />}
			{compact ? null : <>Exports {count ? `(${count})` : null}</>}
		</Button>
	);
}
