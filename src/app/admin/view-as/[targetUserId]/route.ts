import { NextRequest, NextResponse } from "next/server";
import { startAdminView } from "@actions/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ targetUserId: string }> }) {
	const { targetUserId } = await params;
	const result = await startAdminView(targetUserId);

	if (!result.ok) {
		const url = new URL("/admin", request.url);
		url.searchParams.set("error", result.error ?? "unknown");
		return NextResponse.redirect(url);
	}

	return NextResponse.redirect(new URL("/dashboard", request.url));
}
