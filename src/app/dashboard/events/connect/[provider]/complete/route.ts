import { NextResponse } from "next/server";
import { resolveBaseUrl } from "@lib/baseUrl";
import { completeEventGoogleConnectionAction } from "@actions/events";
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params;
	const url = new URL(request.url);
	const origin = resolveBaseUrl().origin;
	if (provider !== "drive" && provider !== "youtube") return NextResponse.redirect(new URL("/dashboard/events", origin));
	const completed = await completeEventGoogleConnectionAction(provider, url.searchParams.get("intent") ?? "");
	if (!completed.ok) return NextResponse.redirect(new URL("/login", origin));
	const result = completed.connection;
	const destination = new URL(result?.returnPath ?? "/dashboard/events", origin);
	destination.searchParams.set("section", "connections");
	destination.searchParams.set("provider", provider);
	destination.searchParams.set("connection", result?.connected ? "connected" : "retry");
	return NextResponse.redirect(destination);
}
