import { NextResponse } from "next/server";
import { getRunnerVersionManifest } from "@actions/runner";

export async function GET() {
	try {
		const manifest = await getRunnerVersionManifest();
		if (!manifest) {
			return NextResponse.json({ error: "Runner artifacts are still being prepared", code: "runner_artifact_pending" }, { status: 503, headers: { "Retry-After": "30" } });
		}
		return NextResponse.json(manifest, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } });
	} catch (error) {
		console.error("Error resolving Runner manifest:", error);
		return NextResponse.json({ error: "Runner manifest unavailable", code: "runner_artifact_unavailable" }, { status: 503, headers: { "Retry-After": "30" } });
	}
}
