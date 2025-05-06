import { getOverlay } from "@/app/actions/database";
import { getTwitchClips } from "@/app/actions/twitch";
import OverlayPlayer from "@/app/components/overlayPlayer";
import type { Overlay } from "@/app/lib/types";

export default async function Overlay({ params }: { params: { overlayId: string } }) {
	const { overlayId } = await params;

	const overlay = (await getOverlay(overlayId)) as Overlay;

	if (!overlay) return <div>Overlay not found</div>;
	if (overlay.status == "paused") return <div>Overlay paused</div>;

	const clips = await getTwitchClips(overlay);

	return (
		<div className='flex flex-col justify-center items-center h-screen w-screen'>
			<OverlayPlayer clips={clips} />
		</div>
	);
}
