import { z } from "zod";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { consumeAppRateLimit } from "@/server/rate-limit";
import { readBoundedResponse } from "@lib/clipExport";
import { creatorBrandSchema } from "@lib/overlayMetadata";
import { readClipCompositionLogo } from "@/server/clip-composition-render";
import { renderBrandWidget } from "@/server/brand-font-render";
export const runtime = "nodejs";
const payload = z.object({ creatorId: z.string().min(1).max(200), kind: z.enum(["channel", "title", "clipper"]), width: z.number().int().min(2).max(1920), height: z.number().int().min(2).max(1280), fontSize: z.number().min(1).max(96), clip: z.object({ title: z.string().max(1000), broadcasterName: z.string().max(200).nullish(), clipCreatorName: z.string().max(200).nullish(), categoryName: z.string().max(200).nullish() }), theme: creatorBrandSchema }).refine((v) => v.width * v.height <= 1000000);
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
let active = 0;
export async function POST(request: Request) {
	const fail = (code: string, status: number) => Response.json({ ok: false, code }, { status, headers });
	if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_INPUT", 400);
	let input: z.infer<typeof payload>;
	try {
		input = payload.parse(JSON.parse(new TextDecoder().decode(await readBoundedResponse(request, 8192, request.signal))));
	} catch {
		return fail("INVALID_INPUT", 400);
	}
	const grant = await authorizeCreatorOperation({ creatorId: input.creatorId, resourceOwnerId: input.creatorId, permission: "creator:read" });
	if (!grant.allowed) return fail(grant.code, 403);
	if (!(await consumeAppRateLimit({ key: "widget-preview", points: 240, duration: 60, identifier: input.creatorId })).success || active >= 2) return fail("RATE_LIMITED", 429);
	active++;
	try {
		const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
		const avatar = input.kind === "channel" && grant.creator?.avatar ? await readClipCompositionLogo(grant.creator.avatar, signal).catch(() => undefined) : undefined;
		const bytes = await renderBrandWidget(input.kind, input.clip, input.width, input.height, input.fontSize, input.theme, signal, avatar ? `data:image/png;base64,${avatar.toString("base64")}` : undefined);
		return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/png" } });
	} catch {
		return fail("FONT_UNAVAILABLE", 502);
	} finally {
		active--;
	}
}

export async function GET(request: Request) {
	const data = new URL(request.url).searchParams.get("data");
	if (!data || data.length > 8192) return Response.json({ ok: false, code: "INVALID_INPUT" }, { status: 400, headers });
	return POST(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: data, signal: request.signal }));
}
