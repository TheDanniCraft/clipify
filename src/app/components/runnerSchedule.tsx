"use client";

import { useCallback, useEffect, useState, useRef, useTransition } from "react";
import { Button, Card, Checkbox, Input, Label, ListBox, Modal, Select, Spinner, TextField } from "@heroui/react";
import { IconCalendarEvent, IconPlus, IconPencil } from "@tabler/icons-react";
import { listRunnerScheduleEvents, saveRunnerScheduleEvent, deleteRunnerScheduleEvent, resumeRunnerScheduleOccurrence, setRunnerAutomationPaused } from "@/app/actions/runner";
import RunnerScheduleAgenda from "./runnerScheduleAgenda";
import ConfirmModal from "./confirmModal";
import { resolveCalendarSchedule } from "../../../packages/runner/src/schedule-calendar";

type ScheduleRead = Extract<Awaited<ReturnType<typeof listRunnerScheduleEvents>>, { success: true }>;
type Policy = ScheduleRead["policy"];
type RunnerScheduleView = ScheduleRead["events"][number];
type Props = { ownerId: string; runnerId: string; sessionId?: string; overlayId: string; overlays: { id: string; name: string }[]; destinations: { id: string; name: string }[]; selectedDestinationIds: string[]; clipPlayback: boolean; onPolicyChange: (policy: Policy) => void };
type Draft = { title: string; timezone: string; recurrence: "once" | "weekly"; localStartDate: string; localEndDate: string; localStartTime: string; localEndTime: string; weekdays: number[]; endDayOffset: number; overlayId: string; destinationIds: string[] };
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const fields = [
	{ name: "title", label: "Event title", type: "text" },
	{ name: "timezone", label: "Timezone", type: "text" },
	{ name: "localStartDate", label: "Start date", type: "date" },
	{ name: "localEndDate", label: "End date", type: "date" },
	{ name: "localStartTime", label: "Start time", type: "time" },
	{ name: "localEndTime", label: "End time", type: "time" },
] as const;
function elapsedDescription(event: RunnerScheduleView) {
	if (event.recurrence !== "once" || !event.localEndDate) return "Weekly · " + event.timezone;
	const start = new Date(event.localStartDate + "T00:00:00Z"),
		end = new Date(event.localEndDate + "T00:00:00Z");
	end.setUTCDate(end.getUTCDate() + 2);
	start.setUTCDate(start.getUTCDate() - 2);
	const result = resolveCalendarSchedule(event, { start: start.toISOString(), end: end.toISOString() });
	const occurrence = result.occurrences[0];
	return occurrence ? `${(Date.parse(occurrence.endUtc) - Date.parse(occurrence.startUtc)) / 3600000} hours · ${event.timezone}` : (result.skipped[0]?.message ?? event.timezone);
}

export default function RunnerSchedule(props: Props) {
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
	const { ownerId, runnerId, onPolicyChange } = props;

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

	function edit(event: RunnerScheduleView | null) {
		setDraftNotice(null);
		setEditing(event);
		setError(null);
		const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
		setDraft(
			event
				? { title: event.title, timezone: event.timezone, recurrence: event.recurrence, localStartDate: event.localStartDate, localEndDate: event.localEndDate ?? event.localStartDate, localStartTime: event.localStartTime.slice(0, 5), localEndTime: event.localEndTime.slice(0, 5), weekdays: event.weekdays, endDayOffset: event.endDayOffset, overlayId: event.overlayId, destinationIds: event.destinationIds }
				: { title: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, recurrence: "once", localStartDate: today, localEndDate: today, localStartTime: "12:00", localEndTime: "13:00", weekdays: [1], endDayOffset: 0, overlayId: props.overlayId, destinationIds: props.selectedDestinationIds },
		);
		setOpen(true);
	}
	function update<K extends keyof Draft>(key: K, value: Draft[K]) {
		setDraft((current) => (current ? { ...current, [key]: value } : current));
	}
	async function save() {
		if (!draft || saving || !props.sessionId || !canEdit) return;
		setSaving(true);
		setError(null);
		try {
			const input = { ownerId, runnerId, sessionId: props.sessionId, ...draft, localEndDate: draft.recurrence === "once" ? draft.localEndDate : null, enabled: true, ...(editing ? { id: editing.id, expectedRevision: editing.configurationRevision } : {}) };
			const result = await saveRunnerScheduleEvent(input);
			if (!result.success) {
				setError(result.error);
				if (result.code === "CONFLICT" || result.code === "ACTIVE_OCCURRENCE_LOCKED") await reload();
				return;
			}
			setEvents((current) => [...current.filter((row) => row.id !== result.event.id), result.event]);
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
	async function remove() {
		if (!editing || saving || !canEdit || editing.lockedUntil) return;
		setSaving(true);
		setDeleteError(null);
		try {
			const result = await deleteRunnerScheduleEvent({ ownerId, runnerId, id: editing.id, expectedRevision: editing.configurationRevision });
			if (!result.success) {
				setDeleteError(result.error);
				if (result.code === "CONFLICT" || result.code === "ACTIVE_OCCURRENCE_LOCKED") {
					setDeleting(false);
					setOpen(false);
					setError(result.error);
					await reload();
				}
				return;
			}
			setEvents((current) => current.filter((event) => event.id !== editing.id));
			setDeleting(false);
			setOpen(false);
		} catch {
			setDeleteError("Could not delete your schedule. Please try again.");
		} finally {
			setSaving(false);
		}
	}
	return (
		<>
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-3'>
					<div>
						<h2 className='flex items-center gap-2 text-lg font-semibold'>
							<IconCalendarEvent size={20} />
							Broadcast schedule
						</h2>
						<p className='mt-1 text-sm text-muted'>Plan one-time or weekly broadcasts. Your Runner computer must stay on.</p>
					</div>
					{props.clipPlayback && automation?.controlMode === "scheduled" && (
						<Button variant='secondary' onPress={toggleAutomation} isDisabled={loading || automationPending || (automationPaused && !policy?.scheduling)}>
							{automationPaused ? "Resume automation" : "Pause automation"}
						</Button>
					)}
					<Button variant='secondary' onPress={() => edit(null)} isDisabled={!canEdit || loading}>
						<IconPlus size={16} />
						Add schedule
					</Button>
				</Card.Header>
				<Card.Content className='space-y-4'>
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
						<RunnerScheduleAgenda
							events={events}
							canEdit={canEdit}
							onCreate={(window) => {
								edit(null);
								setDraft((current) => (current ? { ...current, ...window } : current));
							}}
							onEdit={(id, window, notice) => {
								const event = events.find((event) => event.id === id);
								if (event) {
									edit(event);
									setDraftNotice(notice ?? null);
									if (window) setDraft((current) => (current ? { ...current, ...window } : current));
								}
							}}
						/>
					)}
					{controlFeedback && (
						<p role='status' className='text-sm text-muted'>
							{controlFeedback}
						</p>
					)}
					{events.length ? (
						<ul aria-label='Saved schedules' className='space-y-3'>
							{events.map((event) => (
								<li key={event.id} className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider p-4'>
									<div>
										<p className='font-medium'>{event.title}</p>
										<p className='text-sm text-muted'>
											{event.localStartDate} {event.localStartTime.slice(0, 5)} — {event.localEndDate ?? "Weekly"} {event.localEndTime.slice(0, 5)}
										</p>
										<p className='text-sm text-muted'>{elapsedDescription(event)}</p>
										{event.lockedUntil && <p className='text-xs text-muted'>{event.lockReason === "output_drain" ? "You can edit this schedule after the broadcast finishes." : "You can edit this schedule after its current time slot ends."}</p>}
									</div>
									{event.currentOccurrence && (
										<Button variant='secondary' size='sm' aria-label={`Resume ${event.title}`} isDisabled={!canEdit || saving || !event.currentOccurrence.canResume} onPress={() => resume(event)}>
											Resume
										</Button>
									)}
									<Button variant='tertiary' size='sm' aria-label={`Edit ${event.title}`} onPress={() => edit(event)} isDisabled={!canEdit || Boolean(event.lockedUntil)}>
										<IconPencil size={16} />
										Edit
									</Button>
								</li>
							))}
						</ul>
					) : (
						!loading && <p className='text-sm text-muted'>No scheduled broadcasts yet.</p>
					)}
				</Card.Content>
			</Card>
			<Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>Schedule broadcast</Modal.Heading>
							<p className='text-sm text-muted'>All dates and times use the selected timezone.</p>
							{draftNotice && (
								<p role='status' className='text-sm text-muted'>
									{draftNotice}
								</p>
							)}
						</Modal.Header>
						<Modal.Body className='space-y-5'>
							{draft && (
								<>
									<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
										{fields
											.filter((field) => draft.recurrence === "once" || field.name !== "localEndDate")
											.map((field) => (
												<TextField key={field.name} value={draft[field.name]} onChange={(value) => update(field.name, value)}>
													<Label>{field.label}</Label>
													<Input type={field.type} />
												</TextField>
											))}
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
											<TextField value={String(draft.endDayOffset)} onChange={(value) => update("endDayOffset", Number(value))}>
												<Label>End day offset</Label>
												<Input type='number' min={0} max={7} />
												<p className='text-xs text-muted'>0 ends on the start day; 1 ends the next day; 7 ends the following week.</p>
											</TextField>
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
									<div role='group' aria-label='Schedule destinations' className='space-y-3'>
										<p className='text-sm font-medium'>Destinations</p>
										{props.destinations.map((target) => (
											<Checkbox key={target.id} isSelected={draft.destinationIds.includes(target.id)} onChange={(selected) => update("destinationIds", selected ? [...draft.destinationIds, target.id] : draft.destinationIds.filter((id) => id !== target.id))}>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
												<Checkbox.Content>{target.name}</Checkbox.Content>
											</Checkbox>
										))}
									</div>
									{error && (
										<p role='alert' className='text-sm text-danger'>
											{error}
										</p>
									)}
								</>
							)}
						</Modal.Body>
						<Modal.Footer>
							{editing && (
								<Button
									variant='danger'
									isDisabled={!canEdit || saving || Boolean(editing.lockedUntil)}
									onPress={() => {
										setDeleteError(null);
										setDeleting(true);
									}}
								>
									Delete schedule
								</Button>
							)}

							<Button variant='tertiary' onPress={() => setOpen(false)}>
								Cancel
							</Button>
							<Button variant='primary' onPress={save} isPending={saving} isDisabled={!canEdit}>
								Save schedule
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
				onConfirm={remove}
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
