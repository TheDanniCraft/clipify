import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { getUserIP, tryRateLimit } from "@actions/rateLimit";
import { createRunnerReachabilityCheck } from "@lib/runnerReachability";

export const runtime = "nodejs";

export async function POST(req: Request) {
	try {
		const authHeader = req.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const token = authHeader.slice("Bearer ".length);
		const identifier = createHash("sha256").update(token).digest("hex");
		const limit = await tryRateLimit({ key: "runner-rtmp-reachability-start", points: 10, duration: 60, identifier });
		if (!limit.success) return NextResponse.json({ error: "Too many reachability checks" }, { status: 429, headers: { "Retry-After": "60" } });

		const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.token, token) });
		if (!runner) return NextResponse.json({ error: "Invalid runner token" }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const candidateIps = Array.isArray(body?.candidateIps) ? body.candidateIps : [];
		const observedIp = await getUserIP();
		const check = createRunnerReachabilityCheck(runner.id, [...candidateIps, observedIp]);

		return NextResponse.json(check);
	} catch (error) {
		console.error("Runner reachability start error:", error);
		return NextResponse.json({ error: "Failed to start reachability check" }, { status: 500 });
	}
}
