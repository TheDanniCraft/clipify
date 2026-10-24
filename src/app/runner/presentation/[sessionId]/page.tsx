import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { overlaysTable } from "@/db/schema";
import { getOverlayRuntimeAccessInternal } from "@/server/overlays";
import { RUNNER_PRESENTATION_COOKIE, verifyRunnerPresentationIdentity, resolveRunnerPresentationExecution } from "@/server/runner/presentation";
import { resolveRunnerPresentationPolicy } from "@/server/runner/branding";
import { readRunnerBrandingProfileInternal, readRunnerNextBroadcastInternal } from "@/server/runner/branding-profiles";
import OverlayPlayer from "@/app/components/overlayPlayer";
import RunnerGeneratedPresentation from "@/app/components/runnerGeneratedPresentation";
import { OBS_ACTIVITY_BOOTSTRAP } from "@/app/lib/overlayPresence";

function UnavailablePresentation() {
	return (
		<main className='flex h-screen w-screen items-center justify-center bg-black text-white' data-runner-presentation-error='unavailable'>
			Runner presentation is unavailable. Reconnect the Runner and try again.
		</main>
	);
}

export default async function RunnerPresentation({ params }: { params: Promise<{ sessionId: string }> }) {
	const { sessionId } = await params;
	const jar = await cookies();
	const identity = verifyRunnerPresentationIdentity(jar.get(RUNNER_PRESENTATION_COOKIE)?.value, sessionId);
	if (!identity) return <UnavailablePresentation />;
	const execution = await resolveRunnerPresentationExecution(identity);
	if (!execution) return <UnavailablePresentation />;
	const capturedSource = execution.admission.benefitsAtStart.sourceIdAtStart;
	const sourceId = capturedSource === undefined ? execution.session.overlayId : capturedSource;
	if (!z.uuid().safeParse(sourceId).success) return <UnavailablePresentation />;
	const source = await db.query.overlaysTable.findFirst({ where: and(eq(overlaysTable.id, String(sourceId)), eq(overlaysTable.ownerId, identity.ownerId)) });
	if (!source || source.ownerId !== identity.ownerId) return <UnavailablePresentation />;
	const access = await getOverlayRuntimeAccessInternal(source.id, "websocket", source.secret);
	if (!access.allowed || access.overlay.ownerId !== identity.ownerId) return <UnavailablePresentation />;
	const profile = await readRunnerBrandingProfileInternal({ ownerId: identity.ownerId, runnerId: identity.runnerId });
	const nextBroadcast = profile.showNextBroadcastTime && execution.admission.benefitsAtStart.runnerPro === true ? await readRunnerNextBroadcastInternal({ ownerId: identity.ownerId, runnerId: identity.runnerId }) : null;
	const knownPaidUntil = execution.admission.benefitsAtStart.validUntil;
	const policy = resolveRunnerPresentationPolicy({ runnerPro: execution.admission.benefitsAtStart.runnerPro === true, validUntil: knownPaidUntil }, "generated_standby", profile);
	return (
		<>
			<script dangerouslySetInnerHTML={{ __html: OBS_ACTIVITY_BOOTSTRAP }} />
			<RunnerGeneratedPresentation
				standbyNextBroadcast={nextBroadcast}
				standbyMessage={profile.message}
				standbyLogoUrl={profile.logoAssetId ? `/runner/presentation/${identity.sessionId}/assets/${profile.logoAssetId}` : undefined}
				standbyBackgroundImageUrl={profile.backgroundAssetId ? `/runner/presentation/${identity.sessionId}/assets/${profile.backgroundAssetId}` : undefined}
				runnerPro={execution.admission.benefitsAtStart.runnerPro === true}
				standbyBackgroundColor={profile.standbyBackgroundColor}
				policyUrl={`/runner/presentation/${identity.sessionId}/policy`}
				knownPaidUntil={typeof knownPaidUntil === "string" ? knownPaidUntil : null}
				attributionRequired={policy.attributionRequired}
				executionGeneration={identity.executionGeneration}
				watermarkCorner={profile.watermarkCorner}
			>
				<OverlayPlayer runnerPresentation overlay={access.overlay} overlaySecret={source.secret} initialStandby />
			</RunnerGeneratedPresentation>
		</>
	);
}
