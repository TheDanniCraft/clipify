import { prepareBrowserClipExport, readBoundedResponse } from "@/server/clip-export";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
	const url = new URL(request.url),
		proto = request.headers.get("x-forwarded-proto");
	const origin = `${proto === "https" || proto === "http" ? proto + ":" : url.protocol}//${request.headers.get("host") ?? url.host}`;
	if (request.headers.get("origin") !== origin) return Response.json({ ok: false, code: "PERMISSION_DENIED" }, { status: 403, headers });
	if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400, headers });
	try {
		let input: unknown;
		try {
			input = JSON.parse(new TextDecoder().decode(await readBoundedResponse(request, 1024 * 1024, request.signal)));
		} catch (error) {
			return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: error instanceof Error && error.message === "byte_limit" ? 413 : 400, headers });
		}
		const result = await prepareBrowserClipExport(input, AbortSignal.any([request.signal, AbortSignal.timeout(60000)]));
		return Response.json(result, { status: result.ok ? 200 : result.status, headers });
	} catch {
		return Response.json({ ok: false, code: "SERVICE_UNAVAILABLE" }, { status: 503, headers });
	}
}
