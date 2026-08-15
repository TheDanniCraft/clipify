import { getPublicGalleryPlayer } from "@actions/gallery";
import GalleryPlayerClientOnly from "@components/gallery/GalleryPlayerClientOnly";

export default async function GalleryClipPage({ params }: { params: Promise<{ galleryId: string; clipId: string }> }) {
	const { galleryId, clipId } = await params;
	const data = await getPublicGalleryPlayer(galleryId, clipId);
	const handshakeScript = `
		(() => {
			try {
				if (window.parent === window) return;
				const state = window.__clipifyPlayerBootstrap || (window.__clipifyPlayerBootstrap = { pendingInit: null, listenerInstalled: false });
				if (!state.listenerInstalled) {
					window.addEventListener("message", (event) => {
						const message = event.data;
						if (!message || message.version !== 1 || message.type !== "clipify:init" || message.elementType !== "player" || message.resourceId !== ${JSON.stringify(galleryId)} || message.clipId !== ${JSON.stringify(clipId)} || !event.ports[0]) return;
						state.pendingInit = { data: message, port: event.ports[0] };
						event.stopImmediatePropagation();
						window.dispatchEvent(new Event("clipify:player-init"));
					});
					state.listenerInstalled = true;
				}
				window.parent.postMessage({ version: 1, type: "clipify:hello", elementType: "player", resourceId: ${JSON.stringify(galleryId)}, clipId: ${JSON.stringify(clipId)} }, "*");
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
