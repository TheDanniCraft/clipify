"use client";
import { useState } from "react";
import ClipExportSettings from "./clipExportSettings";
import { Button } from "@heroui/react";
import type { ClipLayout } from "@lib/clipLayout";
import { ClipExportProvider, useClipExports, type ExportRequest } from "./clipExportQueue";
export default function ClipExport({ creatorId, clipIds, scope, format = "zip", layout, clipNames, configure = false, label, variant = "primary" }: { creatorId: string; clipIds: string[]; scope: string; format?: "zip" | "mp4"; layout?: ClipLayout; clipNames?: Record<string, string>; configure?: boolean; label?: string; variant?: "primary" | "secondary" }) {
	const context = useClipExports();
	const [settingsOpen, setSettingsOpen] = useState(false);
	if (!context)
		return (
			<ClipExportProvider key={creatorId} creatorId={creatorId}>
				<ClipExport creatorId={creatorId} clipIds={clipIds} scope={scope} format={format} layout={layout} clipNames={clipNames} configure={configure} label={label} variant={variant} />
			</ClipExportProvider>
		);
	const request: ExportRequest = { creatorId, clipIds, scope, format, layout, clipNames };
	const key = JSON.stringify([scope, clipIds, format, layout]);
	const pending = context.batches.some((batch) => ["queued", "waiting", "processing"].includes(batch.status) && batch.group === key);
	return (
		<section aria-label='Clip export'>
			<Button variant={variant} isDisabled={!clipIds.length || clipIds.length > 500 || (!configure && format === "mp4" && clipIds.length !== 1) || (!configure && pending)} onPress={() => (configure ? setSettingsOpen(true) : context.enqueue(request))}>
				{label ?? (layout ? (format === "mp4" ? "Download portrait" : "Export portrait clips") : format === "mp4" ? "Download original" : "Export selected")}
			</Button>
			{settingsOpen ? <ClipExportSettings creatorId={creatorId} clipIds={clipIds} onClose={() => setSettingsOpen(false)} onStart={(plans) => context.enqueuePlans(plans, clipNames, scope)} /> : null}
		</section>
	);
}
