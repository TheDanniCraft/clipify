"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import type { Overlay } from "@types";
import type { RunnerNextBroadcast } from "@/app/lib/runnerStandby";
import RunnerGeneratedPresentation from "../runnerGeneratedPresentation";
import OverlayPlayer from "../overlayPlayer";

const draftSchema = z.object({ watermarkCorner: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]), proShowAttribution: z.boolean(), standbyBackgroundColor: z.string().regex(/^#[a-fA-F0-9]{6}$/), backgroundAssetId: z.uuid().nullable(), logoAssetId: z.uuid().nullable(), message: z.string().max(160), showNextBroadcastTime: z.boolean(), previewMode: z.enum(["standby", "playback"]) }).strict();
type Draft = z.infer<typeof draftSchema>;
export default function AppearancePreview({ runnerId, overlay, overlaySecret, runnerPro, validUntil, initial, nextBroadcast }: { runnerId: string; overlay: Overlay; overlaySecret: string; runnerPro: boolean; validUntil: string | null; initial: Draft; nextBroadcast: RunnerNextBroadcast | null }) {
	const [draft, setDraft] = useState(initial);
	const [acknowledged, setAcknowledged] = useState("");
	useEffect(() => {
		let first = 0,
			second = 0;
		const receive = (event: MessageEvent) => {
			if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "clipify:runner-preview" || event.data.runnerId !== runnerId) return;
			const parsed = draftSchema.safeParse(event.data.draft);
			if (!parsed.success || event.data.revision !== JSON.stringify(parsed.data)) return;
			setDraft(parsed.data);
			setAcknowledged("");
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
			first = requestAnimationFrame(() => {
				second = requestAnimationFrame(() => setAcknowledged(JSON.stringify(parsed.data)));
			});
		};
		window.addEventListener("message", receive);
		window.parent.postMessage({ type: "clipify:runner-preview-ready", runnerId }, location.origin);
		return () => {
			window.removeEventListener("message", receive);
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	}, [runnerId]);
	const paid = runnerPro;
	return (
		<div data-runner-preview-revision={acknowledged}>
			<RunnerGeneratedPresentation
				attributionRequired={!paid || draft.proShowAttribution}
				executionGeneration={`preview-${runnerId}`}
				runnerPro={runnerPro}
				knownPaidUntil={validUntil}
				watermarkCorner={draft.watermarkCorner}
				standbyBackgroundColor={paid ? draft.standbyBackgroundColor : undefined}
				standbyMessage={paid ? draft.message : undefined}
				standbyLogoUrl={paid && draft.logoAssetId ? `/runner/preview/${runnerId}/assets/${draft.logoAssetId}?kind=logo` : undefined}
				standbyBackgroundImageUrl={paid && draft.backgroundAssetId ? `/runner/preview/${runnerId}/assets/${draft.backgroundAssetId}` : undefined}
				standbyNextBroadcast={paid && draft.showNextBroadcastTime ? nextBroadcast : null}
			>
				<OverlayPlayer key={draft.previewMode} runnerPresentation overlay={overlay} overlaySecret={overlaySecret} initialStandby={draft.previewMode === "standby"} isEmbed showEmbedOverlay embedMuted embedAutoplay={draft.previewMode === "playback"} />
			</RunnerGeneratedPresentation>
		</div>
	);
}
