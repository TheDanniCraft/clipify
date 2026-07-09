import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { RunnerStatus } from "@types";
import { NextResponse } from "next/server";

export async function GET() {
	try {
		const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

		const result = await db
			.update(runnersTable)
			.set({ status: RunnerStatus.Offline })
			.where(and(eq(runnersTable.status, RunnerStatus.Online), lt(runnersTable.lastHeartbeatAt, thirtySecondsAgo)))
			.returning();

		return NextResponse.json({ success: true, updated: result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({ success: false, error: message });
	}
}
