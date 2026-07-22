import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { tryRateLimit } from "@actions/rateLimit";
import { probeRtmpReachability, takeRunnerReachabilityCheck } from "@lib/runnerReachability";

export const runtime = "nodejs";

export async function POST(req: Request) {
	try {
		const authHeader = req.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const token = authHeader.slice("Bearer ".length);
		const identifier = createHash("sha256").update(token).digest("hex");
		const limit = await tryRateLimit({ key: "runner-rtmp-reachability-execute", points: 10, duration: 60, identifier });
		if (!limit.success) return NextResponse.json({ error: "Too many reachability checks" }, { status: 429, headers: { "Retry-After": "60" } });

		const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.token, token) });
		if (!runner) return NextResponse.json({ error: "Invalid runner token" }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const check = takeRunnerReachabilityCheck(body?.checkId, runner.id);
		if (!check) return NextResponse.json({ error: "Reachability check expired or invalid" }, { status: 400 });
		if (check.ips.length === 0) return NextResponse.json({ status: "not_reachable", reachableIps: [] });

		const results = await Promise.all(check.ips.map(async (ip) => ({ ip, reachable: await probeRtmpReachability(ip, check.nonce) })));
		const reachableIps = results.filter((result) => result.reachable).map((result) => result.ip);

		return NextResponse.json({
			status: reachableIps.length > 0 ? "reachable" : "not_reachable",
			reachableIps,
		});
	} catch (error) {
		console.error("Runner reachability execute error:", error);
		return NextResponse.json({ error: "Failed to execute reachability check" }, { status: 500 });
	}
}
