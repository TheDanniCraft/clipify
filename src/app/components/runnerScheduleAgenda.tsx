"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";
import { Agenda, useAgenda, type AgendaView } from "@heroui-pro/react";
import { ScheduleDateField } from "./runner/ScheduleFields";
import { useLocale } from "react-aria-components/I18nProvider";
import { parseDate, today, startOfWeek, startOfMonth, getLocalTimeZone } from "@internationalized/date";
import styles from "./runnerScheduleAgenda.module.css";
import { projectScheduleViewport, plannerCreateWindow, plannerMoveWindow, plannerResizeWindow, type PlannerEvent } from "./runnerSchedulePlanner";

const mobileQuery = "(max-width: 639px)";
function subscribeViewport(listener: () => void) {
	const query = window.matchMedia(mobileQuery);
	query.addEventListener("change", listener);
	return () => query.removeEventListener("change", listener);
}
export default function RunnerScheduleAgenda({ events, canEdit, onEdit, onCreate, timezone = getLocalTimeZone() }: { events: PlannerEvent[]; timezone?: string; canEdit: boolean; onEdit: (id: string, window?: ReturnType<typeof plannerCreateWindow>, notice?: string) => void; onCreate: (window: ReturnType<typeof plannerCreateWindow>) => void }) {
	const { locale } = useLocale();
	const mobile = useSyncExternalStore(
		subscribeViewport,
		() => window.matchMedia(mobileQuery).matches,
		() => false,
	);
	const [date, setDate] = useState(() => today(timezone));
	const [selectedView, setView] = useState<AgendaView | null>(null);
	const view = selectedView ?? (mobile ? "day" : "week");
	const segments = useMemo(() => projectScheduleViewport(events, view === "day" ? date : startOfWeek(view === "month" ? startOfMonth(date) : date, locale), view === "day" ? 1 : view === "month" ? 42 : 7, timezone), [events, date, view, timezone, locale]);
	const agenda = useAgenda({
		events: segments.map((segment) => ({ ...segment, isReadOnly: !canEdit || Boolean(events.find((event) => event.id === segment.eventId)?.lockedUntil) })),
		view,
		onViewChange: setView,
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
		<section aria-label='Broadcast calendar' className='min-w-0'>
			<Agenda {...agenda} timeZone={timezone} className='w-full min-w-0'>
				<Agenda.Header className='flex-wrap gap-3'>
					<Agenda.Heading />
					<Agenda.ViewSelector />
					<Agenda.Navigation>
						<Agenda.NavButton slot='previous' />
						<Agenda.TodayButton />
						<Agenda.NavButton slot='next' />
					</Agenda.Navigation>
				</Agenda.Header>
				<div className='max-w-64 px-3 pb-4'>
					<ScheduleDateField
						label='Displayed date'
						value={date.toString()}
						onChange={(value) => {
							if (value) setDate(parseDate(value));
						}}
					/>
				</div>
				<Agenda.Body>
					{agenda.view === "month" ? (
						<Agenda.MonthGrid>
							{agenda.visibleWeeks.map((week, index) => {
								const layout = agenda.getMonthRowLayout(week);
								return (
									<Agenda.MonthRow key={index} spanningRowCount={layout.rowCount}>
										{layout.items.map((item) => (
											<Agenda.MonthSpanningEvent key={item.event.id} event={item.event} colStart={item.colStart} colSpan={item.colSpan} row={item.row} />
										))}
										{week.map((day, column) => (
											<Agenda.MonthCell key={day.toString()} date={day} spanningRowCount={layout.rowCountPerCol[column] ?? 0}>
												{agenda.getPerCellEvents(day, week).map((event) => (
													<Agenda.MonthEvent key={event.id} event={event} />
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
							<Agenda.TimeGrid className='max-h-[60vh]'>
								<Agenda.CurrentTimeIndicator />
								{agenda.visibleDays.map((day) => (
									<Agenda.DayColumn key={day.toString()} date={day}>
										{agenda.getEventsForDay(day).map((event) => (
											<Agenda.Event key={event.id} event={event} className={segments.find((segment) => segment.id === event.id)?.canResizeEnd && event.end.millisecond === 0 ? undefined : styles.continues}>
												<Button variant='ghost' size='sm' className='h-auto min-h-0 w-full min-w-0 justify-start rounded-none p-0 text-left text-inherit' isDisabled={!canEdit || event.isReadOnly} onPressStart={(press) => press.continuePropagation()} onPress={() => agenda.selectEvent(event.id)} onClick={(click) => click.stopPropagation()}>
													<Agenda.EventTitle>{event.title}</Agenda.EventTitle>
												</Button>
												<Agenda.EventTime event={event} />
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
