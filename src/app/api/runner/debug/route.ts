import { NextResponse } from "next/server";

/**
 * Offline marking is owned by runnerScheduler. Keep this legacy route inert so
 * it cannot be used as an unauthenticated state-changing endpoint.
 */
export async function GET() {
	return NextResponse.json({ error: "Not found" }, { status: 404 });
}
