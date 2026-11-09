"use client";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Link } from "@heroui/react";
import { listPublicEventsAction } from "@actions/events";
import LocalizedDate from "@components/localizedDate";
type Listing = Extract<Awaited<ReturnType<typeof listPublicEventsAction>>, { ok: true }>;
const phases = { announcement: "Coming soon", submissions: "Suggest nominees", review: "Nominations in review", voting: "Voting open", closed: "Voting closed", results: "View winners", draft: "Draft" };
export default function EventDiscovery({ preview = false }: { preview?: boolean }) {
	const [data, setData] = useState<Listing | null>(null),
		[error, setError] = useState(false),
		[attempt, setAttempt] = useState(0);
	useEffect(() => {
		let active = true;
		listPublicEventsAction()
			.then((result) => {
				if (!active) return;
				if (result.ok) {
					setData(result);
					setError(false);
				} else setError(true);
			})
			.catch(() => {
				if (active) setError(true);
			});
		return () => {
			active = false;
		};
	}, [attempt]);
	const items = preview ? data?.events.slice(0, 3) : data?.events;
	return (
		<section aria-label='Community events' className='space-y-7'>
			<header className='flex flex-wrap items-end justify-between gap-4'>
				<div>
					<h2 className='text-3xl font-bold'>Community events</h2>
					<p className='mt-3 text-muted'>Celebrate your favorite stream moments. Suggest nominees, vote and revisit the winners.</p>
				</div>
				{preview ? <Link href='/events'>Explore events</Link> : null}
			</header>
			{error ? (
				<div role='alert' className='space-y-3'>
					<p>Events could not load.</p>
					<Button
						variant='secondary'
						onPress={() => {
							setError(false);
							setAttempt((value) => value + 1);
						}}
					>
						Try again
					</Button>
				</div>
			) : !data ? (
				<p role='status' className='text-muted'>
					Loading events…
				</p>
			) : !items?.length ? (
				<Card>
					<Card.Content className='py-10 text-center'>
						<h3 className='text-xl font-semibold'>No public events right now</h3>
						<p className='mt-3 text-muted'>Check back for the next community award show.</p>
					</Card.Content>
				</Card>
			) : (
				<div className='grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
					{items.map((event) => (
						<Card key={event.id}>
							<Card.Header className='space-y-3'>
								<Chip variant='soft'>{phases[event.phase]}</Chip>
								<Card.Title className='break-words text-xl'>{event.title}</Card.Title>
								<p className='text-sm text-muted'>Hosted by {event.creatorName}</p>
							</Card.Header>
							<Card.Content className='space-y-3'>
								{event.description ? <p className='line-clamp-3 whitespace-pre-wrap break-words text-muted'>{event.description}</p> : null}
								{event.phase === "announcement" ? (
									<p className='text-sm text-muted'>
										Starts <LocalizedDate value={event.startsAt} showTime />
									</p>
								) : null}
							</Card.Content>
							<Card.Footer>
								<Link href={`/events/${event.id}`}>{phases[event.phase]}</Link>
							</Card.Footer>
						</Card>
					))}
				</div>
			)}
		</section>
	);
}
