import { getMcpConfiguration } from "@/server/mcp/config";
import { isMcpSchemaReady } from "@/server/mcp/schema-readiness";
export const runtime = "nodejs";
export async function GET(request: Request) {
	if (!getMcpConfiguration().valid) return Response.json({ error: "service_unavailable" }, { status: 503 });
	if (!(await isMcpSchemaReady())) return Response.json({ error: "service_unavailable" }, { status: 503 });
	const { auth } = await import("@/auth/config");
	return auth.handler(request);
}
