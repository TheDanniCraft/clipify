export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getOverlayPublic } from "@actions/database";
import { getTwitchClips } from "@actions/twitch";
import OverlayPlayer from "@components/overlayPlayer";
import { type Overlay } from "@types";

export default async function Overlay() {
	const overlay = (await getOverlayPublic(process.env.DEMO_OVERLAY_ID as string)) as Overlay;

	if (!overlay)
		return (
			<>
				<script
					dangerouslySetInnerHTML={{
						__html: "window.$chatwoot = window.$chatwoot || {}; window.$chatwoot.disabled = true;",
					}}
				/>
				<div className='flex justify-center items-center h-screen w-screen'>
					<span>Overlay not found</span>
				</div>
			</>
		);
	if (overlay.status === "paused")
		return (
			<>
				<script
					dangerouslySetInnerHTML={{
						__html: "window.$chatwoot = window.$chatwoot || {}; window.$chatwoot.disabled = true;",
					}}
				/>
				<div className='flex justify-center items-center h-screen w-screen'>
					<span>Overlay paused</span>
				</div>
			</>
		);

	const clips = await getTwitchClips(overlay);

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
				<OverlayPlayer clips={clips} overlay={overlay} isDemoPlayer />
			</div>
		</>
	);
}
