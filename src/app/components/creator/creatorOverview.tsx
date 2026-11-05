"use client";
import { useContext, useEffect, useState } from "react";
import { Button, Card, Link, Skeleton, Table } from "@heroui/react";
import { getCreatorClipOverview, getCreatorBroadcasts } from "@actions/creatorLibrary";
import ClipPreview from "./clipPreview";
import LocalizedDate from "@components/localizedDate";
import { DashboardNavigationContext } from "@components/dashboardNavigation";
import { useUserTour } from "@components/user-tour/provider";
import { IconChevronRight } from "@tabler/icons-react";
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
			<nav aria-label={activeTask && navigation?.mobile ? "Creator shortcuts" : "Quick access"} className='flex flex-wrap items-center gap-x-6 gap-y-3 text-sm'>
				<span className='text-muted'>Quick access</span>
				{activeTask && navigation?.mobile ? (
					<Link href='/dashboard' data-tour='dashboard-home'>
						Home
					</Link>
				) : null}
				{[
					["Overlays", "overlays"],
					["Playlists", "playlists"],
					["Galleries", "galleries"],
					["Runner", "runners"],
				].map(([label, path]) => (
					<Link key={path} href={`/dashboard/${path}`} data-tour={activeTask && navigation?.mobile ? `${path}-tab` : undefined}>
						{label}
					</Link>
				))}
				<Link href='/dashboard/clips'>Clip Inventory</Link>
			</nav>
			<div className='grid gap-4 lg:grid-cols-2' aria-label='Stream overview'>
				<Card>
					<Card.Header>
						<Card.Title>Clip performance</Card.Title>
						<Card.Description>Clips created in the last 30 days</Card.Description>
					</Card.Header>
					<Card.Content className='flex flex-col gap-4'>
						{overview?.ok ? (
							<>
								{overview.count ? (
									<dl className='grid grid-cols-2 gap-4'>
										<div>
											<dt className='text-sm text-muted'>Clips</dt>
											<dd role='status' aria-label='Known clips' className='mt-2 text-3xl font-semibold tabular-nums'>
												{overview.count.toLocaleString()}
											</dd>
										</div>
										<div>
											<dt className='text-sm text-muted'>Current clip views</dt>
											<dd role='status' aria-label='Current clip views' className='mt-2 text-3xl font-semibold tabular-nums'>
												{overview.views.toLocaleString()}
											</dd>
										</div>
									</dl>
								) : (
									<div>
										<p className='font-medium'>No clips from the last 30 days</p>
										<Link href='/dashboard/clips'>Browse clip inventory</Link>
									</div>
								)}
								<p className='text-xs text-muted'>
									Total views on these clips. {overview.complete ? "Library synchronized." : "These are known clips; older clips may still be syncing."} Dates use {overview.timeZone}.
									{overview.fetchedAt ? (
										<>
											{" "}
											Updated <LocalizedDate value={overview.fetchedAt} showTime />
										</>
									) : null}
								</p>
							</>
						) : overview ? (
							<div>
								<p role='alert'>{overview.code === "RECONNECT_REQUIRED" ? "Reconnect Twitch to load your clips." : "Clip performance could not be loaded."}</p>
								{overview.code === "RECONNECT_REQUIRED" ? <Link href='/dashboard/settings?tab=connections'>Manage linked accounts</Link> : null}
								<Button variant='secondary' onPress={() => setRetryOverview((v) => v + 1)}>
									Retry
								</Button>
							</div>
						) : (
							<Skeleton className='h-24 rounded-xl' />
						)}
					</Card.Content>
				</Card>
				<Card>
					<Card.Header className='flex-row items-center justify-between gap-3'>
						<Card.Title>Latest stream</Card.Title>
						<Link href='/dashboard/streams' className='shrink-0 text-sm'>
							View all streams
						</Link>
					</Card.Header>
					<Card.Content className='flex flex-col gap-3'>
						{broadcasts?.ok ? (
							<>
								{broadcasts.stale ? (
									<p role='status' className='text-sm text-warning-soft-foreground'>
										Showing saved broadcasts. Twitch could not refresh them.
									</p>
								) : null}
								{broadcasts.items.length ? (
									broadcasts.items.slice(0, 1).map((stream) => (
										<div key={stream.id} className='flex min-w-0 items-start gap-3'>
											{stream.thumbnailUrl ? <img alt='' src={stream.thumbnailUrl} className='aspect-video w-24 shrink-0 rounded-lg object-cover' /> : null}
											<div className='min-w-0 space-y-2'>
												<Link className='line-clamp-2 font-medium' href={`/dashboard/streams/${stream.id}`}>
													{stream.title || "Untitled stream"}
												</Link>
												<p className='text-sm text-muted'>
													<LocalizedDate value={stream.createdAt} />
													{stream.duration ? `, ${stream.duration}` : ""}
												</p>
												<p className='text-sm text-muted'>
													{stream.clipCount === null ? "Clip counts unavailable" : `${stream.clipCount} ${stream.clipCount === 1 ? "clip" : "clips"}`}
													{stream.clipViews !== null && stream.clipViews !== undefined ? `, ${stream.clipViews.toLocaleString()} clip views` : ""}
												</p>
											</div>
										</div>
									))
								) : (
									<p className='text-muted'>No available broadcasts. Twitch may remove older broadcasts.</p>
								)}
							</>
						) : broadcasts ? (
							<div>
								<p role='alert'>{broadcasts.code === "RECONNECT_REQUIRED" ? "Reconnect Twitch to load your broadcasts." : "Broadcasts could not be loaded. Your clip data is kept."}</p>
								{broadcasts.code === "RECONNECT_REQUIRED" ? <Link href='/dashboard/settings?tab=connections'>Manage linked accounts</Link> : null}
								<Button variant='secondary' onPress={() => setRetryBroadcasts((v) => v + 1)}>
									Retry broadcasts
								</Button>
							</div>
						) : (
							<Skeleton className='h-24 rounded-xl' />
						)}
					</Card.Content>
				</Card>
			</div>
			{!(overview?.ok && overview.count === 0) ? (
				<section aria-label='Top clips'>
					<div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
						<div>
							<h2 className='font-semibold'>Top clips</h2>
							<p className='text-sm text-muted'>Your most viewed clips from the last 30 days</p>
						</div>
						<Link href='/dashboard/clips'>View all clips</Link>
					</div>
					{overview?.ok ? (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Top clips'>
									<Table.Header>
										<Table.Column isRowHeader>Clip</Table.Column>
										<Table.Column>Views</Table.Column>
										<Table.Column aria-label='Clip details'> </Table.Column>
									</Table.Header>
									<Table.Body>
										{overview.topClips.map((clip) => (
											<Table.Row key={clip.id} data-top-clip-id={clip.id}>
												<Table.Cell>
													<Button variant='ghost' className='h-auto min-w-0 justify-start gap-3 p-0 text-left' onPress={() => setPreview(clip)}>
														{clip.thumbnailUrl ? <img src={clip.thumbnailUrl} alt='' className='aspect-video w-20 shrink-0 rounded-md object-cover' /> : null}
														<span className='line-clamp-2 whitespace-normal'>{clip.title || "Untitled clip"}</span>
													</Button>
												</Table.Cell>
												<Table.Cell className='whitespace-nowrap tabular-nums'>{clip.views.toLocaleString()} views</Table.Cell>
												<Table.Cell>
													<Link aria-label={`Details for ${clip.title || "Untitled clip"}`} href={`/dashboard/clips/${encodeURIComponent(clip.id)}`}>
														<IconChevronRight className='size-4' />
													</Link>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					) : (
						<p className='text-muted'>{overview ? "Clip performance unavailable." : "Loading clips…"}</p>
					)}
				</section>
			) : null}
			{preview ? <ClipPreview creatorId={creatorId} clip={preview} onClose={() => setPreview(null)} /> : null}
		</div>
	);
}
