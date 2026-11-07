import { redirect } from "next/navigation";
import { Card, Link } from "@heroui/react";
import { validateAuth } from "@actions/auth";
import { getCreatorBroadcasts } from "@actions/creatorLibrary";
import DashboardNavbar from "@components/dashboardNavbar";
import StreamTable from "@components/creator/streamTable";
import LocalizedDate from "@components/localizedDate";
export default async function StreamsPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { after } = await searchParams;
	const result = await getCreatorBroadcasts({ creatorId: user.id, after });
	return (
		<DashboardNavbar user={user} title='Streams' tagline='Saved streams and their clips'>
			<div className='my-6 flex flex-col gap-4'>
				<p className='text-sm text-muted'>Stream details stay here after Twitch removes a recording. Older streams appear as your library synchronizes.</p>
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
									<h2 className='font-semibold'>No saved streams yet</h2>
									<p className='text-muted'>Streams appear here when Clipify discovers their broadcasts.</p>
									<Link href='/dashboard/clips'>Open Clip Inventory</Link>
								</Card.Content>
							</Card>
						) : (
							<StreamTable streams={result.items} />
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
