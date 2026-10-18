import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { runnersTable, overlaysTable } from "@/db/schema";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { getRunnerBrandingProfileForPrincipal, readRunnerNextBroadcastInternal } from "@/server/runner/branding-profiles";
import { getOverlayRuntimeAccessInternal } from "@/server/overlays";
import { resolveRunnerPresentationPolicy } from "@/server/runner/branding";
import RunnerGeneratedPresentation from "@/app/components/runnerGeneratedPresentation";
import { readOwnedRunnerBrandingAsset } from "@/server/runner/branding-assets";
import OverlayPlayer from "@/app/components/overlayPlayer";

export default async function RunnerAppearancePreview({ params, searchParams }: { params: Promise<{ runnerId: string }>; searchParams: Promise<{ overlayId?: string; watermarkCorner?: string; proShowAttribution?: string; standbyBackgroundColor?: string; backgroundAssetId?: string; logoAssetId?: string; message?: string; showNextBroadcastTime?: string; previewMode?: string }> }) {
	const principal = await getVerifiedSessionPrincipal();
	const { runnerId } = await params;
	if (!principal || !z.uuid().safeParse(runnerId).success) return <p>Preview unavailable.</p>;
	const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.id, runnerId), columns: { id: true, ownerId: true } });
	if (!runner) return <p>Preview unavailable.</p>;
	const result = await getRunnerBrandingProfileForPrincipal(principal, { ownerId: runner.ownerId, runnerId });
	if (!result.success) return <p>Preview unavailable.</p>;
	const { overlayId, watermarkCorner, proShowAttribution, standbyBackgroundColor, backgroundAssetId, logoAssetId, message, showNextBroadcastTime, previewMode } = await searchParams;
	const playbackPreview = previewMode === "playback";
	const draftColor = z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.safeParse(standbyBackgroundColor);
	const draftAttribution = z.enum(["true", "false"]).safeParse(proShowAttribution);
	const draftCorner = z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]).safeParse(watermarkCorner);
	if (!z.uuid().safeParse(overlayId).success) return <p>Select an overlay to preview your appearance.</p>;
	const source = await db.query.overlaysTable.findFirst({ where: and(eq(overlaysTable.id, overlayId!), eq(overlaysTable.ownerId, runner.ownerId)) });
	if (!source) return <p>Preview unavailable.</p>;
	const access = await getOverlayRuntimeAccessInternal(source.id, "websocket", source.secret);
	if (!access.allowed || access.overlay.ownerId !== runner.ownerId) return <p>Preview unavailable.</p>;
	const draftAsset = z
		.union([z.uuid(), z.literal("")])
		.transform((value) => value || null)
		.safeParse(backgroundAssetId);
	const assetId = result.runnerPro && draftAsset.success ? draftAsset.data : result.profile.backgroundAssetId;
	const backgroundAsset = assetId ? await readOwnedRunnerBrandingAsset(runner.ownerId, assetId, "background") : null;
	const draftNext = z.enum(["true", "false"]).safeParse(showNextBroadcastTime);
	const nextBroadcast = result.runnerPro && (draftNext.success ? draftNext.data === "true" : result.profile.showNextBroadcastTime) ? await readRunnerNextBroadcastInternal({ ownerId: runner.ownerId, runnerId }) : null;
	const draftMessage = z.string().max(160).safeParse(message);
	const draftLogo = z
		.union([z.uuid(), z.literal("")])
		.transform((value) => value || null)
		.safeParse(logoAssetId);
	const logoId = result.runnerPro && draftLogo.success ? draftLogo.data : result.profile.logoAssetId;
	const logoAsset = logoId ? await readOwnedRunnerBrandingAsset(runner.ownerId, logoId, "logo") : null;
	return (
		<RunnerGeneratedPresentation
			runnerPro={result.runnerPro}
			standbyNextBroadcast={nextBroadcast}
			standbyMessage={result.runnerPro && draftMessage.success ? draftMessage.data : result.profile.message}
			standbyLogoUrl={logoAsset ? `/runner/preview/${runnerId}/assets/${logoAsset.id}?kind=logo` : undefined}
			standbyBackgroundImageUrl={backgroundAsset ? `/runner/preview/${runnerId}/assets/${backgroundAsset.id}` : undefined}
			standbyBackgroundColor={result.runnerPro && draftColor.success ? draftColor.data : result.profile.standbyBackgroundColor}
			knownPaidUntil={result.validUntil ?? null}
			attributionRequired={resolveRunnerPresentationPolicy({ runnerPro: result.runnerPro, validUntil: result.validUntil }, "generated_standby", { proShowAttribution: result.runnerPro && draftAttribution.success ? draftAttribution.data === "true" : result.profile.proShowAttribution }).attributionRequired}
			executionGeneration={`preview-${runnerId}`}
			watermarkCorner={draftCorner.success ? draftCorner.data : result.profile.watermarkCorner}
		>
			<OverlayPlayer runnerPresentation overlay={access.overlay} overlaySecret={source.secret} initialStandby={!playbackPreview} isEmbed showEmbedOverlay embedMuted embedAutoplay={playbackPreview} />
		</RunnerGeneratedPresentation>
	);
}
