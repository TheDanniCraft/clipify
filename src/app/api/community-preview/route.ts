import { NextResponse } from "next/server";

import { getCommunitySnapshot } from "@lib/community";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
	const snapshot = await getCommunitySnapshot();

	return NextResponse.json(snapshot, {
		headers: {
			"Cache-Control": "no-store",
		},
	});
}
