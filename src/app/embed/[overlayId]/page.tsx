import { getOverlay, getUserPlan } from "@/app/actions/database";
import { getTwitchClips } from "@/app/actions/twitch";
import OverlayPlayer from "@/app/components/overlayPlayer";
import { Plan, type Overlay } from "@/app/lib/types";

export default async function Overlay({ params, searchParams }: { params: Promise<{ overlayId: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const { overlayId } = await params;
	const sp = await searchParams;
	const toFlag = (value: string | string[] | undefined) => {
		let raw = value;
		if (Array.isArray(raw)) raw = raw[0];
		if (raw === undefined) return false;
		const normalized = raw.toString().trim().toLowerCase();
		if (normalized === "" || normalized === "true" || normalized === "1") return true;
		if (normalized === "false" || normalized === "0") return false;
		return false;
	};
	const showBanner = toFlag(sp.showBanner);
	const embedMuted = toFlag(sp.muted);
	const embedAutoplay = toFlag(sp.autoplay);

	if (overlayId === "default") {
		return (
			<>
				<script
					dangerouslySetInnerHTML={{
						__html: "window.$chatwoot = window.$chatwoot || {}; window.$chatwoot.disabled = true;",
					}}
				/>
				<div className='flex justify-center items-center h-screen w-screen'>
					<span>Please select an overlay</span>
				</div>
			</>
		);
	}

	const overlay = (await getOverlay(overlayId)) as Overlay;

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
	const plan = await getUserPlan(overlay.ownerId);

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
				<OverlayPlayer clips={clips} overlay={overlay} isEmbed showBanner={showBanner || plan === Plan.Free} embedMuted={embedMuted} embedAutoplay={embedAutoplay} />
			</div>
		</>
	);
}
