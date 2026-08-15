import { getPublicGalleryPlayer } from "@actions/gallery";
import GalleryPlayerClientOnly from "@components/gallery/GalleryPlayerClientOnly";

export default async function GalleryClipPage({ params }: { params: Promise<{ galleryId: string; clipId: string }> }) {
	const { galleryId, clipId } = await params;
	const data = await getPublicGalleryPlayer(galleryId, clipId);
	const handshakeScript = `
		(() => {
			try {
				if (window.parent === window) return;
				const parentOrigin = document.referrer ? new URL(document.referrer).origin : "*";
				window.parent.postMessage({ version: 1, type: "clipify:hello", elementType: "player", resourceId: ${JSON.stringify(galleryId)}, clipId: ${JSON.stringify(clipId)} }, parentOrigin);
			} catch {}
		})();
	`;
	return (
		<>
			<style>{`html,body,#root{background:transparent!important}body{margin:0;overflow:hidden}`}</style>
			<script dangerouslySetInnerHTML={{ __html: handshakeScript }} />
			<script dangerouslySetInnerHTML={{ __html: "window.$chatwoot = window.$chatwoot || {}; window.$chatwoot.disabled = true;" }} />
			{data ? <GalleryPlayerClientOnly gallery={data.gallery} clips={data.clips} initialIndex={data.selectedIndex} initialPlaybackUrl={data.playbackUrl} ownerName={data.owner.username} showAttribution={data.showAttribution} /> : <div className='flex h-dvh items-center justify-center bg-transparent'>Clip unavailable</div>}
		</>
	);
}
