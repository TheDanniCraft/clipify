import { getOverlay, touchOverlay } from "@actions/database";
import { getTwitchClips } from "@actions/twitch";
import OverlayPlayer from "@components/overlayPlayer";
import type { Overlay } from "@types";

export default async function Overlay({ params }: { params: Promise<{ overlayId: string }> }) {
	const { overlayId } = await params;

	const overlay = (await getOverlay(overlayId)) as Overlay;

	if (!overlay)
		return (
			<div className='flex justify-center items-center h-screen w-screen'>
				<span>Overlay not found</span>
			</div>
		);
	if (overlay.status == "paused")
		return (
			<div className='flex justify-center items-center h-screen w-screen'>
				<span>Overlay paused</span>
			</div>
		);

	const clips = await getTwitchClips(overlay);
	await touchOverlay(overlay.id);

	return (
		<>
			<style>{`
				html, body {
					background: transparent !important;
				}
			`}</style>
			<script
				dangerouslySetInnerHTML={{
					__html: "window.$chatwoot = window.$chatwoot || {}; window.$chatwoot.disabled = true;",
				}}
			/>
			<div className='flex flex-col justify-center items-center h-screen w-screen'>
				<OverlayPlayer clips={clips} overlay={overlay} />
			</div>
		</>
	);
}
