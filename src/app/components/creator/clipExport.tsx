"use client";
import { useState } from "react";
import ClipExportSettings from "./clipExportSettings";
import { notify } from "@lib/toast";
import { Button } from "@heroui/react";
import type { ClipLayout } from "@lib/clipLayout";
import { ClipExportProvider, useClipExports, clipExportRequestKey, type ExportRequest } from "./clipExportQueue";
export default function ClipExport({
	creatorId,
	clipIds,
	scope,
	format = "zip",
	layout,
	clipNames,
	configure = false,
	label,
	variant = "primary",
	prepareSelection,
	isDisabled = false,
}: {
	creatorId: string;
	clipIds: string[];
	scope: string;
	format?: "zip" | "mp4";
	layout?: ClipLayout;
	clipNames?: Record<string, string>;
	configure?: boolean;
	label?: string;
	variant?: "primary" | "secondary";
	isDisabled?: boolean;
	prepareSelection?: () => Promise<Pick<ExportRequest, "clipIds" | "clipNames"> | undefined>;
}) {
	const context = useClipExports();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [prepared, setPrepared] = useState<Pick<ExportRequest, "clipIds" | "clipNames">>();
	const [preparing, setPreparing] = useState(false);
	if (!context)
		return (
			<ClipExportProvider key={creatorId} creatorId={creatorId}>
				<ClipExport creatorId={creatorId} clipIds={clipIds} scope={scope} format={format} layout={layout} clipNames={clipNames} configure={configure} label={label} variant={variant} prepareSelection={prepareSelection} isDisabled={isDisabled} />
			</ClipExportProvider>
		);
	const selection = settingsOpen && prepared ? prepared : { clipIds, clipNames };
	const request: ExportRequest = { creatorId, ...selection, scope, format, layout };
	const key = clipExportRequestKey(request);
	const pending = context.batches.some((batch) => ["queued", "waiting", "processing"].includes(batch.status) && batch.group === key);
	return (
		<section aria-label={label ?? "Clip export"}>
			<Button
				data-tour='export-selected'
				variant={variant}
				isPending={preparing}
				isDisabled={isDisabled || !clipIds.length || (!configure && format === "mp4" && clipIds.length !== 1) || (!configure && pending)}
				onPress={async () => {
					if (!configure) {
						context.enqueue(request);
						return;
					}
					if (!prepareSelection) {
						setPrepared(undefined);
						setSettingsOpen(true);
						return;
					}
					setPreparing(true);
					try {
						const next = await prepareSelection();
						if (next?.clipIds.length) {
							setPrepared(next);
							setSettingsOpen(true);
						} else if (next) {
							notify({ title: "No clips match these filters.", color: "default" });
						}
					} catch {
						notify({ title: "Matching clips could not be loaded. Please try again.", color: "danger" });
					} finally {
						setPreparing(false);
					}
				}}
			>
				{label ?? (layout ? (format === "mp4" ? "Download portrait" : "Export portrait clips") : format === "mp4" ? "Download original" : "Export selected")}
			</Button>
			{settingsOpen ? <ClipExportSettings creatorId={creatorId} clipIds={selection.clipIds} onClose={() => setSettingsOpen(false)} onStart={(plans, engine) => context.enqueuePlans(plans, selection.clipNames, scope, engine)} /> : null}
		</section>
	);
}
