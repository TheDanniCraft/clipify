import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { tryRateLimit } from "@actions/rateLimit";
import { requireOverlaySecretAccessInternal } from "@/server/overlays";
import { recordOverlayPresence } from "@lib/overlayPresenceServer";
import { captureUnexpectedError } from "@lib/sentryServer";

const reportSchema = z
	.object({
		overlayId: z.string().uuid(),
		instanceId: z.string().uuid(),
		sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		active: z.boolean(),
	})
	.strict();

export async function POST(req: Request) {
	const secret = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
	if (!secret || secret.length > 256) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const identifier = createHash("sha256").update(secret).digest("hex");
	const limit = await tryRateLimit({ key: "overlay-presence", points: 120, duration: 60, identifier });
	if (!limit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });

	let body: unknown;
	try {
		const text = await req.text();
		if (text.length > 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
		body = JSON.parse(text);
	} catch {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}
	const parsed = reportSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	try {
		// Use the current runtime policy: secret, account lifecycle, and entitlements.
		const overlay = await requireOverlaySecretAccessInternal(parsed.data.overlayId, secret);
		if (!overlay) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		if (overlay.status === "paused") return NextResponse.json({ error: "Overlay paused" }, { status: 403 });
		await recordOverlayPresence(parsed.data);
		return new NextResponse(null, { status: 204 });
	} catch (error) {
		captureUnexpectedError(error, "overlay-api", "presence");
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
