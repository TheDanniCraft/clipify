import { getGalleryPreviewPlayer } from "@actions/gallery";
import GalleryPlayerClientOnly from "@components/gallery/GalleryPlayerClientOnly";
import { notFound } from "next/navigation";

export default async function GalleryPreviewPlayerPage({ params }: { params: Promise<{ galleryId: string; clipId: string }> }) {
	const { galleryId, clipId } = await params;
	const player = await getGalleryPreviewPlayer(galleryId, clipId);
	if (!player) notFound();
	return <GalleryPlayerClientOnly gallery={player.gallery} clips={player.clips} initialIndex={player.selectedIndex} initialPlaybackUrl={player.playbackUrl} ownerName={player.ownerName} showAttribution={player.showAttribution} />;
}
