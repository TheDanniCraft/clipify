"use client";

import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { IconLock } from "@tabler/icons-react";
import { Button, Chip } from "@heroui/react";
import { Agenda, useAgenda, type AgendaView } from "@heroui-pro/react";
import { ScheduleDateField } from "./runner/ScheduleFields";
import { useLocale } from "react-aria-components/I18nProvider";
import { parseDate, fromDate, toCalendarDateTime, today, startOfWeek, startOfMonth, getLocalTimeZone } from "@internationalized/date";
import styles from "./runnerScheduleAgenda.module.css";
import { projectScheduleViewport, plannerCreateWindow, plannerMoveWindow, plannerResizeWindow, type PlannerEvent } from "./runnerSchedulePlanner";

const mobileQuery = "(max-width: 639px)";
function subscribeViewport(listener: () => void) {
	const query = window.matchMedia(mobileQuery);
	query.addEventListener("change", listener);
	return () => query.removeEventListener("change", listener);
}
export default function RunnerScheduleAgenda({ events, canEdit, now, onEdit, onCreate, toolbar, timezoneControl, timezone = getLocalTimeZone() }: { events: PlannerEvent[]; now: number; toolbar?: ReactNode; timezoneControl?: ReactNode; timezone?: string; canEdit: boolean; onEdit: (id: string, window?: ReturnType<typeof plannerCreateWindow>, notice?: string, readOnly?: boolean, occurrenceStart?: string) => void; onCreate: (window: ReturnType<typeof plannerCreateWindow>) => void }) {
	const { locale } = useLocale();
	const mobile = useSyncExternalStore(
		subscribeViewport,
		() => window.matchMedia(mobileQuery).matches,
		() => false,
	);
	const [date, setDate] = useState(() => today(timezone));
	const [selectedView, setView] = useState<AgendaView | null>(null);
	const view = selectedView ?? (mobile ? "day" : "week");
	const segments = useMemo(() => projectScheduleViewport(events, view === "day" ? date : startOfWeek(view === "month" ? startOfMonth(date) : date, locale), view === "day" ? 1 : view === "month" ? 42 : 7, timezone, now), [events, date, view, timezone, locale, now]);
	const eventLocked = (id: string) => {
		const segment = segments.find((segment) => segment.id === id);
		return Boolean(segment && Date.parse(segment.trueStartUtc) <= now);
	};
	const eventClass = (id: string) => (eventLocked(id) || !canEdit ? styles.locked : styles.editable);
	const lockIcon = (id: string) =>
		eventLocked(id) || !canEdit ? (
			<span className={styles.lockIcon} role='img' aria-label='Locked event' title='This event cannot be edited'>
				<IconLock size={12} aria-hidden='true' />
			</span>
		) : null;
	const eventTitle = (event: { id: string; title: string; isReadOnly?: boolean }) => (
		<Button variant='ghost' size='sm' className='h-auto min-h-0 w-full min-w-0 justify-start rounded-none p-0 text-left text-inherit' aria-label={`${event.isReadOnly ? "View" : "Edit"} ${event.title}`} onPressStart={(press) => press.continuePropagation()} onPress={() => agenda.selectEvent(event.id)} onClick={(click) => click.stopPropagation()}>
			<Agenda.EventTitle>{event.title}</Agenda.EventTitle>
		</Button>
	);
	const liveBadge = (id: string) =>
		segments.find((segment) => segment.id === id)?.isLive ? (
			<Chip size='sm' color='success' variant='soft' className='shrink-0'>
				Live
			</Chip>
		) : null;
	const agenda = useAgenda({
		events: segments.map((segment) => ({ ...segment, isReadOnly: !canEdit || eventLocked(segment.id) })),
		view,
		onViewChange: setView,
		date,
		onDateChange: setDate,
		selectedEventId: null,
		onEventSelect: (id) => {
			if (!id) return;
			const segment = segments.find((segment) => segment.id === id);
			const event = segment && events.find((event) => event.id === segment.eventId);
			if (event && segment) onEdit(event.id, plannerCreateWindow(toCalendarDateTime(fromDate(new Date(segment.trueStartUtc), event.timezone)), toCalendarDateTime(fromDate(new Date(segment.trueEndUtc), event.timezone)), event.timezone), undefined, eventLocked(id) || !canEdit, segment.trueStartUtc);
		},
		startHour: 0,
		endHour: 24,
		slotDuration: 30,
		onEventCreate: canEdit ? ({ start, end }) => onCreate(plannerCreateWindow(start, end, timezone)) : undefined,
		onEventResize: canEdit
			? (id, _start, end) => {
					const segment = segments.find((segment) => segment.id === id);
					const event = segment && events.find((event) => event.id === segment.eventId);
					if (!segment || !event || eventLocked(id)) return;
					const window = event.recurrence === "once" && event.timezone === timezone ? (plannerResizeWindow(segment, end, timezone) ?? undefined) : undefined;
					onEdit(event.id, window, window ? undefined : "Edit the full dates and times below.", false, segment.trueStartUtc);
				}
			: undefined,
		onEventMove: canEdit
			? (id, start) => {
					const segment = segments.find((segment) => segment.id === id);
					const event = segment && events.find((event) => event.id === segment.eventId);
					if (!segment || !event || eventLocked(id)) return;
					// A weekly-series or cross-zone gesture needs explicit full configuration choices.
					const window = event.recurrence === "once" && event.timezone === timezone ? plannerMoveWindow(segment, start, timezone) : undefined;
					onEdit(event.id, window, window ? undefined : "Edit the full dates and times below.", false, segment.trueStartUtc);
				}
			: undefined,
	});
	return (
		<section aria-label='Broadcast calendar' className='min-w-0'>
			<Agenda {...agenda} timeZone={timezone} className='w-full min-w-0'>
				<Agenda.Header className={styles.header}>
					<div className={styles.titlebar}>
						<Agenda.Heading />
						<div className={styles.actions}>{toolbar}</div>
					</div>
					<div className={styles.controls}>
						<Agenda.Navigation className={styles.navigation}>
							<Agenda.NavButton slot='previous' />
							<Agenda.TodayButton />
							<Agenda.NavButton slot='next' />
						</Agenda.Navigation>
						<Agenda.ViewSelector className={styles.views} />
						<div className={styles.dateControl}>
							<ScheduleDateField
								label='Displayed date'
								value={date.toString()}
								onChange={(value) => {
									if (value) setDate(parseDate(value));
								}}
							/>
						</div>
						{timezoneControl && <div className={styles.timezoneControl}>{timezoneControl}</div>}
					</div>
				</Agenda.Header>
				<Agenda.Body>
					{agenda.view === "month" ? (
						<Agenda.MonthGrid>
							{agenda.visibleWeeks.map((week, index) => {
								const layout = agenda.getMonthRowLayout(week);
								return (
									<Agenda.MonthRow key={index} spanningRowCount={layout.rowCount}>
										{layout.items.map((item) => (
											<Agenda.MonthSpanningEvent key={item.event.id} event={item.event} colStart={item.colStart} colSpan={item.colSpan} row={item.row} className={eventClass(item.event.id)}>
												<div className='flex w-full min-w-0 items-center gap-1'>
													{eventTitle(item.event)}
													{liveBadge(item.event.id)}
												</div>
												{lockIcon(item.event.id)}
											</Agenda.MonthSpanningEvent>
										))}
										{week.map((day, column) => (
											<Agenda.MonthCell key={day.toString()} date={day} spanningRowCount={layout.rowCountPerCol[column] ?? 0}>
												{agenda.getPerCellEvents(day, week).map((event) => (
													<Agenda.MonthEvent key={event.id} event={event} className={eventClass(event.id)}>
														<div className='flex w-full min-w-0 items-center gap-1'>
															{eventTitle(event)}
															{liveBadge(event.id)}
														</div>
														{lockIcon(event.id)}
													</Agenda.MonthEvent>
												))}
											</Agenda.MonthCell>
										))}
									</Agenda.MonthRow>
								);
							})}
						</Agenda.MonthGrid>
					) : (
						<>
							<Agenda.WeekHeader>
								{agenda.visibleDays.map((day) => (
									<Agenda.DayHeader key={day.toString()} date={day} />
								))}
							</Agenda.WeekHeader>
							{agenda.allDayLayout.length > 0 && (
								<Agenda.AllDaySection>
									<Agenda.AllDayLabel>All day</Agenda.AllDayLabel>
									{agenda.allDayLayout.map((item) => (
										<Agenda.AllDayEvent
											key={item.event.id}
											event={item.event}
											colStart={item.colStart}
											colSpan={item.colSpan}
											row={item.row}
											className={eventClass(item.event.id)}
											tabIndex={0}
											onKeyDown={(key) => {
												if (key.key === "Enter" || key.key === " ") {
													key.preventDefault();
													agenda.selectEvent(item.event.id);
												}
											}}
										>
											<div className='flex w-full min-w-0 items-center gap-1'>
												<span className='min-w-0 flex-1 truncate'>{item.event.title}</span>
												{liveBadge(item.event.id)}
											</div>
											{lockIcon(item.event.id)}
										</Agenda.AllDayEvent>
									))}
								</Agenda.AllDaySection>
							)}
							<Agenda.TimeGrid className='max-h-[45vh] sm:max-h-[60vh]'>
								<Agenda.CurrentTimeIndicator />
								{agenda.visibleDays.map((day) => (
									<Agenda.DayColumn key={day.toString()} date={day}>
										{agenda.getEventsForDay(day).map((event) => (
											<Agenda.Event key={event.id} event={event} className={[eventClass(event.id), segments.find((segment) => segment.id === event.id)?.canResizeEnd && event.end.millisecond === 0 ? "" : styles.continues].join(" ")}>
												{eventTitle(event)}
												<Agenda.EventTime event={event} />
												{liveBadge(event.id)}
												{lockIcon(event.id)}
											</Agenda.Event>
										))}
									</Agenda.DayColumn>
								))}
							</Agenda.TimeGrid>
						</>
					)}
				</Agenda.Body>
			</Agenda>
		</section>
	);
}
