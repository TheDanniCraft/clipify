import { getOverlayBySecret, getOverlayPublic, touchOverlay } from "@actions/database";
import OverlayPlayer from "@components/overlayPlayer";
import type { Overlay } from "@types";

type PublicOverlayWithDisabledState = Overlay & {
	ownerDisabled?: boolean;
};

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

	if (!overlay) {
		const publicOverlay = (await getOverlayPublic(overlayId)) as PublicOverlayWithDisabledState | null;
		if (publicOverlay?.ownerDisabled) {
			return (
				<div className='flex flex-col justify-center items-center h-screen w-screen text-center px-4'>
					<span>Your account has been disabled. Please contact support.</span>
				</div>
			);
		}
		return (
			<div className='flex flex-col justify-center items-center h-screen w-screen'>
				<span>Overlay not found or invalid secret</span>
				<span className='text-sm text-gray-400 mt-2'>Check the overlay URL and secret in your dashboard.</span>
			</div>
		);
	}
	if (overlay.status == "paused")
		return (
			<div className='flex justify-center items-center h-screen w-screen'>
				<span>Overlay paused</span>
			</div>
		);

	await touchOverlay(overlay.id);

	const rawShowFallbackBanner = Array.isArray(sp.showFallbackBanner) ? sp.showFallbackBanner[0] : sp.showFallbackBanner;
	const showFallbackBanner = rawShowFallbackBanner === "true";

	const rawStandby = Array.isArray(sp.standby) ? sp.standby[0] : sp.standby;
	const standby = rawStandby === "true";

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
			<div className='flex flex-col justify-center items-center h-screen w-screen relative'>
				{showFallbackBanner && (
					<div className='absolute top-0 left-0 w-full bg-danger text-white text-center py-2 px-4 z-[8] shadow-md flex items-center justify-center gap-2 font-medium'>
						<span className='animate-pulse'>🔴</span>
						Stream disconnected - Stream will be back soon
					</div>
				)}
				<OverlayPlayer overlay={overlay} overlaySecret={secret} initialStandby={standby} showFallbackBanner={showFallbackBanner} />
			</div>
		</>
	);
}
