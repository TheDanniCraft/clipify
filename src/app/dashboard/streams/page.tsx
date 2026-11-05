import { redirect } from "next/navigation";
import { Card, Link, Table } from "@heroui/react";
import { validateAuth } from "@actions/auth";
import { getCreatorBroadcasts } from "@actions/creatorLibrary";
import DashboardNavbar from "@components/dashboardNavbar";
import LocalizedDate from "@components/localizedDate";
export default async function StreamsPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { after } = await searchParams;
	const result = await getCreatorBroadcasts({ creatorId: user.id, after });
	return (
		<DashboardNavbar user={user} title='Streams' tagline='Available Twitch broadcasts and their known clips'>
			<div className='my-6 flex flex-col gap-4'>
				<p className='text-sm text-muted'>Older broadcasts may no longer be available on Twitch. Your cached clips stay in Clip Inventory.</p>
				{!result.ok ? (
					<Card>
						<Card.Content>
							<p role='alert'>{result.code === "RECONNECT_REQUIRED" ? "Reconnect Twitch to load your broadcasts." : "Broadcasts could not be loaded. Please try again."}</p>
							<Link href='/dashboard/streams'>Retry streams</Link>
							{result.code === "RECONNECT_REQUIRED" ? <Link href='/dashboard/settings'>Manage linked accounts</Link> : null}
						</Card.Content>
					</Card>
				) : (
					<>
						<p className='text-sm text-muted'>
							{result.stale ? "Showing saved broadcasts. Twitch could not refresh them." : "Broadcasts updated"} <LocalizedDate value={result.fetchedAt} showTime />
						</p>
						{!result.items.length ? (
							<Card>
								<Card.Content>
									<h2 className='font-semibold'>No available broadcasts</h2>
									<p className='text-muted'>Streams appear here when Twitch makes their recordings available.</p>
									<Link href='/dashboard/clips'>Open Clip Inventory</Link>
								</Card.Content>
							</Card>
						) : (
							<Table>
								<Table.ScrollContainer>
									<Table.Content aria-label='Available streams' className='w-full lg:min-w-[560px]'>
										<Table.Header>
											<Table.Column isRowHeader>Stream</Table.Column>
											<Table.Column className='hidden lg:table-cell'>Created</Table.Column>
											<Table.Column className='hidden lg:table-cell'>Duration</Table.Column>
											<Table.Column>Known clips</Table.Column>
											<Table.Column className='hidden lg:table-cell'>Clip views</Table.Column>
										</Table.Header>
										<Table.Body>
											{result.items.map((stream) => (
												<Table.Row key={stream.id} data-broadcast-id={stream.id}>
													<Table.Cell>
														<div className='flex min-w-0 items-center gap-3'>
															{stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt='' className='aspect-video w-20 shrink-0 rounded-md object-cover' /> : null}
															<Link className='line-clamp-2 min-w-0' href={`/dashboard/streams/${stream.id}`}>
																{stream.title || "Untitled stream"}
															</Link>
														</div>
														<div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted lg:hidden'>
															<LocalizedDate value={stream.createdAt} showTime />
															<span>{stream.duration}</span>
															<span>{stream.clipViews === null ? "Views unavailable" : `${stream.clipViews.toLocaleString()} views`}</span>
														</div>
													</Table.Cell>
													<Table.Cell className='hidden lg:table-cell'>
														<LocalizedDate value={stream.createdAt} showTime />
													</Table.Cell>
													<Table.Cell className='hidden lg:table-cell'>{stream.duration}</Table.Cell>
													<Table.Cell>{stream.clipCount === null ? "Unavailable" : stream.clipCount.toLocaleString()}</Table.Cell>
													<Table.Cell className='hidden lg:table-cell'>{stream.clipViews === null ? "Unavailable" : stream.clipViews.toLocaleString()}</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table.Content>
								</Table.ScrollContainer>
							</Table>
						)}
						<div className='flex justify-between gap-3'>
							{after ? <Link href='/dashboard/streams'>Latest streams</Link> : <span />}
							{result.nextCursor ? <Link href={`/dashboard/streams?after=${encodeURIComponent(result.nextCursor)}`}>Next streams</Link> : null}
						</div>
					</>
				)}
			</div>
		</DashboardNavbar>
	);
}
