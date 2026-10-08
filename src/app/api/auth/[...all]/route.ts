import { toNextJsHandler } from "better-auth/next-js";
import { getMcpConfiguration } from "@/server/mcp/config";
import { isMcpSchemaReady } from "@/server/mcp/schema-readiness";

async function handle(request: Request, method: "GET" | "POST") {
	const pathname = new URL(request.url).pathname;
	const isOAuth = pathname.startsWith("/api/auth/oauth2/") || pathname === "/api/auth/jwks" || pathname === "/api/auth/.well-known/oauth-authorization-server";
	if (isOAuth && (!getMcpConfiguration().valid || !(await isMcpSchemaReady()))) {
		return Response.json({ error: "service_unavailable" }, { status: 503 });
	}
	const { auth } = await import("@/auth/config");
	return toNextJsHandler(auth)[method](request);
}
export async function GET(request: Request) {
	return handle(request, "GET");
}
export async function POST(request: Request) {
	return handle(request, "POST");
}
