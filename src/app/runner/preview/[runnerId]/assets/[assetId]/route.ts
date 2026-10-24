import { eq } from "drizzle-orm";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { getRunnerBrandingProfileForPrincipal } from "@/server/runner/branding-profiles";
import { readOwnedRunnerBrandingAsset, runnerAssetResponse } from "@/server/runner/branding-assets";
import { z } from "zod";
export async function GET(request: Request, { params }: { params: Promise<{ runnerId: string; assetId: string }> }) {
	const { runnerId, assetId } = await params;
	const principal = await getVerifiedSessionPrincipal();
	if (!principal || !z.uuid().safeParse(runnerId).success) return new Response(null, { status: 404 });
	const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.id, runnerId), columns: { ownerId: true } });
	if (!runner) return new Response(null, { status: 404 });
	const profile = await getRunnerBrandingProfileForPrincipal(principal, { ownerId: runner.ownerId, runnerId });
	if (!profile.success) return new Response(null, { status: 404 });
	const kind = new URL(request.url).searchParams.get("kind") ?? "background";
	if (kind !== "logo" && kind !== "background") return new Response(null, { status: 404 });
	const asset = await readOwnedRunnerBrandingAsset(runner.ownerId, assetId, kind);
	return asset ? runnerAssetResponse(asset) : new Response(null, { status: 404 });
}
