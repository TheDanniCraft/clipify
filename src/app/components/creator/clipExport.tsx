"use client";
import type { ClipLayout } from "@lib/clipLayout";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Link, Modal } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import { notify } from "@lib/toast";
import LocalizedDate from "@components/localizedDate";
import { decodeClipExportError, decodeClipExportSummary, readBoundedResponse, type ClipExportSummary } from "@lib/clipExport";
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
type Result = { scope: string; submitted: string[]; summary?: ClipExportSummary; failures?: ClipExportSummary["skipped"]; error?: string; retryAt?: string };
export default function ClipExport({ creatorId, clipIds, scope, format = "zip", layout }: { creatorId: string; clipIds: string[]; scope: string; layout?: ClipLayout; format?: "zip" | "mp4" }) {
	const [busy, setBusy] = useState(false);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const [result, setResult] = useState<Result>();
	const controller = useRef<AbortController | null>(null);
	const blobUrl = useRef<string | null>(null);
	const context = useRef(scope);
	useLayoutEffect(() => {
		context.current = scope;
		return () => {
			context.current = "";
			controller.current?.abort();
			if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
		};
	}, [creatorId, scope]);
	const current = result?.scope === scope ? result : undefined;
	useEffect(() => {
		if (!current?.retryAt || Date.parse(current.retryAt) <= Date.now()) return;
		const deadline = Date.parse(current.retryAt);
		const timer = setInterval(() => {
			const time = Date.now();
			setNow(time);
			if (time >= deadline) clearInterval(timer);
		}, 1000);
		return () => clearInterval(timer);
	}, [current?.retryAt]);
	const exportClips = async (ids: string[]) => {
		if (!ids.length || ids.length > 50) return;
		const submitted = [...new Set(ids)];
		const requestScope = scope;
		const finish = (value: Result) => {
			if (context.current !== requestScope) return;
			setNow(Date.now());
			setResult(value);
			const failed = Boolean(value.error && value.error !== "CANCELLED");
			const partial = Boolean(value.summary?.skipped.length);
			setDetailsOpen(failed || partial);
			notify({ title: value.error === "CANCELLED" ? "Export cancelled. Your selection is kept." : failed ? (messages[value.error!] ?? "Download could not be prepared.") : partial ? "Download started with skipped clips" : "Download started", description: failed || partial ? "Review the download details to continue." : undefined, color: failed ? "danger" : partial ? "warning" : value.error === "CANCELLED" ? "default" : "success" });
		};
		controller.current?.abort();
		const abort = new AbortController();
		controller.current = abort;
		setBusy(true);
		setResult(undefined);
		try {
			const response = await fetch(format === "mp4" ? "/api/clips/export?format=mp4" : "/api/clips/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId, clipIds: submitted, ...(layout ? { layout } : {}) }), signal: abort.signal });
			if (!response.ok) {
				const failure = decodeClipExportError(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 65536, abort.signal))), submitted.length);
				finish({ scope: requestScope, submitted, error: failure.code, retryAt: failure.retryAt, failures: failure.failures });
				return;
			}
			const contentType = format === "mp4" ? "video/mp4" : "application/zip";
			if (!response.headers.get("content-type")?.startsWith(contentType)) throw new Error("invalid_response");
			const summary = decodeClipExportSummary(response.headers.get("X-Clipify-Export-Result"), submitted.length);
			const bytes = await readBoundedResponse(response, (format === "mp4" ? 32 : 130) * 1024 * 1024, abort.signal);
			const archive = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			if (format === "mp4" ? bytes.length < 8 || archive.getUint32(4) !== 0x66747970 : bytes.length < 22 || archive.getUint32(0) !== 0x504b0304 || archive.getUint32(bytes.length - 22) !== 0x504b0506) throw new Error("invalid_response");
			if (abort.signal.aborted || context.current !== requestScope) return;
			if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
			const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
			blobUrl.current = url;
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = format === "mp4" ? `clipify-${encodeURIComponent(submitted[0])}.mp4` : `clipify-clips-${new Date().toISOString().slice(0, 10)}.zip`;
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			finish({ scope: requestScope, submitted, summary, retryAt: summary.retryAt });
			setTimeout(() => {
				URL.revokeObjectURL(url);
				if (blobUrl.current === url) blobUrl.current = null;
			}, 60000);
		} catch (error) {
			finish({ scope: requestScope, submitted, error: abort.signal.aborted ? "CANCELLED" : error instanceof Error && error.message === "invalid_response" ? "invalid_response" : "SERVICE_UNAVAILABLE" });
		} finally {
			if (controller.current === abort) setBusy(false);
		}
	};
	const failures = current?.summary?.skipped ?? current?.failures;
	const retryIds = failures ? failures.filter((item) => item.retryable && ["provider_error", "download_timeout", "rate_limited", "render_busy", "render_failed"].includes(item.code)).map((item) => current!.submitted[item.index]) : current?.error && ["RATE_LIMITED", "PROVIDER_UNAVAILABLE", "EXPORT_TIMEOUT", "SERVICE_UNAVAILABLE", "invalid_response", "CANCELLED"].includes(current.error) ? current.submitted : [];
	const reconnectIds = failures ? failures.filter((item) => item.code === "reconnect_required").map((item) => current!.submitted[item.index]) : current?.error === "RECONNECT_REQUIRED" ? current.submitted : [];
	const reconnect = reconnectIds.length > 0;
	return (
		<section className='flex flex-col gap-3' aria-label='Clip export'>
			<div className='flex flex-wrap items-center gap-3'>
				<Button isDisabled={!clipIds.length || busy} onPress={() => void exportClips(clipIds)}>
					{busy ? "Preparing download…" : layout ? (format === "mp4" ? "Download portrait" : "Export portrait clips") : format === "mp4" ? "Download original" : "Export selected"}
				</Button>
				{busy ? (
					<Button variant='secondary' onPress={() => controller.current?.abort()}>
						Cancel export
					</Button>
				) : null}
				<Button variant='ghost' isDisabled={!current || busy} onPress={() => setDetailsOpen(true)}>
					{format === "mp4" ? "Download details" : "Export details"}
				</Button>
				{clipIds.length && format === "zip" ? <p className='text-xs text-muted'>Up to 50 clips, 32 MiB per clip and 128 MiB per package.</p> : null}
			</div>
			<ControlledModal isOpen={Boolean(current && detailsOpen)} onClose={() => setDetailsOpen(false)} size='lg'>
				<Modal.Header>
					<Modal.Heading>{format === "mp4" ? "Download details" : "Export details"}</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='max-h-[60dvh] overflow-y-auto break-words'>
					{current ? (
						<div role={current.error && current.error !== "CANCELLED" ? "alert" : "status"} className='min-w-0'>
							{current.summary ? (
								<p>
									{current.summary.included.length} {current.summary.included.length === 1 ? "clip" : "clips"} ready. Download initiated.{current.summary.skipped.length ? ` ${current.summary.skipped.length} ${current.summary.skipped.length === 1 ? "clip was" : "clips were"} skipped.` : ""}
								</p>
							) : (
								<p>{current.error === "CANCELLED" ? "Export cancelled. Your selection is kept." : (messages[current.error ?? ""] ?? "The export could not be prepared. Please try again.")}</p>
							)}
							{failures?.length ? (
								<ul className='my-2 text-sm'>
									{failures.map((item) => (
										<li key={item.index}>
											{item.title || `Clip ${item.index + 1}`}: {reasons[item.code]}
										</li>
									))}
								</ul>
							) : null}
							{reconnect ? (
								<Link href='/dashboard/settings?tab=connections' target='_blank' rel='noopener noreferrer'>
									Reconnect Twitch (opens in a new tab)
								</Link>
							) : null}
							{retryIds.length && (current.error || current.summary?.skipped.length) ? (
								<Button variant='secondary' className='mt-2' isDisabled={busy || Boolean(current.retryAt && Date.parse(current.retryAt) > now)} onPress={() => void exportClips(retryIds)}>
									Retry failed clips
								</Button>
							) : null}
							{reconnect ? (
								<Button variant='secondary' className='mt-2' isDisabled={busy} onPress={() => void exportClips(reconnectIds)}>
									Retry after reconnect
								</Button>
							) : null}
							{current.retryAt && Date.parse(current.retryAt) > now ? (
								<p className='mt-2 text-sm text-muted'>
									Please wait until <LocalizedDate value={current.retryAt} showTime /> before retrying.
								</p>
							) : null}
						</div>
					) : null}
				</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onPress={() => setDetailsOpen(false)}>
						Close details
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</section>
	);
}
