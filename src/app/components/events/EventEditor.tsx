"use client";
import { useState } from "react";
import { Button, Card, Label, Link, Switch, Tabs, TextArea, TextField } from "@heroui/react";
import UpgradeModal from "@components/upgradeModal";
import type { AuthenticatedUser } from "@types";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import { saveEventAction, publishEventAction, publishEventResultsAction, rotateEventPresenterAction } from "@actions/events";
import type { ManagedAwardEvent } from "@lib/eventConfiguration";
import { eventInputSchema, type EventConfiguration } from "@lib/eventConfiguration";
import { eventPhase } from "@lib/events";
import { EventText, EventSelect, EventNumber } from "./EventFields";
import EventRoadmap from "./EventRoadmap";
import EventCategories from "./EventCategories";
import EventReview from "./EventReview";
import EventConnections from "./EventConnections";
import EventDeckEditor from "./EventDeckEditor";
export default function EventEditor({ creatorId, initial, user, canWhiteLabel = false }: { creatorId: string; initial: ManagedAwardEvent; user?: AuthenticatedUser; canWhiteLabel?: boolean }) {
	const [upgrade, setUpgrade] = useState(false);
	const [event, setEvent] = useState(initial),
		[draft, setDraft] = useState(initial.configuration),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[message, setMessage] = useState(""),
		[presenterUrl, setPresenterUrl] = useState("");
	const phase = eventPhase({ schedule: event.configuration.schedule, published: !!event.publishedAt, resultsPublished: !!event.resultsPublishedAt, reviewReleased: event.reviewReleased });
	const update = (patch: Partial<EventConfiguration>) => setDraft({ ...draft, ...patch });
	async function save(publish = false) {
		setError("");
		setMessage("");
		const parsed = eventInputSchema.safeParse(draft);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Check your event settings.");
			return;
		}
		setBusy(true);
		try {
			const result = await saveEventAction(creatorId, event.id, event.revision, parsed.data);
			if (!result.ok) {
				setError(result.code === "CONFLICT" ? "This event changed in another tab. Your edits are preserved; reopen the event before saving again." : "Your event could not be saved. Check the settings and try again.");
				return;
			}
			setEvent(result.event);
			setDraft(result.event.configuration);
			if (publish) {
				const published = await publishEventAction(creatorId, event.id, result.event.revision);
				if (!published.ok) {
					setError(published.code === "STORAGE_REQUIRED" ? "Connect storage before publishing upload categories." : published.code === "PARTNER_REQUIRED" ? "Only Clipify partners can list public events. Choose an unlisted event." : "Your event was saved, but could not be published. Please try again.");
					return;
				}
				setEvent(published.event);
				setMessage("Your event is published.");
			} else setMessage("Event saved.");
		} catch {
			setError("Your event could not be saved. Your edits are preserved.");
		} finally {
			setBusy(false);
		}
	}
	async function presenter() {
		setBusy(true);
		setError("");
		try {
			const result = await rotateEventPresenterAction(creatorId, event.id);
			if (result.ok) setPresenterUrl(`${window.location.origin}/events/${event.id}/present#${result.presenterSecret}`);
			else setError("The presenter link could not be created. Please retry.");
		} finally {
			setBusy(false);
		}
	}
	async function publishResults() {
		setBusy(true);
		setError("");
		try {
			const result = await publishEventResultsAction(creatorId, event.id);
			if (result.ok) {
				setEvent(result.event);
				setMessage("Results published.");
			} else setError("Results can be published after voting closes. Please try again then.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<DashboardEditorLayout>
			<Card>
				<Card.Header className='flex w-full flex-row flex-wrap items-start justify-between gap-4'>
					<div className='space-y-2'>
						<Link href='/dashboard/events'>Back to events</Link>
						<Card.Title>{event.configuration.title}</Card.Title>
						<Card.Description>{phase === "draft" ? "Prepare your community award show." : `Current phase: ${phase}`}</Card.Description>
					</div>
					<div className='flex flex-wrap gap-2'>
						{!event.publishedAt ? (
							<>
								<Button variant='secondary' isPending={busy} onPress={() => void save()}>
									Save event
								</Button>
								<Button isDisabled={busy} onPress={() => void save(true)}>
									Publish event
								</Button>
							</>
						) : (
							<>
								<Link href={`/events/${event.id}`}>Open event</Link>
								<Button variant='secondary' isDisabled={busy} onPress={() => void presenter()}>
									New presenter link
								</Button>
								{phase === "closed" ? (
									<Button isDisabled={busy} onPress={() => void publishResults()}>
										Publish results
									</Button>
								) : null}
							</>
						)}
					</div>
				</Card.Header>
				<Card.Content className='space-y-5'>
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
					{message ? (
						<p role='status' className='text-sm text-success'>
							{message}
						</p>
					) : null}
					{presenterUrl ? (
						<div className='rounded-xl bg-default/40 p-4'>
							<p className='text-sm'>Keep this link private. Previous presenter links no longer work.</p>
							<Link href={presenterUrl} target='_blank'>
								Open presenter
							</Link>
							<Button variant='tertiary' onPress={() => void navigator.clipboard.writeText(presenterUrl)}>
								Copy presenter link
							</Button>
						</div>
					) : null}
					<Tabs defaultSelectedKey='event'>
						<Tabs.ListContainer>
							<Tabs.List aria-label='Event editor sections'>
								{["event", "roadmap", "categories", "review", "connections", "presentation"].map((id) => (
									<Tabs.Tab key={id} id={id}>
										{id === "event" ? "Event" : id === "roadmap" ? "Roadmap" : id === "categories" ? "Categories" : id === "review" ? "Review" : id === "connections" ? "Connections" : "Presentation"}
									</Tabs.Tab>
								))}
							</Tabs.List>
						</Tabs.ListContainer>
						<Tabs.Panel id='event' className='space-y-5 pt-5'>
							<fieldset disabled={!!event.publishedAt} className='space-y-5'>
								<EventText label='Event title' value={draft.title} onChange={(title) => update({ title })} />
								<TextField>
									<Label>Description</Label>
									<TextArea aria-label='Description' variant='secondary' value={draft.description} onChange={(e) => update({ description: e.target.value })} />
								</TextField>
								<div className='grid gap-5 sm:grid-cols-2'>
									<EventSelect
										label='Visibility'
										value={draft.visibility}
										onChange={(visibility) => update({ visibility: visibility as EventConfiguration["visibility"] })}
										options={[
											{ id: "unlisted", label: "Unlisted" },
											{ id: "public", label: "Public (partners)" },
										]}
									/>
									<EventNumber label='Maximum votes per category' min={1} max={100} value={draft.votesPerCategory} onChange={(votesPerCategory) => update({ votesPerCategory })} />
									<EventSelect
										label='Tied winners'
										value={draft.tiePolicy}
										onChange={(tiePolicy) => update({ tiePolicy: tiePolicy as EventConfiguration["tiePolicy"] })}
										options={[
											{ id: "shared", label: "Shared winners" },
											{ id: "team", label: "Team decides" },
										]}
									/>
									<EventSelect
										label='Published results'
										value={draft.resultDetail}
										onChange={(resultDetail) => update({ resultDetail: resultDetail as EventConfiguration["resultDetail"] })}
										options={[
											{ id: "winner", label: "Winners only" },
											{ id: "percentages", label: "Winners and percentages" },
											{ id: "votes", label: "Winners, percentages and votes" },
										]}
									/>
								</div>
								<Switch
									isSelected={draft.whiteLabel}
									onChange={(whiteLabel) => {
										if (whiteLabel && !canWhiteLabel) {
											setUpgrade(true);
											return;
										}
										update({ whiteLabel });
									}}
								>
									<Switch.Control>
										<Switch.Thumb />
									</Switch.Control>
									<Switch.Content>
										<Label>Hide Clipify branding (Pro)</Label>
									</Switch.Content>
								</Switch>
							</fieldset>
						</Tabs.Panel>
						<Tabs.Panel id='roadmap' className='pt-5'>
							<EventRoadmap value={draft.schedule} phase={phase} readOnly={!!event.publishedAt} onChange={(schedule) => update({ schedule })} />
						</Tabs.Panel>
						<Tabs.Panel id='categories' className='pt-5'>
							<EventCategories timezone={draft.schedule.timezone} value={draft.categories} readOnly={!!event.publishedAt} onChange={(categories) => update({ categories })} />
						</Tabs.Panel>
						<Tabs.Panel id='review' className='pt-5'>
							<EventReview creatorId={creatorId} eventId={event.id} />
						</Tabs.Panel>
						<Tabs.Panel id='connections' className='pt-5'>
							<EventConnections creatorId={creatorId} eventId={event.id} value={draft.storageConnectionId} readOnly={!!event.publishedAt} onChange={(storageConnectionId) => update({ storageConnectionId })} />
						</Tabs.Panel>
						<Tabs.Panel id='presentation' className='pt-5'>
							<EventDeckEditor value={draft.slides} categories={draft.categories} readOnly={!!event.publishedAt} onChange={(slides) => update({ slides })} />
						</Tabs.Panel>
					</Tabs>
				</Card.Content>
			</Card>
			{user ? <UpgradeModal user={user} isOpen={upgrade} onOpenChange={setUpgrade} title='Make your award show your own' description='Remove Clipify branding with Pro.' feature='event_branding' /> : null}
		</DashboardEditorLayout>
	);
}
