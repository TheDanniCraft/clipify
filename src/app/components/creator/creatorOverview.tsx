"use client";
import { useContext, useEffect, useState } from "react";
import { Button, Card, Link, Skeleton } from "@heroui/react";
import { getCreatorClipOverview, getCreatorBroadcasts } from "@actions/creatorLibrary";
import ClipPreview from "./clipPreview";
import LocalizedDate from "@components/localizedDate";
import { DashboardNavigationContext } from "@components/dashboardNavigation";
import { useUserTour } from "@components/user-tour/provider";
type Overview = Awaited<ReturnType<typeof getCreatorClipOverview>>;
type Broadcasts = Awaited<ReturnType<typeof getCreatorBroadcasts>>;
export default function CreatorOverview({ creatorId }: { creatorId: string }) {
	const navigation = useContext(DashboardNavigationContext);
	const { activeTask } = useUserTour();
	const [preview, setPreview] = useState<{ id: string; title: string; url: string } | null>(null);
	const [overview, setOverview] = useState<Overview>();
	const [broadcasts, setBroadcasts] = useState<Broadcasts>();
	const [retryOverview, setRetryOverview] = useState(0);
	const [retryBroadcasts, setRetryBroadcasts] = useState(0);
	useEffect(() => {
		let current = true;
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		void getCreatorClipOverview({ creatorId, timeZone })
			.then((data) => {
				if (current) setOverview(data);
			})
			.catch(() => {
				if (current) setOverview({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			current = false;
		};
	}, [creatorId, retryOverview]);
	useEffect(() => {
		let current = true;
		void getCreatorBroadcasts({ creatorId })
			.then((data) => {
				if (current) setBroadcasts(data);
			})
			.catch(() => {
				if (current) setBroadcasts({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			current = false;
		};
	}, [creatorId, retryBroadcasts]);
	return (
		<div className='my-6 flex flex-col gap-6'>
			<section aria-label='Clip performance' className='flex flex-col gap-3'>
				<header>
					<h2 className='font-semibold'>Clip performance</h2>
					<p className='text-sm text-muted'>Clips created in the last 30 days</p>
				</header>
				<div className='grid grid-cols-2 gap-4'>
					{overview?.ok && overview.count === 0 ? (
						<Card className='col-span-2'>
							<Card.Header>
								<Card.Title>No clips from the last 30 days</Card.Title>
								<Card.Description>Open your inventory to browse older clips or refresh your library.</Card.Description>
							</Card.Header>
							<Card.Content>
								<Link href='/dashboard/clips'>Browse clip inventory</Link>
							</Card.Content>
						</Card>
					) : overview?.ok ? (
						<>
							<Card>
								<Card.Content>
									<p className='text-sm text-muted'>Clips</p>
									<p role='status' aria-label='Known clips' className='my-2 text-3xl font-bold tabular-nums'>
										{overview.count.toLocaleString()}
									</p>
								</Card.Content>
							</Card>
							<Card>
								<Card.Content>
									<p className='text-sm text-muted'>Views</p>
									<p role='status' aria-label='Current clip views' className='my-2 text-3xl font-bold tabular-nums'>
										{overview.views.toLocaleString()}
									</p>
									<p className='text-sm text-muted'>Total views on these clips</p>
								</Card.Content>
							</Card>
						</>
					) : overview ? (
						<Card className='col-span-2'>
							<Card.Content>
								<p role='alert'>{overview.code === "RECONNECT_REQUIRED" ? "Reconnect Twitch to load your clips." : "Clip performance could not be loaded."}</p>
								{overview.code === "RECONNECT_REQUIRED" ? <Link href='/dashboard/settings?tab=connections'>Manage linked accounts</Link> : null}
								<Button variant='secondary' onPress={() => setRetryOverview((value) => value + 1)}>
									Retry
								</Button>
							</Card.Content>
						</Card>
					) : (
						<>
							<Skeleton className='h-36 rounded-xl' />
							<Skeleton className='h-36 rounded-xl' />
						</>
					)}
				</div>
				{overview?.ok ? (
					<p className='text-sm text-muted'>
						{overview.complete ? "Library synchronized." : "These are known clips; older clips may still be syncing."} Dates use {overview.timeZone}.
						{overview.fetchedAt ? (
							<>
								{" "}
								Updated <LocalizedDate value={overview.fetchedAt} showTime />
							</>
						) : null}
					</p>
				) : null}
			</section>

			{activeTask && navigation?.mobile ? (
				<nav aria-label='Creator shortcuts' className='flex flex-wrap gap-4'>
					<Link href='/dashboard' data-tour='dashboard-home'>
						Home
					</Link>
					<Link href='/dashboard/overlays' data-tour={navigation?.mobile ? "overlays-tab" : undefined}>
						Overlays
					</Link>
					<Link href='/dashboard/playlists' data-tour={navigation?.mobile ? "playlists-tab" : undefined}>
						Playlists
					</Link>
					<Link href='/dashboard/galleries' data-tour={navigation?.mobile ? "galleries-tab" : undefined}>
						Galleries
					</Link>
					<Link href='/dashboard/runners' data-tour={navigation?.mobile ? "runners-tab" : undefined}>
						Runner
					</Link>
					<Link href='/dashboard/clips'>Clip Inventory</Link>
				</nav>
			) : null}
			<div className={overview?.ok && overview.count === 0 ? "grid gap-6" : "grid gap-6 lg:grid-cols-2"}>
				<Card>
					<Card.Header>
						<Card.Title>Recent streams</Card.Title>
						<Card.Description>Available Twitch broadcasts, including streams without clips</Card.Description>
					</Card.Header>
					<Card.Content>
						{broadcasts?.ok ? (
							<>
								{broadcasts.stale ? (
									<p role='status' className='mb-3 text-warning-soft-foreground'>
										Showing saved broadcasts. Twitch could not refresh them.
									</p>
								) : null}
								{broadcasts.items.length ? (
									broadcasts.items.slice(0, 5).map((stream) => (
										<div key={stream.id} className='flex flex-wrap items-center justify-between gap-2 border-b border-default py-3'>
											<Link href={`/dashboard/streams/${stream.id}`}>{stream.title || "Untitled stream"}</Link>
											<span className='text-sm text-muted'>
												{stream.clipCount === null ? "Clip counts unavailable" : `${stream.clipCount} ${stream.clipCount === 1 ? "clip" : "clips"}`} <LocalizedDate value={stream.createdAt} />
											</span>
										</div>
									))
								) : (
									<p className='text-muted'>No available broadcasts. Twitch may remove older broadcasts.</p>
								)}
							</>
						) : broadcasts ? (
							<div role='alert'>
								<p>{broadcasts.code === "RECONNECT_REQUIRED" ? "Reconnect Twitch to load your broadcasts." : "Broadcasts could not be loaded. Your clip data is kept."}</p>
								{broadcasts.code === "RECONNECT_REQUIRED" ? <Link href='/dashboard/settings?tab=connections'>Manage linked accounts</Link> : null}
								<Button variant='secondary' onPress={() => setRetryBroadcasts((value) => value + 1)}>
									Retry broadcasts
								</Button>
							</div>
						) : (
							<p role='status'>Loading broadcasts…</p>
						)}
						<Link className='mt-4' href='/dashboard/streams'>
							View all streams
						</Link>
					</Card.Content>
				</Card>
				{!(overview?.ok && overview.count === 0) ? (
					<Card>
						<Card.Header>
							<Card.Title>Top clips</Card.Title>
							<Card.Description>Your most viewed clips from the last 30 days</Card.Description>
						</Card.Header>
						<Card.Content>
							{overview?.ok ? (
								overview.topClips.length ? (
									<div className='divide-y divide-default'>
										{overview.topClips.map((clip) => (
											<div key={clip.id} data-top-clip-id={clip.id} className='flex items-center justify-between gap-4 py-3'>
												<Button variant='tertiary' className='h-auto min-w-0 justify-start whitespace-normal p-0 text-left font-medium' onPress={() => setPreview(clip)}>
													{clip.title || "Untitled clip"}
												</Button>
												<span className='shrink-0 text-sm'>{clip.views.toLocaleString()} views</span>
											</div>
										))}
									</div>
								) : (
									<p className='text-muted'>No clips from the last 30 days. Browse your inventory to find older clips.</p>
								)
							) : (
								<p className='text-muted'>{overview ? "Clip performance unavailable." : "Loading clips…"}</p>
							)}
						</Card.Content>
					</Card>
				) : null}
			</div>
			{preview ? <ClipPreview creatorId={creatorId} clip={preview} onClose={() => setPreview(null)} /> : null}
		</div>
	);
}
