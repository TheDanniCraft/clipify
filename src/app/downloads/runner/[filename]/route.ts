import { NextResponse } from "next/server";
import { getRunnerArtifact, platformForBinaryName, RunnerArtifactUnavailableError } from "@lib/runnerArtifacts";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
	const { filename } = await params;
	const platform = platformForBinaryName(filename);
	if (!platform) return NextResponse.json({ error: "Runner binary not found" }, { status: 404 });

	try {
		const { buffer, artifact, source } = await getRunnerArtifact(platform);
		return new NextResponse(buffer as unknown as BodyInit, {
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": String(buffer.byteLength),
				"Content-Disposition": `attachment; filename="${artifact.filename}"`,
				ETag: `"${artifact.sha256}"`,
				"X-Runner-Artifact-Source": source,
			},
		});
	} catch (error) {
		console.error("Error serving public Runner binary:", error);
		const unavailable = error instanceof RunnerArtifactUnavailableError;
		const status = unavailable && error.httpStatus === 404 ? 404 : 503;
		const localMissing = process.env.RUNNER_ARTIFACT_SOURCE === "local" && status === 404;
		return NextResponse.json({ error: localMissing && error instanceof Error ? error.message : status === 404 ? "Runner artifact not found" : "Runner binary temporarily unavailable", code: localMissing ? "runner_artifact_local_missing" : status === 404 ? "runner_artifact_unavailable" : "runner_artifact_pending" }, { status, headers: { "Retry-After": "30" } });
	}
}
