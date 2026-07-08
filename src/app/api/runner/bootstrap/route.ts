import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
	try {
		const { bootstrapToken } = await req.json();

		if (!bootstrapToken) {
			return NextResponse.json({ error: "Missing bootstrapToken" }, { status: 400 });
		}

		// Find the runner with this bootstrap token
		const runner = await db.query.runnersTable.findFirst({
			where: eq(runnersTable.bootstrapToken, bootstrapToken),
		});

		if (!runner) {
			return NextResponse.json({ error: "Invalid or already used bootstrap token" }, { status: 401 });
		}

		// Immediately burn the bootstrap token (Single-Use)
		await db.update(runnersTable).set({ bootstrapToken: null }).where(eq(runnersTable.id, runner.id));

		// Return the real API token
		return NextResponse.json({
			token: runner.token,
			runnerId: runner.id,
		});
	} catch (error) {
		console.error("Error in runner bootstrap:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
