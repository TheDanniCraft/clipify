import { NextResponse } from "next/server";
import { completeEventGoogleConnectionAction } from "@actions/events";
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params;
	const url = new URL(request.url);
	if (provider !== "drive" && provider !== "youtube") return NextResponse.redirect(new URL("/dashboard/events", url.origin));
	const completed = await completeEventGoogleConnectionAction(provider, url.searchParams.get("intent") ?? "");
	if (!completed.ok) return NextResponse.redirect(new URL("/login", url.origin));
	const result = completed.connection;
	const destination = new URL(result?.returnPath ?? "/dashboard/events", url.origin);
	destination.searchParams.set("connection", result?.connected ? "connected" : "retry");
	return NextResponse.redirect(destination);
}
