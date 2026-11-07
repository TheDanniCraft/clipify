"use client";
import { useContext, useEffect, useState } from "react";
import { Button, Card, Link, Skeleton, Table } from "@heroui/react";
import { getCreatorClipOverview, getCreatorBroadcasts } from "@actions/creatorLibrary";
import ClipPreview from "./clipPreview";
import LocalizedDate from "@components/localizedDate";
import { DashboardNavigationContext } from "@components/dashboardNavigation";
import { useUserTour } from "@components/user-tour/provider";
import { getCreatorAnalytics } from "@actions/creatorAnalytics";
import { buttonVariants } from "@heroui/styles";
import { today, getLocalTimeZone } from "@internationalized/date";
import { IconHome, IconLayoutGrid, IconPlaylist, IconPhoto, IconDeviceDesktop, IconScissors, IconLock, IconChevronRight } from "@tabler/icons-react";
const cardActionClassName = "shrink-0 gap-1 text-sm underline";
type Overview = Awaited<ReturnType<typeof getCreatorClipOverview>>;
type Broadcasts = Awaited<ReturnType<typeof getCreatorBroadcasts>>;
export default function CreatorOverview({ creatorId, analyticsAllowed = false }: { creatorId: string; analyticsAllowed?: boolean }) {
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
			<nav aria-label={activeTask && navigation?.mobile ? "Creator shortcuts" : "Quick access"} className='flex flex-wrap items-center gap-2 text-sm'>
				<span className='w-full text-sm font-medium text-muted'>Quick access</span>
				{activeTask && navigation?.mobile ? (
					<Link className={buttonVariants({ variant: "secondary", className: "gap-2" })} href='/dashboard' data-tour='dashboard-home'>
						<IconHome className='size-4' aria-hidden='true' />
						Home
					</Link>
				) : null}
				{(
					[
						["Overlays", "overlays", IconLayoutGrid],
						["Playlists", "playlists", IconPlaylist],
						["Galleries", "galleries", IconPhoto],
						["Runner", "runners", IconDeviceDesktop],
					] as const
				).map(([label, path, Icon]) => (
					<Link className={buttonVariants({ variant: "secondary", className: "gap-2" })} key={path} href={`/dashboard/${path}`} data-tour={activeTask && navigation?.mobile ? `${path}-tab` : undefined}>
						<Icon className='size-4' aria-hidden='true' />
						{label}
					</Link>
				))}
				<Link className={buttonVariants({ variant: "secondary", className: "gap-2" })} href='/dashboard/clips'>
					<IconScissors className='size-4' aria-hidden='true' />
					Clip Inventory
				</Link>
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
									<div className='space-y-2 text-sm'>
										<p className='text-muted'>No clips from the last 30 days</p>
										<Link href='/dashboard/clips' className={cardActionClassName}>
											Browse clip inventory
											<Link.Icon aria-hidden='true'>
												<IconChevronRight />
											</Link.Icon>
										</Link>
									</div>
								)}
								{overview.count ? <p className='text-xs text-muted'>Total views on these clips.</p> : null}
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
						<Link href='/dashboard/streams' className={cardActionClassName}>
							View all streams
							<Link.Icon aria-hidden='true'>
								<IconChevronRight />
							</Link.Icon>
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
			<div className='grid gap-4 lg:grid-cols-2'>
				<Card role='region' aria-label='Top clips'>
					<Card.Header className='flex-row flex-wrap items-center justify-between gap-2'>
						<div>
							<Card.Title>Top clips</Card.Title>
							<p className='text-sm text-muted'>All-time most viewed clips in your library</p>
						</div>
						<Link href='/dashboard/clips' className={cardActionClassName}>
							View all clips
							<Link.Icon aria-hidden='true'>
								<IconChevronRight />
							</Link.Icon>
						</Link>
					</Card.Header>
					<Card.Content>
						{overview?.ok ? (
							overview.allTimeTopClips.length ? (
								<Table>
									<Table.ScrollContainer>
										<Table.Content aria-label='Top clips'>
											<Table.Header>
												<Table.Column isRowHeader>Clip</Table.Column>
												<Table.Column>Views</Table.Column>
												<Table.Column aria-label='Clip details'> </Table.Column>
											</Table.Header>
											<Table.Body>
												{overview.allTimeTopClips.map((clip) => (
													<Table.Row key={clip.id} data-top-clip-id={clip.id}>
														<Table.Cell>
															<Button variant='ghost' className='h-auto min-w-0 justify-start gap-3 p-0 text-left' onPress={() => setPreview(clip)}>
																{clip.thumbnailUrl ? <img src={clip.thumbnailUrl} alt='' className='aspect-video w-12 shrink-0 rounded-md object-cover sm:w-16' /> : null}
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
								<div className='space-y-3'>
									<p className='text-muted'>Your most viewed clips will appear here once your library has clips.</p>
								</div>
							)
						) : (
							<p className='text-muted'>{overview ? "Clip performance unavailable." : "Loading clips…"}</p>
						)}
					</Card.Content>
				</Card>
				<CreatorPageInsights key={creatorId} creatorId={creatorId} allowed={analyticsAllowed} />
			</div>
			{preview ? <ClipPreview creatorId={creatorId} clip={preview} onClose={() => setPreview(null)} /> : null}
		</div>
	);
}

function CreatorPageInsights({ creatorId, allowed }: { creatorId: string; allowed: boolean }) {
	const [data, setData] = useState<Awaited<ReturnType<typeof getCreatorAnalytics>> | undefined>();
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		if (!allowed) return;
		let current = true;
		const end = today(getLocalTimeZone());
		void getCreatorAnalytics(creatorId, { start: end.subtract({ days: 29 }).toString(), end: end.toString() })
			.then((value) => {
				if (current) setData(value);
			})
			.catch(() => {
				if (current) setData(null);
			});
		return () => {
			current = false;
		};
	}, [creatorId, allowed, retry]);
	return (
		<Card aria-label='Creator Page insights' className='self-start'>
			<Card.Header>
				<Card.Title>Creator Page insights</Card.Title>
				<Card.Description>Visitors and clip plays in the last 30 days</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4'>
				{!allowed ? (
					<div className='space-y-4'>
						<IconLock className='size-5 text-muted' aria-hidden='true' />
						<p className='font-medium'>Get to know your audience with Pro</p>
						<p className='text-sm text-muted'>Track visits to your Creator Page and plays on your clips.</p>
						<Link className={buttonVariants({ variant: "secondary" })} href='/dashboard/settings?tab=billing&upgrade=1&feature=creator_analytics&source=paywall_banner'>
							Unlock with Pro
						</Link>
					</div>
				) : data === undefined ? (
					<Skeleton className='h-32 rounded-xl' />
				) : data ? (
					<>
						<dl className='grid grid-cols-2 gap-4'>
							{(
								[
									["visitors", "Visitors"],
									["pageviews", "Page views"],
									["visits", "Visits"],
									["clipPlays", "Clip plays"],
								] as const
							).map(([key, label]) => (
								<div key={key}>
									<dt className='text-sm text-muted'>{label}</dt>
									<dd role='status' aria-label={`Creator Page ${label.toLowerCase()}`} className='mt-2 text-2xl font-semibold tabular-nums'>
										{data.metrics[key].toLocaleString()}
									</dd>
								</div>
							))}
						</dl>
						<p className='text-xs text-muted'>
							{data.stale ? "Showing saved analytics. " : ""}Updated <LocalizedDate value={data.fetchedAt} showTime />
						</p>
					</>
				) : (
					<div className='space-y-3'>
						<p role='status' className='text-sm text-muted'>
							Creator Page analytics are unavailable right now.
						</p>
						<Button
							variant='secondary'
							onPress={() => {
								setData(undefined);
								setRetry((value) => value + 1);
							}}
						>
							Retry page analytics
						</Button>
					</div>
				)}
			</Card.Content>
			{allowed ? (
				<Card.Footer>
					<Link href='/dashboard/settings?tab=creator' className={cardActionClassName}>
						Manage Creator Page
						<Link.Icon aria-hidden='true'>
							<IconChevronRight />
						</Link.Icon>
					</Link>
				</Card.Footer>
			) : null}
		</Card>
	);
}
