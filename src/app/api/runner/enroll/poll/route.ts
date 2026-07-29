import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { runnerEnrollmentsTable, runnersTable } from "@/db/schema";
import { tryRateLimit } from "@actions/rateLimit";

export async function POST(req: Request) {
	try {
		const body = (await req.json().catch(() => ({}))) as { deviceCode?: unknown };
		if (typeof body.deviceCode !== "string" || !body.deviceCode) {
			return NextResponse.json({ error: "Missing deviceCode" }, { status: 400 });
		}

		const identifier = createHash("sha256").update(body.deviceCode).digest("hex");
		const limit = await tryRateLimit({ key: "runner-enrollment-poll", points: 30, duration: 60, identifier });
		if (!limit.success) return NextResponse.json({ error: "Too many enrollment polls" }, { status: 429, headers: { "Retry-After": "60" } });

		const enrollment = await db.query.runnerEnrollmentsTable.findFirst({
			where: eq(runnerEnrollmentsTable.deviceCode, body.deviceCode),
		});

		const expiresAtMs = enrollment?.expiresAt instanceof Date ? enrollment.expiresAt.getTime() : new Date(enrollment?.expiresAt ?? 0).getTime();
		if (!enrollment || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
			return NextResponse.json({ error: "Enrollment expired" }, { status: 410 });
		}

		if (!enrollment.runnerId || !enrollment.approvedAt) {
			return NextResponse.json({ status: "pending" }, { status: 202 });
		}

		const runner = await db.query.runnersTable.findFirst({
			where: eq(runnersTable.id, enrollment.runnerId),
		});

		if (!runner) {
			return NextResponse.json({ error: "Runner not found" }, { status: 404 });
		}

		return NextResponse.json({
			status: "approved",
			apiBase: enrollment.apiBase,
			runnerId: runner.id,
			token: runner.token,
		});
	} catch (error) {
		console.error("Runner enrollment poll error:", error);
		return NextResponse.json({ error: "Failed to poll runner enrollment" }, { status: 500 });
	}
}
