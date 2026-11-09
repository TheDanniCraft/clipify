"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Link, Skeleton } from "@heroui/react";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import ResourceLoadError from "@components/resourceLoadError";
import { createEventAction, listEventsAction } from "@actions/events";
import { createAwardConfiguration } from "@lib/eventDefaults";
import LocalizedDate from "@components/localizedDate";
export default function EventLibrary({ creatorId }: { creatorId: string }) {
	const router = useRouter();
	const [library, setLibrary] = useState<Awaited<ReturnType<typeof listEventsAction>>>();
	const [attempt, setAttempt] = useState(0),
		[busy, setBusy] = useState(false),
		[error, setError] = useState("");
	useEffect(() => {
		let active = true;
		void listEventsAction(creatorId)
			.then((result) => {
				if (active) setLibrary(result);
			})
			.catch(() => {
				if (active) setLibrary({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			active = false;
		};
	}, [creatorId, attempt]);
	async function create() {
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			const result = await createEventAction(creatorId, createAwardConfiguration("New event", Intl.DateTimeFormat().resolvedOptions().timeZone));
			if (!result.ok) {
				setError("Your event could not be created. Please try again.");
				return;
			}
			router.push(`/dashboard/events/${result.event.id}`);
		} catch {
			setError("Your event could not be created. Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<DashboardEditorLayout>
			<Card data-tour='event-library'>
				<Card.Header className='flex flex-row flex-wrap justify-between gap-4'>
					<div>
						<Card.Title>Events</Card.Title>
						<Card.Description>Create and manage events for your community.</Card.Description>
					</div>
					<Button isPending={busy} isDisabled={busy} onPress={() => void create()}>
						Create event
					</Button>
				</Card.Header>
				<Card.Content className='space-y-4'>
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
					{!library ? (
						<Skeleton className='h-32 rounded-xl' />
					) : !library.ok ? (
						<ResourceLoadError message='Events could not be loaded.'>
							<Button
								size='sm'
								variant='secondary'
								onPress={() => {
									setLibrary(undefined);
									setAttempt((a) => a + 1);
								}}
							>
								Retry events
							</Button>
						</ResourceLoadError>
					) : library.events.length ? (
						<div className='grid gap-3'>
							{library.events.map((event) => (
								<Link key={event.id} href={`/dashboard/events/${event.id}`} className='flex flex-wrap items-center justify-between gap-3 rounded-xl bg-default/40 p-4'>
									<div>
										<p className='font-medium'>{event.configuration.title}</p>
										<p className='text-sm text-muted'>{event.resultsPublishedAt ? "Results published" : event.publishedAt ? "Published" : "Draft"}</p>
									</div>
									<LocalizedDate value={event.createdAt} />
								</Link>
							))}
						</div>
					) : (
						<div className='py-10 text-center'>
							<h2 className='font-medium'>No events yet</h2>
							<p className='mt-2 text-sm text-muted'>Create an event and bring your community together.</p>
						</div>
					)}
				</Card.Content>
			</Card>
		</DashboardEditorLayout>
	);
}
