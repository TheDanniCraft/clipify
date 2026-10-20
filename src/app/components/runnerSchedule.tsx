"use client";
import { useDeploymentDraft } from "@lib/deploymentDrafts";

import RunnerDestinations from "./runnerDestinations";
import BroadcastDetails from "./runner/BroadcastDetails";
import type { StreamDetails } from "@/app/lib/runnerProviderDetails";
import LocalizedDate from "@components/localizedDate";
import { useCallback, useEffect, useState, useRef, useTransition } from "react";
import { Button, Checkbox, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField, Tabs } from "@heroui/react";
import { IconPlus, IconEye, IconPencil, IconPlayerPause, IconPlayerPlay, IconCrown } from "@tabler/icons-react";
import { listRunnerScheduleEvents, listRunnerDestinations, saveRunnerScheduleEvent, renameRunnerScheduleEvent, deleteRunnerScheduleEvent, resumeRunnerScheduleOccurrence, setRunnerAutomationPaused } from "@/app/actions/runner";
import RunnerDestinationSelection from "./runnerDestinationSelection";
import { plannerCreateWindow, isAllDayWindow } from "./runnerSchedulePlanner";
import RunnerScheduleAgenda from "./runnerScheduleAgenda";
import { ScheduleDateField, ScheduleTimeField, TimezonePicker } from "./runner/ScheduleFields";
import { parseDate, fromDate, toCalendarDateTime, now as calendarNow } from "@internationalized/date";
import ConfirmModal from "./confirmModal";
import { resolveCalendarSchedule } from "../../../packages/runner/src/schedule-calendar";

type ScheduleRead = Extract<Awaited<ReturnType<typeof listRunnerScheduleEvents>>, { success: true }>;
type Policy = ScheduleRead["policy"];
type RunnerScheduleView = ScheduleRead["events"][number];
type Props = { onDestinationsChange?: (change?: { deletedId: string }) => Promise<void> | void; ownerId: string; runnerId: string; sessionId?: string; overlayId: string; overlays: { id: string; name: string }[]; destinations: { id: string; name: string; provider?: string; connectionId?: string | null }[]; selectedDestinationIds: string[]; clipPlayback: boolean; onPolicyChange: (policy: Policy) => void };
type Draft = { setStreamDetails: boolean; streamDetails: StreamDetails[]; allDay: boolean; title: string; timezone: string; recurrence: "once" | "weekly"; localStartDate: string; localEndDate: string; localStartTime: string; localEndTime: string; weekdays: number[]; endDayOffset: number; overlayId: string; destinationIds: string[] };
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function elapsedDescription(event: RunnerScheduleView) {
	if (event.recurrence !== "once" || !event.localEndDate) return "Weekly in " + event.timezone;
	const start = new Date(event.localStartDate + "T00:00:00Z"),
		end = new Date(event.localEndDate + "T00:00:00Z");
	end.setUTCDate(end.getUTCDate() + 2);
	start.setUTCDate(start.getUTCDate() - 2);
	const result = resolveCalendarSchedule(event, { start: start.toISOString(), end: end.toISOString() });
	const occurrence = result.occurrences[0];
	return occurrence ? `${(Date.parse(occurrence.endUtc) - Date.parse(occurrence.startUtc)) / 3600000} hours (${event.timezone})` : (result.skipped[0]?.message ?? event.timezone);
}

export default function RunnerSchedule(props: Props) {
	const [editorView, setEditorView] = useState("schedule");
	const [destinationReturnView, setDestinationReturnView] = useState("details");
	const [destinations, setDestinations] = useState(props.destinations);
	const [detailsBusy, setDetailsBusy] = useState(false);
	const [calendarTime, setCalendarTime] = useState(Date.now);
	useEffect(() => {
		const timer = window.setInterval(() => setCalendarTime(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	const [timezoneInputValid, setTimezoneInputValid] = useState(true);
	const [calendarTimezone, setCalendarTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
	const [events, setEvents] = useState<RunnerScheduleView[]>([]),
		[automationControls, setAutomationControls] = useState<ScheduleRead["automation"]>([]),
		[policy, setPolicy] = useState<Policy | null>(null),
		[loading, setLoading] = useState(true),
		[open, setOpen] = useState(false),
		[editing, setEditing] = useState<RunnerScheduleView | null>(null),
		[saving, setSaving] = useState(false),
		[deleting, setDeleting] = useState(false),
		[deleteError, setDeleteError] = useState<string | null>(null),
		[draftNotice, setDraftNotice] = useState<string | null>(null),
		[controlFeedback, setControlFeedback] = useState<string | null>(null),
		[error, setError] = useState<string | null>(null),
		[draft, setDraft] = useState<Draft | null>(null);
	const [selectedOccurrenceStart, setSelectedOccurrenceStart] = useState<string | null>(null);
	const [scopePrompt, setScopePrompt] = useState<"save" | "delete" | null>(null);
	const [occurrenceReadOnly, setOccurrenceReadOnly] = useState(false);
	const [titleError, setTitleError] = useState<string | null>(null);
	const titleInput = useRef<HTMLInputElement>(null);
	const { ownerId, runnerId, onPolicyChange } = props;

	useDeploymentDraft(!loading ? `runner-schedule:${ownerId}:${runnerId}` : null, { draft, editing, open, editorView, selectedOccurrenceStart, occurrenceReadOnly, calendarTimezone }, { draft: null as Draft | null, editing: null as RunnerScheduleView | null, open: false, editorView: "schedule", selectedOccurrenceStart: null as string | null, occurrenceReadOnly: false, calendarTimezone }, (recovered) => {
		setDraft(recovered.draft);
		setEditing(recovered.editing);
		setOpen(recovered.open);
		setEditorView(recovered.editorView);
		setSelectedOccurrenceStart(recovered.selectedOccurrenceStart);
		setOccurrenceReadOnly(recovered.occurrenceReadOnly);
		setCalendarTimezone(recovered.calendarTimezone);
	});

	const requestGeneration = useRef(0);
	const accept = useCallback(
		(result: Awaited<ReturnType<typeof listRunnerScheduleEvents>>) => {
			if (result.success) {
				setEvents(result.events);
				setAutomationControls(result.automation ?? []);
				setPolicy(result.policy);
				onPolicyChange(result.policy);
			} else setError(result.error);
		},
		[onPolicyChange],
	);
	const reload = useCallback(async () => {
		const generation = requestGeneration.current;
		try {
			const result = await listRunnerScheduleEvents(ownerId, runnerId);
			if (generation === requestGeneration.current) accept(result);
		} catch {
			if (generation === requestGeneration.current) setError("Could not load your schedule. Please try again.");
		} finally {
			if (generation === requestGeneration.current) setLoading(false);
		}
	}, [ownerId, runnerId, accept]);
	useEffect(() => {
		const generation = ++requestGeneration.current;
		void listRunnerScheduleEvents(ownerId, runnerId)
			.then((result) => {
				if (generation === requestGeneration.current) accept(result);
			})
			.catch(() => {
				if (generation === requestGeneration.current) setError("Could not load your schedule. Please try again.");
			})
			.finally(() => {
				if (generation === requestGeneration.current) setLoading(false);
			});
		return () => {
			requestGeneration.current = generation + 1;
		};
	}, [ownerId, runnerId, accept]);

	useEffect(() => {
		if (!policy?.runnerPro || !policy.validUntil) return;
		const remaining = Date.parse(policy.validUntil) - Date.now();
		const timeout = window.setTimeout(
			() => {
				void reload();
			},
			Math.max(1, Math.min(remaining + 1, 2_147_483_647)),
		);
		return () => window.clearTimeout(timeout);
	}, [policy, reload]);
	useEffect(() => {
		const interval = window.setInterval(() => {
			if (document.visibilityState === "visible") void reload();
		}, 30_000);
		const refresh = () => {
			if (document.visibilityState === "visible") void reload();
		};
		document.addEventListener("visibilitychange", refresh);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [reload]);
	const canEdit = Boolean(policy?.scheduling && props.clipPlayback && props.sessionId);
	const [automationPending, startAutomationTransition] = useTransition();
	const automation = automationControls.find((control) => control.sessionId === props.sessionId);
	const automationPaused = Boolean(automation?.pausedAt);
	const automationMessage = automationPaused ? (automation?.actualState === "running" ? "Automation paused. This broadcast keeps its scheduled end; you can still stop it." : "Automation paused. Scheduled broadcasts will not start until you resume automation.") : null;
	function toggleAutomation() {
		if (!automation || automationPending) return;
		startAutomationTransition(async () => {
			setError(null);
			try {
				const result = await setRunnerAutomationPaused({ ownerId, runnerId, sessionId: automation.sessionId, expectedRevision: automation.configurationRevision, expectedAutomationRevision: automation.automationRevision, paused: !automationPaused });
				if (!result.success) setError(result.error);
				await reload();
			} catch {
				setError("Could not change automation. Please try again.");
			}
		});
	}

	const currentEditing = events.find((event) => event.id === editing?.id) ?? editing;
	const detailsOnly = Boolean((currentEditing?.recurrence === "once" && currentEditing?.lockedUntil) || occurrenceReadOnly || (selectedOccurrenceStart && Date.parse(selectedOccurrenceStart) <= calendarTime) || (editing && !canEdit));
	function edit(event: RunnerScheduleView | null, readOnly = false, occurrenceStart?: string) {
		setEditorView("schedule");
		setSelectedOccurrenceStart(occurrenceStart ?? null);
		setScopePrompt(null);
		setOccurrenceReadOnly(readOnly);
		setDraftNotice(null);
		setTitleError(null);
		setEditing(event);
		setError(null);
		const local = calendarNow(calendarTimezone);
		const start = local.add({ minutes: 30 - (local.minute % 30) }).set({ second: 0, millisecond: 0 });
		const end = start.add({ hours: 1 });
		if (event) setCalendarTimezone(event.timezone);
		setDraft(
			event
				? {
						setStreamDetails: event.setStreamDetails,
						streamDetails: event.streamDetails,
						allDay: isAllDayWindow(event),
						title: event.title,
						timezone: event.timezone,
						recurrence: event.recurrence,
						localStartDate: event.localStartDate,
						localEndDate: event.localEndDate && isAllDayWindow(event) ? parseDate(event.localEndDate).subtract({ days: 1 }).toString() : (event.localEndDate ?? event.localStartDate),
						localStartTime: event.localStartTime.slice(0, 5),
						localEndTime: event.localEndTime.slice(0, 5),
						weekdays: event.weekdays,
						endDayOffset: event.endDayOffset,
						overlayId: event.overlayId,
						destinationIds: event.destinationIds,
					}
				: { setStreamDetails: false, streamDetails: [], allDay: false, title: "", timezone: calendarTimezone, recurrence: "once", localStartDate: start.toString().slice(0, 10), localEndDate: end.toString().slice(0, 10), localStartTime: start.toString().slice(11, 16), localEndTime: end.toString().slice(11, 16), weekdays: [1], endDayOffset: 0, overlayId: props.overlayId, destinationIds: props.selectedDestinationIds },
		);
		setTimezoneInputValid(true);
		setOpen(true);
	}
	function manageDestinations(view: "schedule" | "details") {
		setDestinationReturnView(view);
		setEditorView("destinations");
	}
	function selectDestinations(ids: string[]) {
		setDraft((current) => (current ? { ...current, destinationIds: ids, setStreamDetails: current.setStreamDetails && ids.some((id) => destinations.some((target) => target.id === id && target.connectionId && target.provider !== "custom")) } : current));
	}
	async function refreshDestinations(change?: { deletedId: string }) {
		try {
			const result = await listRunnerDestinations(ownerId, runnerId);
			if (result.success) setDestinations(result.destinations);
			else setError(result.error);
			if (change?.deletedId) setDraft((current) => (current ? { ...current, destinationIds: current.destinationIds.filter((id) => id !== change.deletedId), streamDetails: current.streamDetails.filter((detail) => detail.destinationId !== change.deletedId) } : current));
			await props.onDestinationsChange?.(change);
		} catch {
			setError("Could not reload destinations. Please try again.");
		}
	}
	function update<K extends keyof Draft>(key: K, value: Draft[K]) {
		setDraft((current) => (current ? { ...current, [key]: value } : current));
	}
	async function save(scope?: "this" | "following") {
		if (!draft || saving || !props.sessionId || !canEdit || !timezoneInputValid) return;
		const invalidTitle = !draft.title.trim() ? "Enter an event title." : draft.title.trim().length > 80 ? "Use 80 characters or fewer." : null;
		setTitleError(invalidTitle);
		if (invalidTitle) {
			setError(null);
			titleInput.current?.focus();
			return;
		}
		if (editing?.recurrence === "weekly" && !detailsOnly && !scope) {
			setScopePrompt("save");
			return;
		}
		setScopePrompt(null);
		setSaving(true);
		setError(null);
		try {
			const { allDay, ...fields } = draft;
			fields.streamDetails = fields.streamDetails.filter((detail) => fields.destinationIds.includes(detail.destinationId));
			const input = { ownerId, runnerId, sessionId: props.sessionId, ...fields, ...(allDay ? { localStartTime: "00:00", localEndTime: "00:00", endDayOffset: draft.recurrence === "weekly" ? Math.max(1, draft.endDayOffset) : 0 } : {}), localEndDate: draft.recurrence === "once" ? (allDay ? parseDate(draft.localEndDate).add({ days: 1 }).toString() : draft.localEndDate) : null, enabled: true, ...(editing ? { id: editing.id, expectedRevision: editing.configurationRevision } : {}) };
			const result =
				detailsOnly && currentEditing
					? await renameRunnerScheduleEvent({ ownerId, runnerId, id: currentEditing.id, expectedRevision: editing!.configurationRevision, expectedTitle: editing!.title, title: draft.title })
					: await saveRunnerScheduleEvent({ ...input, ...(scope ? { scope, occurrenceStart: selectedOccurrenceStart, ...(scope === "this" ? { recurrence: "once", weekdays: [], endDayOffset: 0, localEndDate: allDay ? parseDate(draft.localEndDate).add({ days: 1 }).toString() : draft.localEndDate } : {}) } : {}) });
			if (!result.success) {
				setError(result.error);
				if (result.code === "CONFLICT" || result.code === "ACTIVE_OCCURRENCE_LOCKED" || result.code === "SCHEDULE_COMPLETED") await reload();
				return;
			}
			if (scope) await reload();
			else setEvents((current) => [...current.filter((row) => row.id !== result.event.id), result.event]);
			setOpen(false);
		} catch {
			setError("Could not save your schedule. Please try again.");
		} finally {
			setSaving(false);
		}
	}
	async function resume(event: RunnerScheduleView) {
		const occurrence = event.currentOccurrence;
		if (!occurrence || !occurrence.canResume || saving || !canEdit) return;
		setSaving(true);
		setError(null);
		setControlFeedback(null);
		try {
			const result = await resumeRunnerScheduleOccurrence({ ownerId, sessionId: event.sessionId, occurrenceId: occurrence.occurrenceId, expectedRevision: occurrence.sessionRevision });
			if (!result.success) setError(result.error);
			else setControlFeedback("Resume requested. This occurrence keeps its original end time.");
			await reload();
		} catch {
			setError("Could not resume this occurrence. Please try again.");
		} finally {
			setSaving(false);
		}
	}
	async function remove(scope?: "this" | "following") {
		if (!editing || saving || !canEdit || detailsOnly) return;
		if (editing.recurrence === "weekly" && !scope) {
			setDeleting(false);
			setScopePrompt("delete");
			return;
		}
		setScopePrompt(null);
		setSaving(true);
		setDeleteError(null);
		try {
			const result = await deleteRunnerScheduleEvent({ ownerId, runnerId, id: editing.id, expectedRevision: editing.configurationRevision, ...(scope ? { scope, occurrenceStart: selectedOccurrenceStart } : {}) });
			if (!result.success) {
				setDeleteError(result.error);
				if (scope) setError(result.error);
				if (result.code === "CONFLICT" || result.code === "ACTIVE_OCCURRENCE_LOCKED" || result.code === "SCHEDULE_COMPLETED") {
					setDeleting(false);
					setOpen(false);
					setError(result.error);
					await reload();
				}
				return;
			}
			await reload();
			setDeleting(false);
			setOpen(false);
		} catch {
			setDeleteError("Could not delete your schedule. Please try again.");
			if (scope) setError("Could not delete your schedule. Please try again.");
		} finally {
			setSaving(false);
		}
	}
	return (
		<>
			<section className='space-y-5'>
				<div className='space-y-4'>
					{automationMessage && (
						<p role='status' className='text-sm text-muted'>
							{automationMessage}
						</p>
					)}
					{loading ? <Spinner size='sm' aria-label='Loading schedule' /> : !policy?.scheduling ? <p className='text-sm text-muted'>Upgrade to Pro to schedule broadcasts.</p> : !props.clipPlayback ? <p className='text-sm text-muted'>Scheduling is available for Clip playback.</p> : !props.sessionId ? <p className='text-sm text-muted'>Save your broadcast configuration before adding a schedule.</p> : null}
					{error && !open && (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					)}
					{!loading && (
						<>
							<RunnerScheduleAgenda
								timezoneControl={<TimezonePicker label='Calendar timezone' value={calendarTimezone} onChange={setCalendarTimezone} />}
								toolbar={
									<>
										{props.clipPlayback && automation?.controlMode === "scheduled" && (
											<Button aria-label={automationPaused ? "Resume automation" : "Pause automation"} variant='secondary' onPress={toggleAutomation} isDisabled={loading || automationPending || (automationPaused && !policy?.scheduling)}>
												{automationPaused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
												<span className='sm:hidden'>{automationPaused ? "Resume" : "Pause"}</span>
												<span className='hidden sm:inline'>{automationPaused ? "Resume automation" : "Pause automation"}</span>
											</Button>
										)}
										<Button variant='primary' onPress={() => edit(null)} isDisabled={!canEdit || loading}>
											<IconPlus size={16} />
											Add schedule
										</Button>
									</>
								}
								timezone={calendarTimezone}
								now={calendarTime}
								events={events}
								canEdit={canEdit}
								onCreate={(window) => {
									edit(null);
									setDraft((current) => (current ? { ...current, ...window } : current));
								}}
								onEdit={(id, window, notice, readOnly, occurrenceStart) => {
									const event = events.find((event) => event.id === id);
									if (event) {
										edit(event, readOnly, occurrenceStart);
										setDraftNotice(notice ?? null);
										if (window) setDraft((current) => (current ? { ...current, ...window, ...(current.allDay ? { localEndDate: parseDate(window.localEndDate).subtract({ days: 1 }).toString() } : {}) } : current));
									}
								}}
							/>
						</>
					)}
					{controlFeedback && (
						<p role='status' className='text-sm text-muted'>
							{controlFeedback}
						</p>
					)}
					{events.length ? (
						<ul aria-label='Saved schedules' className='space-y-3'>
							{events.map((event) => (
								<li key={event.id} className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-separator p-4'>
									<div>
										<p className='font-medium'>{event.title}</p>
										<p className='text-sm text-muted'>
											{isAllDayWindow(event) ? (
												<>
													<LocalizedDate value={event.localStartDate} />
													{event.localEndDate && (
														<>
															{" "}
															to <LocalizedDate value={parseDate(event.localEndDate).subtract({ days: 1 }).toString()} />
														</>
													)}{" "}
													(All day)
												</>
											) : (
												<>
													<LocalizedDate value={event.localStartDate} /> {event.localStartTime.slice(0, 5)} to {event.localEndDate ? <LocalizedDate value={event.localEndDate} /> : "Weekly"} {event.localEndTime.slice(0, 5)}
												</>
											)}
										</p>
										<p className='text-sm text-muted'>{elapsedDescription(event)}</p>
										{event.lockedUntil && <p className='text-xs text-muted'>{event.lockReason === "completed" ? "Completed broadcast" : "Broadcast settings are locked for this occurrence."}</p>}
										{event.streamDetailsFeedback
											?.filter((result) => result.status !== "applied")
											.map((result) => (
												<p key={result.destinationId} role='status' className='mt-1 text-sm text-danger'>
													{destinations.find((target) => target.id === result.destinationId)?.name}: {result.error}
												</p>
											))}
									</div>
									{event.currentOccurrence && (
										<Button variant='secondary' size='sm' aria-label={`Resume ${event.title}`} isDisabled={!canEdit || saving || !event.currentOccurrence.canResume} onPress={() => resume(event)}>
											Resume
										</Button>
									)}
									<Button
										variant='tertiary'
										size='sm'
										aria-label={`${(event.recurrence === "once" && event.lockedUntil) || !canEdit ? "View" : "Edit"} ${event.title}`}
										onPress={() => {
											if (event.recurrence !== "weekly") {
												edit(event);
												return;
											}
											const next = resolveCalendarSchedule(event, { start: new Date().toISOString(), end: new Date(Math.max(Date.now(), Date.parse(event.localStartDate)) + Math.max(14, (event.excludedDates.length + 2) * 7) * 86400000).toISOString() }).occurrences.find((row) => Date.parse(row.startUtc) > Date.now());
											edit(event, !next, next?.startUtc);
											if (next) setDraft((current) => (current ? { ...current, ...plannerCreateWindow(toCalendarDateTime(fromDate(new Date(next.startUtc), event.timezone)), toCalendarDateTime(fromDate(new Date(next.endUtc), event.timezone)), event.timezone), ...(current.allDay ? { localEndDate: parseDate(next.endUtc.slice(0, 10)).subtract({ days: 1 }).toString() } : {}) } : current));
										}}
									>
										{(event.recurrence === "once" && event.lockedUntil) || !canEdit ? <IconEye size={16} /> : <IconPencil size={16} />}
										{(event.recurrence === "once" && event.lockedUntil) || !canEdit ? "View details" : "Edit"}
									</Button>
								</li>
							))}
						</ul>
					) : (
						!loading && <p className='text-sm text-muted'>No scheduled broadcasts yet.</p>
					)}
				</div>
			</section>
			<Modal.Backdrop
				isOpen={open}
				onOpenChange={(next) => {
					if (!saving && !detailsBusy) setOpen(next);
				}}
			>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger isDisabled={saving || detailsBusy} />
						<Modal.Header>
							<Modal.Heading>{editorView === "destinations" ? "Manage destinations" : detailsOnly ? "Broadcast details" : "Schedule broadcast"}</Modal.Heading>
							{(detailsOnly || editorView === "schedule") && <p className='text-sm text-muted'>{detailsOnly ? (canEdit ? "Broadcast settings are read-only. You can still rename this event." : "Broadcast settings are read-only.") : "All dates and times use the selected timezone."}</p>}
							{draftNotice && (
								<p role='status' className='text-sm text-muted'>
									{draftNotice}
								</p>
							)}
						</Modal.Header>
						<Modal.Body className='space-y-5'>
							{editorView === "destinations" ? (
								<RunnerDestinations ownerId={ownerId} runnerId={runnerId} onChange={refreshDestinations} />
							) : (
								<Tabs
									selectedKey={editorView}
									onSelectionChange={(value) => {
										if (!detailsBusy) setEditorView(String(value));
									}}
								>
									<Tabs.ListContainer className='w-full'>
										<Tabs.List aria-label='Schedule editor mode' className='w-full'>
											<Tabs.Tab isDisabled={detailsBusy} id='schedule' className='flex-1'>
												Schedule
												<Tabs.Indicator />
											</Tabs.Tab>
											<Tabs.Tab isDisabled={detailsBusy} id='details' className='flex-1 gap-2'>
												Broadcast details
												<IconCrown size={16} className='text-warning' aria-label='Pro feature' />
												<Tabs.Indicator />
											</Tabs.Tab>
										</Tabs.List>
									</Tabs.ListContainer>
									<Tabs.Panel id={editorView} className='space-y-5 pt-5 text-foreground'>
										{editorView === "details" ? (
											draft && <BroadcastDetails ownerId={ownerId} runnerId={runnerId} eventTitle={draft.title} targets={destinations.filter((target) => draft.destinationIds.includes(target.id))} enabled={draft.setStreamDetails} details={draft.streamDetails} disabled={detailsOnly || !canEdit || saving} onEnabledChange={(value) => update("setStreamDetails", value)} onChange={(value) => update("streamDetails", value)} onBusyChange={setDetailsBusy} onManage={() => manageDestinations("details")} />
										) : (
											<>
												{draft && (
													<>
														{detailsOnly ? (
															<>
																<TextField
																	value={draft.title}
																	isReadOnly={!canEdit}
																	isInvalid={Boolean(titleError)}
																	onChange={(value) => {
																		update("title", value);
																		setTitleError(null);
																	}}
																>
																	<Label>Event title</Label>
																	<Input ref={titleInput} aria-label='Event title' variant='secondary' />
																	{titleError && <FieldError>{titleError}</FieldError>}
																</TextField>
																<dl className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
																	<div>
																		<dt className='text-sm text-muted'>Start</dt>
																		<dd>
																			<LocalizedDate value={draft.localStartDate} /> {draft.allDay ? "All day" : draft.localStartTime}
																		</dd>
																	</div>
																	<div>
																		<dt className='text-sm text-muted'>End</dt>
																		<dd>
																			<LocalizedDate value={draft.localEndDate} /> {draft.allDay ? "All day" : draft.localEndTime}
																		</dd>
																	</div>
																	<div>
																		<dt className='text-sm text-muted'>Timezone</dt>
																		<dd>{draft.timezone}</dd>
																	</div>
																	<div>
																		<dt className='text-sm text-muted'>Recurrence</dt>
																		<dd>{draft.recurrence === "weekly" ? "Weekly" : "One time"}</dd>
																	</div>
																	<div>
																		<dt className='text-sm text-muted'>Schedule source</dt>
																		<dd>{props.overlays.find((source) => source.id === draft.overlayId)?.name ?? "Source unavailable"}</dd>
																	</div>
																	<div>
																		<dt className='text-sm text-muted'>Destinations</dt>
																		<dd>{draft.destinationIds.map((id) => destinations.find((destination) => destination.id === id)?.name ?? "Destination unavailable").join(", ")}</dd>
																	</div>
																</dl>
															</>
														) : (
															<>
																<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
																	<TextField
																		value={draft.title}
																		isRequired
																		isInvalid={Boolean(titleError)}
																		onChange={(value) => {
																			update("title", value);
																			setTitleError(null);
																		}}
																	>
																		<Label>Event title</Label>
																		<Input ref={titleInput} aria-label='Event title' variant='secondary' />
																		{titleError && <FieldError>{titleError}</FieldError>}
																	</TextField>
																	<TimezonePicker
																		value={draft.timezone}
																		onValidityChange={setTimezoneInputValid}
																		onChange={(value) => {
																			update("timezone", value);
																			setCalendarTimezone(value);
																		}}
																	/>
																	<Checkbox className='sm:col-span-2' isSelected={draft.allDay} onChange={(allDay) => setDraft((current) => (current ? { ...current, allDay, ...(allDay ? { endDayOffset: Math.max(1, current.endDayOffset) } : current.localStartTime === "00:00" && current.localEndTime === "00:00" ? { localStartTime: "09:00", localEndTime: "10:00" } : {}) } : current))}>
																		<Checkbox.Control>
																			<Checkbox.Indicator />
																		</Checkbox.Control>
																		<Checkbox.Content>All day</Checkbox.Content>
																	</Checkbox>
																	<ScheduleDateField label='Start date' value={draft.localStartDate} onChange={(value) => update("localStartDate", value)} />
																	{draft.recurrence === "once" && <ScheduleDateField label='End date' value={draft.localEndDate} onChange={(value) => update("localEndDate", value)} />}
																	{!draft.allDay && <ScheduleTimeField label='Start time' value={draft.localStartTime} onChange={(value) => update("localStartTime", value)} />}
																	{!draft.allDay && <ScheduleTimeField label='End time' value={draft.localEndTime} onChange={(value) => update("localEndTime", value)} />}
																</div>
																<Select value={draft.recurrence} onChange={(value) => update("recurrence", value === "weekly" ? "weekly" : "once")} variant='secondary'>
																	<Label>Recurrence</Label>
																	<Select.Trigger>
																		<Select.Value />
																		<Select.Indicator />
																	</Select.Trigger>
																	<Select.Popover>
																		<ListBox>
																			<ListBox.Item id='once' textValue='One time'>
																				One time
																			</ListBox.Item>
																			<ListBox.Item id='weekly' textValue='Weekly'>
																				Weekly
																			</ListBox.Item>
																		</ListBox>
																	</Select.Popover>
																</Select>
																{draft.recurrence === "weekly" && (
																	<>
																		<div role='group' aria-label='Start weekdays' className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
																			{weekdays.map((day, index) => (
																				<Checkbox key={day} isSelected={draft.weekdays.includes(index + 1)} onChange={(selected) => update("weekdays", selected ? [...draft.weekdays, index + 1] : draft.weekdays.filter((value) => value !== index + 1))}>
																					<Checkbox.Control>
																						<Checkbox.Indicator />
																					</Checkbox.Control>
																					<Checkbox.Content>{day}</Checkbox.Content>
																				</Checkbox>
																			))}
																		</div>
																		<Select value={String(draft.endDayOffset)} onChange={(value) => update("endDayOffset", Number(value))} variant='secondary'>
																			<Label>{draft.allDay ? "Duration" : "End day"}</Label>
																			<Select.Trigger>
																				<Select.Value />
																				<Select.Indicator />
																			</Select.Trigger>
																			<Select.Popover>
																				<ListBox>
																					{Array.from({ length: 8 }, (_, days) => (
																						<ListBox.Item isDisabled={draft.allDay && days === 0} id={String(days)} key={days} textValue={draft.allDay ? `${days} ${days === 1 ? "day" : "days"}` : days === 0 ? "Same day" : days === 1 ? "Next day" : `${days} days later`}>
																							<Label>{draft.allDay ? `${days} ${days === 1 ? "day" : "days"}` : days === 0 ? "Same day" : days === 1 ? "Next day" : `${days} days later`}</Label>
																							<ListBox.ItemIndicator />
																						</ListBox.Item>
																					))}
																				</ListBox>
																			</Select.Popover>
																		</Select>
																	</>
																)}
																<Select value={draft.overlayId || "none"} onChange={(value) => update("overlayId", value === "none" ? "" : String(value ?? ""))} variant='secondary'>
																	<Label>Schedule source</Label>
																	<Select.Trigger>
																		<Select.Value />
																		<Select.Indicator />
																	</Select.Trigger>
																	<Select.Popover>
																		<ListBox>
																			<ListBox.Item id='none' textValue='Choose a source'>
																				Choose a source
																			</ListBox.Item>
																			{props.overlays.map((source) => (
																				<ListBox.Item key={source.id} id={source.id} textValue={source.name}>
																					{source.name}
																				</ListBox.Item>
																			))}
																		</ListBox>
																	</Select.Popover>
																</Select>
																<RunnerDestinationSelection label='Schedule destinations' destinations={destinations} selectedIds={draft.destinationIds} runnerPro onChange={selectDestinations} onManage={() => manageDestinations("schedule")} />
															</>
														)}
														{error && (
															<p role='alert' className='text-sm text-danger'>
																{error}
															</p>
														)}
													</>
												)}
											</>
										)}
									</Tabs.Panel>
								</Tabs>
							)}
						</Modal.Body>
						<Modal.Footer>
							{editorView === "destinations" ? (
								<Button variant='secondary' onPress={() => setEditorView(destinationReturnView)}>
									Back to event
								</Button>
							) : (
								<>
									{editing && !detailsOnly && (
										<Button
											variant='danger'
											isDisabled={!canEdit || saving}
											onPress={() => {
												setDeleteError(null);
												if (editing.recurrence === "weekly") setScopePrompt("delete");
												else setDeleting(true);
											}}
										>
											Delete schedule
										</Button>
									)}

									<Button variant='tertiary' isDisabled={saving || detailsBusy} onPress={() => setOpen(false)}>
										{detailsOnly ? "Close" : "Cancel"}
									</Button>
									<Button variant='primary' onPress={() => save()} isPending={saving} isDisabled={detailsBusy || !canEdit || (!detailsOnly && !timezoneInputValid) || (detailsOnly && draft?.title === currentEditing?.title)}>
										{detailsOnly ? "Save title" : "Save schedule"}
									</Button>
								</>
							)}
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			<Modal.Backdrop
				isOpen={Boolean(scopePrompt)}
				onOpenChange={(value) => {
					if (!value) setScopePrompt(null);
				}}
			>
				<Modal.Container size='sm'>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>{scopePrompt === "delete" ? "Delete recurring broadcast" : "Edit recurring broadcast"}</Modal.Heading>
						</Modal.Header>
						<Modal.Body>
							<p>Apply this change to this occurrence or this and following? Past and current broadcasts stay unchanged.</p>
						</Modal.Body>
						<Modal.Footer className='flex-col items-stretch'>
							<Button className='w-full' variant={scopePrompt === "delete" ? "danger-soft" : "secondary"} onPress={() => (scopePrompt === "delete" ? remove("this") : save("this"))}>
								This occurrence
							</Button>
							<Button className='w-full' variant={scopePrompt === "delete" ? "danger" : "primary"} onPress={() => (scopePrompt === "delete" ? remove("following") : save("following"))}>
								This and following
							</Button>
							<Button className='w-full' variant='tertiary' onPress={() => setScopePrompt(null)}>
								Cancel
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			<ConfirmModal
				isOpen={deleting}
				isPending={saving}
				onOpenChange={setDeleting}
				title='Delete schedule?'
				confirmLabel='Delete schedule'
				onConfirm={() => remove()}
				description={
					<div className='space-y-3'>
						<p>Remove “{editing?.title}” and its future scheduled broadcasts? Your source and destinations will be kept.</p>
						{deleteError && (
							<p role='alert' className='text-sm text-danger'>
								{deleteError}
							</p>
						)}
					</div>
				}
			/>
		</>
	);
}
