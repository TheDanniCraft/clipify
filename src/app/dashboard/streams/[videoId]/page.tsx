import { redirect } from "next/navigation";
import { Link } from "@heroui/react";
import { validateAuth } from "@actions/auth";
import { getCreatorBroadcast, getCreatorClipInventory } from "@actions/creatorLibrary";
import DashboardNavbar from "@components/dashboardNavbar";
import StreamMoments from "@components/creator/streamMoments";
import ClipInventory from "@components/creator/clipInventory";
export default async function StreamPage({ params, searchParams }: { params: Promise<{ videoId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { videoId } = await params;
	const stream = await getCreatorBroadcast({ creatorId: user.id, videoId });
	if (!stream.ok)
		return (
			<DashboardNavbar user={user} title='Stream unavailable' tagline='This broadcast could not be opened'>
				<p role='alert' className='my-6'>
					The broadcast may have been removed or Twitch may be unavailable. Your clips remain in Clip Inventory.
				</p>
				<Link href='/dashboard/streams'>Back to streams</Link>
				<Link href='/dashboard/clips'>Open Clip Inventory</Link>
			</DashboardNavbar>
		);
	const raw = Object.fromEntries(Object.entries(await searchParams).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
	raw.videoId = videoId;
	const query: Record<string, unknown> = { ...raw };
	for (const key of ["page", "pageSize", "minViews", "minDuration", "maxDuration"]) if (raw[key] !== undefined) query[key] = Number(raw[key]);
	const data = await getCreatorClipInventory({ creatorId: user.id, query });
	return (
		<DashboardNavbar user={user} title={stream.broadcast.title || "Untitled stream"} tagline='Clips linked to this broadcast'>
			<div className='mt-4 flex gap-4'>
				<Link href='/dashboard/streams'>Back to streams</Link>
				{stream.broadcast.available ? (
					<Link href={stream.broadcast.url} target='_blank' rel='noopener noreferrer'>
						Open broadcast on Twitch
					</Link>
				) : (
					<p className='text-sm text-muted'>Recording no longer available on Twitch. Your clips are kept.</p>
				)}
			</div>
			<div role='status' aria-label='Stream clip totals' className='mt-4 flex flex-wrap gap-4 text-sm text-muted'>
				<span>Known clips: {stream.broadcast.clipCount === null ? "Unavailable" : stream.broadcast.clipCount.toLocaleString()}</span>
				<span>Current clip views: {stream.broadcast.clipViews === null ? "Unavailable" : stream.broadcast.clipViews.toLocaleString()}</span>
			</div>
			{stream.stale ? <p className='mt-3 text-sm text-warning-soft-foreground'>Showing saved broadcast information.</p> : null}
			<StreamMoments creatorId={user.id} clips={stream.broadcast.moments ?? []} />
			<ClipInventory key={`${user.id}:${videoId}`} creatorId={user.id} query={raw} data={data} />
		</DashboardNavbar>
	);
}
