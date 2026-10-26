import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { RUNNER_PRESENTATION_COOKIE, RUNNER_PRESENTATION_TTL_SECONDS, signRunnerPresentationIdentity, verifyRunnerPresentationIdentity, resolveRunnerPresentationExecution } from "@/server/runner/presentation";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "@/server/runner/capabilities";
import { readRunnerBrandingProfileInternal, readRunnerNextBroadcastInternal } from "@/server/runner/branding-profiles";
import { resolveRunnerPresentationPolicy } from "@/server/runner/branding";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const unavailable = () => reply({ error: "PRESENTATION_UNAVAILABLE" }, 403);

/** The presentation-scoped HTTP-only cookie authorizes appearance only. */
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
	const { sessionId } = await params;
	const jar = await cookies();
	const identity = verifyRunnerPresentationIdentity(jar.get(RUNNER_PRESENTATION_COOKIE)?.value, sessionId);
	if (!identity || !(await resolveRunnerPresentationExecution(identity))) return unavailable();
	const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, identity.ownerId), columns: { id: true, plan: true } });
	if (!owner || owner.id !== identity.ownerId) return unavailable();
	const capabilities = deriveRunnerCapabilities(await resolveRunnerBenefits(owner));
	const profile = await readRunnerBrandingProfileInternal({ ownerId: identity.ownerId, runnerId: identity.runnerId });
	const policy = resolveRunnerPresentationPolicy(capabilities, "generated_standby", profile);
	const signed = signRunnerPresentationIdentity(identity, Date.now());
	if (!signed) return reply({ error: "PRESENTATION_UNAVAILABLE" }, 503);
	const nextBroadcast = capabilities.runnerPro && profile.showNextBroadcastTime ? await readRunnerNextBroadcastInternal({ ownerId: identity.ownerId, runnerId: identity.runnerId }) : undefined;
	const standby = {
		backgroundColor: capabilities.runnerPro && /^#[a-f0-9]{6}$/i.test(profile.standbyBackgroundColor ?? "") ? profile.standbyBackgroundColor : "#000000",
		backgroundImageUrl: capabilities.runnerPro && profile.backgroundAssetId ? `/runner/presentation/${identity.sessionId}/assets/${profile.backgroundAssetId}` : null,
		logoUrl: capabilities.runnerPro && profile.logoAssetId ? `/runner/presentation/${identity.sessionId}/assets/${profile.logoAssetId}` : null,
		message: capabilities.runnerPro ? (profile.message ?? "") : "",
		...(nextBroadcast !== undefined ? { nextBroadcast } : {}),
	};
	const response = reply({ executionGeneration: identity.executionGeneration, attributionRequired: policy.attributionRequired, runnerPro: capabilities.runnerPro, validUntil: capabilities.validUntil, standby });
	response.cookies.set(RUNNER_PRESENTATION_COOKIE, signed.token, { path: `/runner/presentation/${identity.sessionId}`, httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", maxAge: RUNNER_PRESENTATION_TTL_SECONDS });
	return response;
}
