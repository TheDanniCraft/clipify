import { NextRequest, NextResponse } from "next/server";
import { getRunnerArtifact, getRunnerContext, RunnerArtifactUnavailableError, type RunnerPlatform } from "@lib/runnerArtifacts";

const DOWNLOAD_PLATFORMS: Record<string, RunnerPlatform> = {
	windows: "windows-x64",
	linux: "linux-x64",
	"linux-arm64": "linux-arm64",
	macos: "macos-x64",
	"macos-arm64": "macos-arm64",
	linuxArm: "linux-arm64",
	macosArm: "macos-arm64",
};

export async function GET(req: NextRequest) {
	const searchParams = req.nextUrl.searchParams;
	const osParam = searchParams.get("os") || "";
	const platform = DOWNLOAD_PLATFORMS[osParam];

	if (!platform) {
		return NextResponse.json({ error: "Invalid OS parameter" }, { status: 400 });
	}
	try {
		const { buffer, artifact, source } = await getRunnerArtifact(platform);

		return new NextResponse(buffer as unknown as BodyInit, {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": String(buffer.byteLength),
				"Content-Disposition": `attachment; filename="${artifact.filename}"`,
				ETag: `"${artifact.sha256}"`,
				"X-Runner-Source-Fingerprint": getRunnerContext().sourceFingerprint,
				"X-Runner-Artifact-Source": source,
			},
		});
	} catch (error) {
		console.error("Error serving runner binary:", error);
		const unavailable = error instanceof RunnerArtifactUnavailableError;
		const status = unavailable && error.httpStatus === 404 ? 404 : 503;
		return NextResponse.json({ error: status === 404 ? "Runner artifact not found" : "Runner binary temporarily unavailable", code: status === 404 ? "runner_artifact_unavailable" : "runner_artifact_pending" }, { status, headers: { "Retry-After": "30" } });
	}
}
