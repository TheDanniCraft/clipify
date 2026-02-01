import { getOverlayBySecret, touchOverlay } from "@actions/database";
import { getTwitchClips } from "@actions/twitch";
import OverlayPlayer from "@components/overlayPlayer";
import type { Overlay } from "@types";

export default async function Overlay({ params, searchParams }: { params: Promise<{ overlayId: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const { overlayId } = await params;
	const sp = await searchParams;
	const rawSecret = Array.isArray(sp.secret) ? sp.secret[0] : sp.secret;
	const secret = typeof rawSecret === "string" ? rawSecret : "";

	if (!secret) {
		return (
			<div className='flex flex-col justify-center items-center h-screen w-screen'>
				<span>Missing overlay secret</span>
				<span className='text-sm text-gray-400 mt-2'>Go to the dashboard to get a URL with a secret.</span>
			</div>
		);
	}

	const overlay = (await getOverlayBySecret(overlayId, secret)) as Overlay;

	if (!overlay)
		return (
			<div className='flex flex-col justify-center items-center h-screen w-screen'>
				<span>Missing overlay secret</span>
				<span className='text-sm text-gray-400 mt-2'>Go to the dashboard to get a URL with a secret.</span>
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
				<OverlayPlayer clips={clips} overlay={overlay} overlaySecret={secret} />
			</div>
		</>
	);
}
