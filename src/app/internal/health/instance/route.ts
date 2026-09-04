import { NextRequest } from "next/server";
import { getInstanceHealthSnapshot } from "@lib/instanceHealth";
import { hasInstanceHealthAuthorization } from "@lib/internalAuthorization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
	if (!hasInstanceHealthAuthorization(request)) {
		return new Response("Unauthorized", { status: 401 });
	}

	const health = await getInstanceHealthSnapshot({ exclude: ["twitchRateLimit"] });

	return Response.json(health, {
		headers: {
			"Cache-Control": "no-store",
		},
	});
}
