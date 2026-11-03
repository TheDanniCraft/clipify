"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Link } from "@heroui/react";
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
const reasons: Record<string, string> = { clip_unavailable: "Clip unavailable", download_unavailable: "Download unavailable", file_size_limit: "Clip exceeds 32 MiB", package_size_limit: "Package exceeds 128 MiB", invalid_media: "Twitch returned an incomplete video", provider_error: "Twitch download failed", download_timeout: "Download timed out", rate_limited: "Twitch download limit reached", reconnect_required: "Reconnect Twitch" };
type Result = { scope: string; submitted: string[]; summary?: ClipExportSummary; failures?: ClipExportSummary["skipped"]; error?: string; retryAt?: string };
export default function ClipExport({ creatorId, clipIds, scope }: { creatorId: string; clipIds: string[]; scope: string }) {
	const [busy, setBusy] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const [result, setResult] = useState<Result>();
	const controller = useRef<AbortController | null>(null);
	const blobUrl = useRef<string | null>(null);
	const context = useRef(scope);
	useLayoutEffect(() => {
		context.current = scope;
		return () => {
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
		controller.current?.abort();
		const abort = new AbortController();
		controller.current = abort;
		setBusy(true);
		setResult(undefined);
		try {
			const response = await fetch("/api/clips/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId, clipIds: submitted }), signal: abort.signal });
			if (!response.ok) {
				const failure = decodeClipExportError(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 65536, abort.signal))), submitted.length);
				if (context.current === requestScope) {
					setNow(Date.now());
					setResult({ scope: requestScope, submitted, error: failure.code, retryAt: failure.retryAt, failures: failure.failures });
				}
				return;
			}
			if (!response.headers.get("content-type")?.startsWith("application/zip")) throw new Error("invalid_response");
			const summary = decodeClipExportSummary(response.headers.get("X-Clipify-Export-Result"), submitted.length);
			const bytes = await readBoundedResponse(response, 130 * 1024 * 1024, abort.signal);
			const archive = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			if (bytes.length < 22 || archive.getUint32(0) !== 0x504b0304 || archive.getUint32(bytes.length - 22) !== 0x504b0506) throw new Error("invalid_response");
			if (abort.signal.aborted || context.current !== requestScope) return;
			if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
			const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
			blobUrl.current = url;
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `clipify-clips-${new Date().toISOString().slice(0, 10)}.zip`;
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			setNow(Date.now());
			setResult({ scope: requestScope, submitted, summary, retryAt: summary.retryAt });
			setTimeout(() => {
				URL.revokeObjectURL(url);
				if (blobUrl.current === url) blobUrl.current = null;
			}, 60000);
		} catch (error) {
			if (context.current === requestScope) setResult({ scope: requestScope, submitted, error: abort.signal.aborted ? "CANCELLED" : error instanceof Error && error.message === "invalid_response" ? "invalid_response" : "SERVICE_UNAVAILABLE" });
		} finally {
			if (controller.current === abort) setBusy(false);
		}
	};
	const failures = current?.summary?.skipped ?? current?.failures;
	const retryIds = failures ? failures.filter((item) => item.retryable && ["provider_error", "download_timeout", "rate_limited"].includes(item.code)).map((item) => current!.submitted[item.index]) : current?.error && ["RATE_LIMITED", "PROVIDER_UNAVAILABLE", "EXPORT_TIMEOUT", "SERVICE_UNAVAILABLE", "invalid_response", "CANCELLED"].includes(current.error) ? current.submitted : [];
	const reconnectIds = failures ? failures.filter((item) => item.code === "reconnect_required").map((item) => current!.submitted[item.index]) : current?.error === "RECONNECT_REQUIRED" ? current.submitted : [];
	const reconnect = reconnectIds.length > 0;
	return (
		<section className='flex flex-col gap-3' aria-label='Clip export'>
			<div className='flex flex-wrap items-center gap-3'>
				<Button isDisabled={!clipIds.length || busy} onPress={() => void exportClips(clipIds)}>
					{busy ? "Preparing export…" : "Export selected"}
				</Button>
				{busy ? (
					<Button variant='secondary' onPress={() => controller.current?.abort()}>
						Cancel export
					</Button>
				) : null}
				<p className='text-xs text-muted'>Up to 50 clips, 32 MiB per clip and 128 MiB per package.</p>
			</div>
			{current ? (
				<div role={current.error && current.error !== "CANCELLED" ? "alert" : "status"} className='rounded-xl border border-default p-4'>
					{current.summary ? (
						<p>
							{current.summary.included.length} clips ready. Download initiated.{current.summary.skipped.length ? ` ${current.summary.skipped.length} clips were skipped.` : ""}
						</p>
					) : (
						<p>{current.error === "CANCELLED" ? "Export cancelled. Your selection is kept." : (messages[current.error ?? ""] ?? "The export could not be prepared. Please try again.")}</p>
					)}
					{failures?.length ? (
						<ul className='my-2 text-sm'>
							{failures.map((item) => (
								<li key={item.index}>
									{current.submitted[item.index]}: {reasons[item.code]}
								</li>
							))}
						</ul>
					) : null}
					{reconnect ? (
						<Link href='/dashboard/settings' target='_blank' rel='noopener noreferrer'>
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
		</section>
	);
}
