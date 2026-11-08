import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { readClipCompositionLogo } from "@/server/clip-composition-render";
export const runtime = "nodejs";
export async function GET(request: Request) {
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
	const creatorId = new URL(request.url).searchParams.get("creatorId");
	if (!creatorId || creatorId.length > 200) return new Response(null, { status: 400, headers });
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!grant.allowed) return new Response(null, { status: 403, headers });
	try {
		const bytes = await readClipCompositionLogo(grant.creator?.avatar, request.signal);
		return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/png" } });
	} catch {
		return new Response(null, { status: 502, headers });
	}
}
