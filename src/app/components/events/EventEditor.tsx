"use client";
import { useContext, useState } from "react";
import { Button, Card, Label, Link, Switch, Tabs, TextArea, TextField } from "@heroui/react";
import { DashboardNavigationContext } from "@components/dashboardNavigation";
import { eventEditorSections, type EventEditorSection } from "@lib/dashboardSections";
import UpgradeModal from "@components/upgradeModal";
import type { AuthenticatedUser } from "@types";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import { saveEventAction, saveEventPresentationAction, publishEventAction, publishEventResultsAction, rotateEventPresenterAction } from "@actions/events";
import { defaultAwardSlides } from "@lib/eventPresenter";
import type { ManagedAwardEvent } from "@lib/eventConfiguration";
import { DEFAULT_AWARD_PRESENTATION, eventInputSchema, type EventConfiguration } from "@lib/eventConfiguration";
import { eventPhase } from "@lib/events";
import { EventText, EventSelect, EventNumber } from "./EventFields";
import EventRoadmap from "./EventRoadmap";
import EventCategories from "./EventCategories";
import EventPresentationSettings from "./EventPresentationSettings";
import EventTieResults from "./EventTieResults";
import EventDataResults from "./EventDataResults";
import EventReview from "./EventReview";
import EventConnections from "./EventConnections";
import EventPresentationEditor from "./EventPresentationEditor";
export default function EventEditor({ creatorId, initial, user, canWhiteLabel = false, connectionStatus }: { creatorId: string; initial: ManagedAwardEvent; user?: AuthenticatedUser; canWhiteLabel?: boolean; connectionStatus?: "connected" | "retry" }) {
	const navigation = useContext(DashboardNavigationContext);
	const [localSection, setLocalSection] = useState<EventEditorSection>("event");
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
			const result = event.publishedAt ? await saveEventPresentationAction(creatorId, event.id, event.revision, { slides: parsed.data.slides, presentation: parsed.data.presentation }) : await saveEventAction(creatorId, event.id, event.revision, parsed.data);
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
			return true;
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
		} catch {
			setError("The presenter link could not be created. Please retry.");
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
			} else setError(result.code === "RESULTS_REQUIRED" ? "Complete the missing data awards before publishing results." : "Results can be published after voting closes. Please try again then.");
		} catch {
			setError("Results could not be published. Please retry.");
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
						<Card.Description>{phase === "draft" ? "Configure your community event." : `Current phase: ${phase}`}</Card.Description>
					</div>
					<div className='flex flex-wrap gap-2'>
						<Button
							variant='secondary'
							onPress={() => {
								if (navigation?.eventWorkspace) navigation.eventWorkspace.select("presentation");
								else setLocalSection("presentation");
							}}
						>
							Preview event
						</Button>
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
								<Button variant='secondary' isPending={busy} onPress={() => void save()}>
									Save presentation
								</Button>
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
					<p className='text-sm text-muted'>{event.publishedAt ? "Setup is locked after publication. Continue with proposals, data awards and your presentation." : "Set your categories and roadmap, connect storage if you accept uploads, then publish. You can preview and share your draft first."}</p>
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
					<Tabs
						selectedKey={navigation?.eventWorkspace?.section ?? localSection}
						onSelectionChange={(key) => {
							const section = String(key) as EventEditorSection;
							if (navigation?.eventWorkspace) navigation.eventWorkspace.select(section);
							else setLocalSection(section);
						}}
					>
						<Tabs.ListContainer className={navigation?.eventWorkspace ? "hidden" : undefined}>
							<Tabs.List aria-label='Event editor sections'>
								{eventEditorSections.map((item) => (
									<Tabs.Tab key={item.key} id={item.key} className='whitespace-nowrap'>
										{item.title}
									</Tabs.Tab>
								))}
							</Tabs.List>
						</Tabs.ListContainer>
						<Tabs.Panel id='event' className='space-y-5 pt-5'>
							<fieldset disabled={busy || !!event.publishedAt} className='space-y-5'>
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
									<Switch.Content>
										<Switch.Control>
											<Switch.Thumb />
										</Switch.Control>
										<Label>Hide Clipify branding (Pro)</Label>
									</Switch.Content>
								</Switch>
							</fieldset>
						</Tabs.Panel>
						<Tabs.Panel id='roadmap' className='pt-5'>
							<EventRoadmap value={draft.schedule} phase={phase} readOnly={busy || !!event.publishedAt} onChange={(schedule) => update({ schedule })} />
						</Tabs.Panel>
						<Tabs.Panel id='categories' className='pt-5'>
							<EventCategories
								timezone={draft.schedule.timezone}
								value={draft.categories}
								readOnly={busy || !!event.publishedAt}
								onChange={(categories) => {
									const ids = new Set(categories.map((category) => category.id));
									const slides = draft.slides.length ? draft.slides.filter((slide) => slide.type !== "category" || (!!slide.categoryId && ids.has(slide.categoryId))) : defaultAwardSlides(categories);
									if (draft.slides.length) {
										const additions = categories.filter((category) => !draft.categories.some((previous) => previous.id === category.id)).map((category) => ({ id: crypto.randomUUID(), type: "category" as const, categoryId: category.id, title: "", text: "", statistics: [] }));
										const closing = slides.findIndex((slide) => slide.type === "closing");
										slides.splice(closing < 0 ? slides.length : closing, 0, ...additions);
									}
									update({ categories, slides });
								}}
							/>
						</Tabs.Panel>
						<Tabs.Panel id='review' className='pt-5'>
							<EventReview creatorId={creatorId} eventId={event.id} />
						</Tabs.Panel>
						<Tabs.Panel id='results' className='pt-5'>
							<EventDataResults creatorId={creatorId} eventId={event.id} resultsPublished={!!event.resultsPublishedAt} />
							{event.configuration.tiePolicy === "team" ? <EventTieResults creatorId={creatorId} eventId={event.id} locked={!!event.resultsPublishedAt} /> : null}
						</Tabs.Panel>
						<Tabs.Panel id='connections' className='pt-5'>
							<EventConnections status={connectionStatus} beforeConnect={async () => !!(await save())} creatorId={creatorId} eventId={event.id} value={draft.storageConnectionId} readOnly={busy || !!event.publishedAt} onChange={(storageConnectionId) => update({ storageConnectionId })} />
						</Tabs.Panel>
						<Tabs.Panel id='presentation' className='pt-5'>
							<EventPresentationEditor creatorId={creatorId} eventId={event.id} draft={draft} busy={busy} onChange={(slides) => update({ slides })} />
						</Tabs.Panel>
						<Tabs.Panel id='chat' className='pt-5'>
							<EventPresentationSettings value={draft.presentation ?? DEFAULT_AWARD_PRESENTATION} disabled={busy} onChange={(presentation) => update({ presentation })} />
						</Tabs.Panel>
					</Tabs>
				</Card.Content>
			</Card>
			{user ? <UpgradeModal user={user} isOpen={upgrade} onOpenChange={setUpgrade} title='Make your award show your own' description='Remove Clipify branding with Pro.' feature='event_branding' /> : null}
		</DashboardEditorLayout>
	);
}
