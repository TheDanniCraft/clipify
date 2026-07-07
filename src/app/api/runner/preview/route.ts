import { NextResponse } from "next/server";

const previewCache = new Map<string, { image: string; timestamp: number }>();

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { overlayId, secret, image } = body;
		if (!overlayId || !secret || !image) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

		previewCache.set(overlayId, { image, timestamp: Date.now() });
		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const overlayId = url.searchParams.get("overlayId");
	if (!overlayId) return NextResponse.json({ error: "Missing overlayId" }, { status: 400 });

	const data = previewCache.get(overlayId);
	if (!data || Date.now() - data.timestamp > 15000) {
		return NextResponse.json({ image: null });
	}

	return NextResponse.json({ image: data.image });
}
