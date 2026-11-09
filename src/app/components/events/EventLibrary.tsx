"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Link, Modal, Skeleton, TextField } from "@heroui/react";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import ControlledModal from "@components/controlledModal";
import { createEventAction, listEventsAction } from "@actions/events";
import { createAwardConfiguration } from "@lib/eventDefaults";
import LocalizedDate from "@components/localizedDate";
export default function EventLibrary({ creatorId }: { creatorId: string }) {
	const router = useRouter();
	const [library, setLibrary] = useState<Awaited<ReturnType<typeof listEventsAction>>>();
	const [attempt, setAttempt] = useState(0),
		[open, setOpen] = useState(false),
		[title, setTitle] = useState(""),
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
			const result = await createEventAction(creatorId, createAwardConfiguration(title, Intl.DateTimeFormat().resolvedOptions().timeZone));
			if (!result.ok) {
				setError("Your event could not be created. Check the title and try again.");
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
						<Card.Description>Bring your community together for an award show.</Card.Description>
					</div>
					<Button onPress={() => setOpen(true)}>Create event</Button>
				</Card.Header>
				<Card.Content className='space-y-4'>
					{!library ? (
						<Skeleton className='h-32 rounded-xl' />
					) : !library.ok ? (
						<div>
							<p role='alert'>Events could not be loaded.</p>
							<Button variant='secondary' onPress={() => setAttempt((a) => a + 1)}>
								Retry events
							</Button>
						</div>
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
							<p className='mt-2 text-sm text-muted'>Create awards, collect nominations and celebrate your community.</p>
						</div>
					)}
				</Card.Content>
			</Card>
			<ControlledModal isOpen={open} onOpenChange={setOpen}>
				<Modal.Header>
					<Modal.Heading>Create awards</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					<TextField isRequired>
						<Label>Event title</Label>
						<Input aria-label='Event title' variant='secondary' maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
					</TextField>
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
				</Modal.Body>
				<Modal.Footer>
					<Button variant='tertiary' onPress={() => setOpen(false)}>
						Cancel
					</Button>
					<Button isPending={busy} isDisabled={!title.trim() || busy} onPress={() => void create()}>
						Create awards
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</DashboardEditorLayout>
	);
}
