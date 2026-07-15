import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "@actions/auth";
import { db } from "@/db/client";
import { editorsTable, runnersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hasActiveEntitlement } from "@lib/entitlements";
import { Entitlement } from "@types";
import { getRunnerArtifact, getRunnerContext, type RunnerPlatform } from "@lib/runnerArtifacts";

const platforms: Record<string, RunnerPlatform> = {
	windows: "windows-x64",
	linux: "linux-x64",
	"linux-arm64": "linux-arm64",
	macos: "macos-x64",
	"macos-arm64": "macos-arm64",
};

async function canAccessRunner(ownerId: string, userId: string) {
	if (ownerId === userId) return true;
	const editor = await db.query.editorsTable.findFirst({
		where: and(eq(editorsTable.userId, ownerId), eq(editorsTable.editorId, userId)),
	});
	return Boolean(editor);
}

export async function GET(req: NextRequest) {
	const user = await validateAuth();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = req.nextUrl.searchParams;
	const osParam = searchParams.get("os") || "";
	const runnerId = searchParams.get("runnerId");
	const platform = platforms[osParam];

	if (!platform) {
		return NextResponse.json({ error: "Invalid OS parameter" }, { status: 400 });
	}
	if (!runnerId) {
		return NextResponse.json({ error: "Missing runnerId parameter" }, { status: 400 });
	}

	const runner = await db.query.runnersTable.findFirst({
		where: eq(runnersTable.id, runnerId),
	});

	if (!runner || !(await canAccessRunner(runner.ownerId, user.id))) {
		return NextResponse.json({ error: "Runner not found or unauthorized" }, { status: 404 });
	}
	if (!(await hasActiveEntitlement(runner.ownerId, Entitlement.RunnerAccess))) {
		return NextResponse.json({ error: "Runner add-on required", code: "entitlement_required" }, { status: 403 });
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
		const unavailable = error instanceof Error && error.name === "RunnerArtifactUnavailableError";
		return NextResponse.json({ error: unavailable ? "Runner artifact is still being prepared" : "Runner binary unavailable", code: unavailable ? "runner_artifact_pending" : "runner_artifact_unavailable" }, { status: 503, headers: { "Retry-After": "30" } });
	}
}
