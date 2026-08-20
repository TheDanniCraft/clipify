import { getPublicGalleryPlayer } from "@actions/gallery";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ galleryId: string; clipId: string }> }) {
	const { galleryId, clipId } = await params;
	const data = await getPublicGalleryPlayer(galleryId, clipId);
	if (!data) return NextResponse.json({ error: "Clip unavailable" }, { status: 404 });
	return NextResponse.json({ playbackUrl: data.playbackUrl, twitchUrl: data.clips[data.selectedIndex].url });
}
