"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Agenda, useAgenda } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { useLocale } from "react-aria-components/I18nProvider";
import { parseDate, today, startOfWeek } from "@internationalized/date";
import styles from "./runnerScheduleAgenda.module.css";
import { projectScheduleViewport, plannerCreateWindow, plannerMoveWindow, plannerResizeWindow, type PlannerEvent } from "./runnerSchedulePlanner";

const mobileQuery = "(max-width: 639px)";
function subscribeViewport(listener: () => void) {
	const query = window.matchMedia(mobileQuery);
	query.addEventListener("change", listener);
	return () => query.removeEventListener("change", listener);
}
export default function RunnerScheduleAgenda({ events, canEdit, onEdit, onCreate }: { events: PlannerEvent[]; canEdit: boolean; onEdit: (id: string, window?: ReturnType<typeof plannerCreateWindow>, notice?: string) => void; onCreate: (window: ReturnType<typeof plannerCreateWindow>) => void }) {
	const { locale } = useLocale();
	const mobile = useSyncExternalStore(
		subscribeViewport,
		() => window.matchMedia(mobileQuery).matches,
		() => false,
	);
	const [date, setDate] = useState(() => today("UTC"));
	const [timezone, setTimezone] = useState("UTC");
	const segments = useMemo(() => projectScheduleViewport(events, mobile ? date : startOfWeek(date, locale), mobile ? 1 : 7, timezone), [events, date, mobile, timezone, locale]);
	const agenda = useAgenda({
		events: segments.map((segment) => ({ ...segment, isReadOnly: !canEdit || Boolean(events.find((event) => event.id === segment.eventId)?.lockedUntil) })),
		view: mobile ? "day" : "week",
		date,
		onDateChange: setDate,
		selectedEventId: null,
		onEventSelect: (id) => {
			if (!id || !canEdit) return;
			const segment = segments.find((segment) => segment.id === id);
			const event = segment && events.find((event) => event.id === segment.eventId);
			if (event && !event.lockedUntil) onEdit(event.id);
		},
		startHour: 0,
		endHour: 24,
		slotDuration: 30,
		onEventCreate: canEdit ? ({ start, end }) => onCreate(plannerCreateWindow(start, end, timezone)) : undefined,
		onEventResize: canEdit
			? (id, _start, end) => {
					const segment = segments.find((segment) => segment.id === id);
					const event = segment && events.find((event) => event.id === segment.eventId);
					if (!segment || !event || event.lockedUntil) return;
					const window = event.recurrence === "once" && event.timezone === timezone ? (plannerResizeWindow(segment, end, timezone) ?? undefined) : undefined;
					onEdit(event.id, window, window ? undefined : "This event repeats or uses a different timezone. Edit its full dates and times below.");
				}
			: undefined,
		onEventMove: canEdit
			? (id, start) => {
					const segment = segments.find((segment) => segment.id === id);
					const event = segment && events.find((event) => event.id === segment.eventId);
					if (!segment || !event || event.lockedUntil) return;
					// A weekly-series or cross-zone gesture needs explicit full configuration choices.
					const window = event.recurrence === "once" && event.timezone === timezone ? plannerMoveWindow(segment, start, timezone) : undefined;
					onEdit(event.id, window, window ? undefined : "This event repeats or uses a different timezone. Edit its full dates and times below.");
				}
			: undefined,
	});
	return (
		<section role='region' aria-label='Broadcast calendar' className='min-w-0 overflow-hidden rounded-xl border border-divider'>
			<div className='flex flex-wrap items-end gap-3 border-b border-divider p-3'>
				<div className='mr-auto'>
					<h3 className='font-semibold'>Broadcast calendar</h3>
					<p className='text-xs text-muted'>
						{mobile ? "Day" : "Week"} view · Dates use {timezone}
					</p>
				</div>
				<label className='min-w-0 text-xs text-muted'>
					Displayed date
					<input
						aria-label='Displayed date'
						type='date'
						value={date.toString()}
						onChange={(event) => {
							if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setDate(parseDate(event.target.value));
						}}
						className='mt-1 block max-w-full rounded-lg border border-divider bg-surface px-2 py-1.5 text-sm text-foreground'
					/>
				</label>
				<label className='min-w-0 text-xs text-muted'>
					Calendar timezone
					<select aria-label='Calendar timezone' value={timezone} onChange={(event) => setTimezone(event.target.value)} className='mt-1 block max-w-44 rounded-lg border border-divider bg-surface px-2 py-1.5 text-sm text-foreground'>
						{[...new Set(["UTC", ...events.map((event) => event.timezone)])].map((zone) => (
							<option key={zone}>{zone}</option>
						))}
					</select>
				</label>
				<div className='flex gap-1'>
					<Button size='sm' variant='tertiary' aria-label={mobile ? "Previous day" : "Previous week"} onPress={agenda.goToPrevious}>
						Previous
					</Button>
					<Button size='sm' variant='tertiary' onPress={agenda.goToToday}>
						Today
					</Button>
					<Button size='sm' variant='tertiary' aria-label={mobile ? "Next day" : "Next week"} onPress={agenda.goToNext}>
						Next
					</Button>
				</div>
			</div>
			<Agenda {...agenda} timeZone={timezone} className='w-full min-w-0'>
				<Agenda.Body>
					<Agenda.WeekHeader>
						{agenda.visibleDays.map((day) => (
							<Agenda.DayHeader key={day.toString()} date={day} />
						))}
					</Agenda.WeekHeader>
					<div className='max-h-[32rem] overflow-auto'>
						<Agenda.TimeGrid>
							{agenda.visibleDays.map((day) => (
								<Agenda.DayColumn key={day.toString()} date={day}>
									{agenda.getEventsForDay(day).map((event) => (
										<Agenda.Event key={event.id} event={event} className={segments.find((segment) => segment.id === event.id)?.canResizeEnd && event.end.millisecond === 0 ? undefined : styles.continues}>
											<button
												type='button'
												disabled={event.isReadOnly}

												className='flex h-full w-full flex-col items-start gap-1 overflow-hidden p-1 text-left'
											>
												<Agenda.EventTitle>{event.title}</Agenda.EventTitle>
												<span className='text-xs'>Open event details</span>
											</button>
										</Agenda.Event>
									))}
								</Agenda.DayColumn>
							))}
						</Agenda.TimeGrid>
					</div>
				</Agenda.Body>
			</Agenda>
		</section>
	);
}
