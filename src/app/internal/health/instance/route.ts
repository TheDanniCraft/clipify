import crypto from "crypto";
import { NextRequest } from "next/server";
import { getInstanceHealthSnapshot } from "@lib/instanceHealth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function secureEqual(a: string, b: string) {
	try {
		const aBuf = Buffer.from(a);
		const bBuf = Buffer.from(b);
		if (aBuf.length !== bBuf.length) return false;
		return crypto.timingSafeEqual(aBuf, bBuf);
	} catch {
		return false;
	}
}

function isAuthorized(request: NextRequest) {
	const token = process.env.INSTANCE_HEALTH_TOKEN;
	if (!token) return false;

	const auth = request.headers.get("authorization") ?? "";
	if (!auth.toLowerCase().startsWith("bearer ")) return false;
	const value = auth.slice(7).trim();
	return secureEqual(value, token);
}

export async function GET(request: NextRequest) {
	if (!isAuthorized(request)) {
		return new Response("Unauthorized", { status: 401 });
	}

	const health = await getInstanceHealthSnapshot();

	return Response.json(
		health,
		{
			headers: {
				"Cache-Control": "no-store",
			},
		},
	);
}
