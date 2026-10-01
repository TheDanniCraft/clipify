import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { runnersTable, streamSessionsTable } from "@/db/schema";
import { tryRateLimit } from "@actions/rateLimit";
import { RunnerPreviewCache } from "@lib/runnerPreviewCache";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";

const previewCache = new RunnerPreviewCache();

export async function POST(req: Request) {
	try {
		const contentLength = Number(req.headers.get("content-length") ?? 0);
		if (contentLength > 1_450_000) return NextResponse.json({ error: "Preview payload too large" }, { status: 413 });

		const auth = req.headers.get("authorization") ?? "";
		if (!auth.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const token = auth.slice(7).trim();
		const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.token, token) });
		if (!runner) return NextResponse.json({ error: "Invalid runner token" }, { status: 401 });

		const body = await req.json();
		const { overlayId, image } = body;
		if (!overlayId || typeof image !== "string") return NextResponse.json({ error: "Missing fields" }, { status: 400 });
		if (!image.startsWith("data:image/jpeg;base64,") || image.length > 1_400_000) return NextResponse.json({ error: "Invalid preview image" }, { status: 413 });

		const session = await db.query.streamSessionsTable.findFirst({ where: and(eq(streamSessionsTable.runnerId, runner.id), eq(streamSessionsTable.overlayId, overlayId)) });
		if (!session) return NextResponse.json({ error: "Runner is not assigned to this overlay" }, { status: 403 });

		const identifier = createHash("sha256").update(`${token}:${runner.id}`).digest("hex");
		const limit = await tryRateLimit({ key: "runner-preview", points: 40, duration: 60, identifier });
		if (!limit.success) return NextResponse.json({ error: "Too many previews" }, { status: 429, headers: { "Retry-After": "60" } });

		previewCache.set(runner.id, image);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Runner preview upload failed:", error);
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const runnerId = url.searchParams.get("runnerId");
	if (!runnerId) return NextResponse.json({ error: "Missing runnerId" }, { status: 400 });

	const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.id, runnerId) });
	if (!runner) return NextResponse.json({ error: "Runner not found" }, { status: 404 });
	const access = await authorizeCreatorOperation({ creatorId: runner.ownerId, resourceOwnerId: runner.ownerId, permission: "runner:read" });
	if (!access.allowed) return NextResponse.json({ error: access.code === "AUTHENTICATION_REQUIRED" ? "Unauthorized" : "Forbidden" }, { status: access.code === "AUTHENTICATION_REQUIRED" ? 401 : 403 });

	return NextResponse.json({ image: previewCache.get(runner.id) });
}
