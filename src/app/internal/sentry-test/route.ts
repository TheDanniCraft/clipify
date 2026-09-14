import { db } from "@/db/client";
import { hasInstanceHealthAuthorization } from "@lib/internalAuthorization";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
	if (process.env.IS_PREVIEW !== "true") {
		return new Response("Not found", { status: 404 });
	}

	if (!hasInstanceHealthAuthorization(request)) {
		return new Response("Unauthorized", { status: 401 });
	}

	// This real query verifies that the protected smoke test contains a Drizzle/pg
	// database span in the same trace as the deliberately unhandled error.
	await db.execute(sql`select 1`);
	throw new Error(`Clipify Sentry smoke test ${new Date().toISOString()}`);
}
