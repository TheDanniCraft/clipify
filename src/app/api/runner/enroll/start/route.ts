import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { runnerEnrollmentsTable, runnersTable } from "@/db/schema";

const ENROLLMENT_TTL_MS = 15 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 3;

function createDeviceCode() {
	return `cl_dev_${randomBytes(32).toString("hex")}`;
}

function createUserCode() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let value = "";
	for (let i = 0; i < 8; i += 1) {
		value += alphabet[randomBytes(1)[0] % alphabet.length];
	}
	return `${value.slice(0, 4)}-${value.slice(4)}`;
}

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json().catch(() => ({}))) as { hostname?: unknown; os?: unknown; version?: unknown; runnerId?: unknown };
		const apiBase = req.nextUrl.origin;
		const deviceCode = createDeviceCode();
		const userCode = createUserCode();
		const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);
		const requestedRunnerId = typeof body.runnerId === "string" && body.runnerId ? body.runnerId : null;
		const targetRunner = requestedRunnerId
			? await db.query.runnersTable.findFirst({
					where: eq(runnersTable.id, requestedRunnerId),
				})
			: null;

		if (requestedRunnerId && !targetRunner) {
			return NextResponse.json({ error: "Runner not found" }, { status: 404 });
		}

		await db.insert(runnerEnrollmentsTable).values({
			deviceCode,
			userCode,
			apiBase,
			hostname: typeof body.hostname === "string" ? body.hostname : null,
			osInfo: typeof body.os === "string" ? body.os : null,
			version: typeof body.version === "string" ? body.version : null,
			ownerId: targetRunner?.ownerId ?? null,
			runnerId: targetRunner?.id ?? null,
			expiresAt,
		});

		const verificationUri = new URL("/runner/enroll", apiBase);

		return NextResponse.json({
			deviceCode,
			userCode,
			verificationUri: verificationUri.toString(),
			expiresAt: expiresAt.toISOString(),
			pollInterval: POLL_INTERVAL_SECONDS,
		});
	} catch (error) {
		console.error("Runner enrollment start error:", error);
		return NextResponse.json({ error: "Failed to start runner enrollment" }, { status: 500 });
	}
}
