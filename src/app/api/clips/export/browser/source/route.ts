import { downloadBrowserClipSource } from "@/server/clip-export";
export const runtime = "nodejs";
export async function GET(request: Request) {
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
	try {
		const result = await downloadBrowserClipSource(new URL(request.url).searchParams.get("ticket") ?? "", request.signal);
		return result.ok ? new Response(new Uint8Array(result.bytes), { headers: { ...headers, "Content-Type": "video/mp4" } }) : Response.json(result, { status: result.status, headers });
	} catch {
		return Response.json({ ok: false, code: "SERVICE_UNAVAILABLE" }, { status: 503, headers });
	}
}
