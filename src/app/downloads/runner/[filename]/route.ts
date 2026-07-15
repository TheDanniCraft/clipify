import { NextResponse } from "next/server";
import { getRunnerArtifact, platformForBinaryName } from "@lib/runnerArtifacts";

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
		return NextResponse.json({ error: "Runner artifact is still being prepared", code: "runner_artifact_pending" }, { status: 503, headers: { "Retry-After": "30" } });
	}
}
