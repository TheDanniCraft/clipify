"use client";
import { notify } from "@lib/toast";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Link, Skeleton, Spinner, Table, Chip } from "@heroui/react";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import ResourceLoadError from "@components/resourceLoadError";
import { createEventAction, createEventExampleAction, listEventsAction } from "@actions/events";
import { createAwardConfiguration } from "@lib/eventDefaults";
import LocalizedDate from "@components/localizedDate";
export default function EventLibrary({ creatorId }: { creatorId: string }) {
	const router = useRouter();
	const [library, setLibrary] = useState<Awaited<ReturnType<typeof listEventsAction>>>();
	const [attempt, setAttempt] = useState(0),
		[busy, setBusy] = useState(false);
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
	async function create(example = false) {
		if (busy) return;
		setBusy(true);
		try {
			const result = example ? await createEventExampleAction(creatorId) : await createEventAction(creatorId, createAwardConfiguration("New event", Intl.DateTimeFormat().resolvedOptions().timeZone));
			if (!result.ok) {
				notify({ title: "Your event could not be created. Please try again.", color: "danger" });
				setBusy(false);
				return;
			}
			router.push(`/dashboard/events/${result.event.id}`);
		} catch {
			notify({ title: "Your event could not be created. Please try again.", color: "danger" });
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
					<div className='flex flex-wrap gap-2'>
						<Button variant='secondary' isDisabled={busy} onPress={() => void create(true)}>
							Use Babbler example
						</Button>
						<Button isPending={busy} isDisabled={busy} onPress={() => void create()}>
							{busy ? <Spinner aria-hidden='true' size='sm' color='current' /> : null}
							Create event
						</Button>
					</div>
				</Card.Header>
				<Card.Content className='space-y-4' aria-busy={busy}>
					{busy ? (
						<p role='status' className='flex items-center gap-2 text-sm text-muted'>
							<Spinner aria-hidden='true' size='sm' />
							Creating event…
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
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Events' onRowAction={(key) => router.push(`/dashboard/events/${key}`)}>
									<Table.Header>
										<Table.Column isRowHeader>Name</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column className='hidden md:table-cell'>Created</Table.Column>
										<Table.Column>Actions</Table.Column>
									</Table.Header>
									<Table.Body items={library.events}>
										{(event) => (
											<Table.Row id={event.id} textValue={event.configuration.title}>
												<Table.Cell>
													<Link href={`/dashboard/events/${event.id}`} className='font-medium text-foreground'>
														{event.configuration.title}
													</Link>
												</Table.Cell>
												<Table.Cell>
													<Chip size='sm' variant='soft'>
														{event.resultsPublishedAt ? "Results published" : event.publishedAt ? "Published" : "Draft"}
													</Chip>
												</Table.Cell>
												<Table.Cell className='hidden md:table-cell'>
													<LocalizedDate value={event.createdAt} />
												</Table.Cell>
												<Table.Cell>
													<Link href={`/dashboard/events/${event.id}`} className='text-sm'>
														Edit event
													</Link>
												</Table.Cell>
											</Table.Row>
										)}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
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
