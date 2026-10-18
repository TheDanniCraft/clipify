import { cookies } from "next/headers";
import { RUNNER_PRESENTATION_COOKIE, verifyRunnerPresentationIdentity, resolveRunnerPresentationExecution } from "@/server/runner/presentation";
import { readRunnerBrandingProfileInternal } from "@/server/runner/branding-profiles";
import { readOwnedRunnerBrandingAsset, runnerAssetResponse } from "@/server/runner/branding-assets";
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string; assetId: string }> }) {
	const { sessionId, assetId } = await params;
	const jar = await cookies();
	const identity = verifyRunnerPresentationIdentity(jar.get(RUNNER_PRESENTATION_COOKIE)?.value, sessionId);
	if (!identity || !(await resolveRunnerPresentationExecution(identity))) return new Response(null, { status: 404 });
	const profile = await readRunnerBrandingProfileInternal({ ownerId: identity.ownerId, runnerId: identity.runnerId });
	const kind = profile.logoAssetId === assetId ? "logo" : profile.backgroundAssetId === assetId ? "background" : null;
	if (!kind) return new Response(null, { status: 404 });
	const asset = await readOwnedRunnerBrandingAsset(identity.ownerId, assetId, kind);
	return asset ? runnerAssetResponse(asset) : new Response(null, { status: 404 });
}
