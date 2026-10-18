import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { runnersTable, overlaysTable } from "@/db/schema";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { getRunnerBrandingProfileForPrincipal, readRunnerNextBroadcastInternal } from "@/server/runner/branding-profiles";
import { getOverlayRuntimeAccessInternal } from "@/server/overlays";

import AppearancePreview from "@/app/components/runner/AppearancePreview";

export default async function RunnerAppearancePreview({ params, searchParams }: { params: Promise<{ runnerId: string }>; searchParams: Promise<{ overlayId?: string }> }) {
	const principal = await getVerifiedSessionPrincipal();
	const { runnerId } = await params;
	if (!principal || !z.uuid().safeParse(runnerId).success) return <p>Preview unavailable.</p>;
	const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.id, runnerId), columns: { id: true, ownerId: true } });
	if (!runner) return <p>Preview unavailable.</p>;
	const result = await getRunnerBrandingProfileForPrincipal(principal, { ownerId: runner.ownerId, runnerId });
	if (!result.success) return <p>Preview unavailable.</p>;
	const { overlayId } = await searchParams;
	if (!z.uuid().safeParse(overlayId).success) return <p>Select an overlay to preview your appearance.</p>;
	const source = await db.query.overlaysTable.findFirst({ where: and(eq(overlaysTable.id, overlayId!), eq(overlaysTable.ownerId, runner.ownerId)) });
	if (!source) return <p>Preview unavailable.</p>;
	const access = await getOverlayRuntimeAccessInternal(source.id, "websocket", source.secret);
	if (!access.allowed || access.overlay.ownerId !== runner.ownerId) return <p>Preview unavailable.</p>;
	const nextBroadcast = result.runnerPro ? await readRunnerNextBroadcastInternal({ ownerId: runner.ownerId, runnerId }) : null;
	return (
		<AppearancePreview
			runnerId={runnerId}
			overlay={access.overlay}
			overlaySecret={source.secret}
			runnerPro={result.runnerPro}
			validUntil={result.validUntil ?? null}
			nextBroadcast={nextBroadcast}
			initial={{ watermarkCorner: result.profile.watermarkCorner, proShowAttribution: result.profile.proShowAttribution, standbyBackgroundColor: result.profile.standbyBackgroundColor, backgroundAssetId: result.profile.backgroundAssetId, logoAssetId: result.profile.logoAssetId, message: result.profile.message, showNextBroadcastTime: result.profile.showNextBroadcastTime, previewMode: "standby" }}
		/>
	);
}
