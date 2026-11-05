"use client";
import { Button } from "@heroui/react";
import type { ClipLayout } from "@lib/clipLayout";
import { ClipExportProvider, useClipExports, type ExportRequest } from "./clipExportQueue";
export default function ClipExport({ creatorId, clipIds, scope, format = "zip", layout, clipNames }: { creatorId: string; clipIds: string[]; scope: string; format?: "zip" | "mp4"; layout?: ClipLayout; clipNames?: Record<string, string> }) {
	const context = useClipExports();
	if (!context)
		return (
			<ClipExportProvider key={creatorId} creatorId={creatorId}>
				<ClipExport creatorId={creatorId} clipIds={clipIds} scope={scope} format={format} layout={layout} clipNames={clipNames} />
			</ClipExportProvider>
		);
	const request: ExportRequest = { creatorId, clipIds, scope, format, layout, clipNames };
	const key = JSON.stringify([scope, clipIds, format, layout]);
	const pending = context.batches.some((batch) => ["queued", "waiting", "processing"].includes(batch.status) && batch.group === key);
	return (
		<section aria-label='Clip export'>
			<Button isDisabled={!clipIds.length || clipIds.length > 500 || (format === "mp4" && clipIds.length !== 1) || pending} onPress={() => context.enqueue(request)}>
				{layout ? (format === "mp4" ? "Download portrait" : "Export portrait clips") : format === "mp4" ? "Download original" : "Export selected"}
			</Button>
		</section>
	);
}
