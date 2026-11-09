"use client";
import { Calendar, DateField, DatePicker, Label, Switch } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import { parseAbsolute } from "@internationalized/date";
import { TimezonePicker } from "@components/runner/ScheduleFields";
import type { EventSchedule, EventPhase } from "@lib/events";
import LocalizedDate from "@components/localizedDate";
const entries = [
	{ key: "submissionsStart", label: "Submissions open", phase: "submissions" },
	{ key: "submissionsEnd", label: "Submissions close", phase: "review" },
	{ key: "votingStart", label: "Voting opens", phase: "voting" },
	{ key: "votingEnd", label: "Voting closes", phase: "closed" },
] as const;
export default function EventRoadmap({ value, onChange, phase = "draft", readOnly = false }: { value: EventSchedule; onChange?: (value: EventSchedule) => void; phase?: EventPhase; readOnly?: boolean }) {
	return (
		<div className='space-y-5'>
			{!readOnly ? (
				<>
					<TimezonePicker value={value.timezone} onChange={(timezone) => onChange?.({ ...value, timezone })} />
					<Switch isSelected={value.reviewRequired} onChange={(reviewRequired) => onChange?.({ ...value, reviewRequired })}>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Switch.Content>
							<Label>Review nominations before voting</Label>
						</Switch.Content>
					</Switch>
				</>
			) : null}
			<Timeline density='comfortable'>
				<Timeline.Item status={phase === "announcement" ? "current" : "default"}>
					<Timeline.Marker aria-hidden='true' />
					<Timeline.Content>
						<p className='font-medium'>Announcement</p>
						<p className='text-sm text-muted'>Your event page is available as soon as you publish.</p>
					</Timeline.Content>
				</Timeline.Item>
				{entries.map((entry) => (
					<Timeline.Item key={entry.key} status={phase === entry.phase ? "current" : "default"}>
						<Timeline.Marker aria-hidden='true' />
						<Timeline.Content>
							{readOnly ? (
								<div>
									<p className='font-medium'>{entry.label}</p>
									<LocalizedDate value={value[entry.key]} showTime timeZone={value.timezone} />
								</div>
							) : (
								<EventDateTimeField
									label={entry.label}
									value={value[entry.key]}
									timezone={value.timezone}
									onChange={(instant) => {
										if (instant) onChange?.({ ...value, [entry.key]: instant });
									}}
								/>
							)}
							{entry.key === "submissionsEnd" && value.reviewRequired ? <p className='text-sm text-muted'>Review runs until voting opens. Release the reviewed nominations when they are ready.</p> : null}
						</Timeline.Content>
					</Timeline.Item>
				))}
				<Timeline.Item status={phase === "results" ? "current" : "default"}>
					<Timeline.Marker aria-hidden='true' />
					<Timeline.Content>
						<p className='font-medium'>Publish results</p>
						<p className='text-sm text-muted'>Publish explicitly after your show. Results stay private until then.</p>
					</Timeline.Content>
				</Timeline.Item>
			</Timeline>
		</div>
	);
}

export function EventDateTimeField({ label, value, timezone, onChange }: { label: string; value: string; timezone: string; onChange: (value: string) => void }) {
	return (
		<DatePicker
			granularity='minute'
			value={value ? parseAbsolute(value, timezone) : null}
			onChange={(date) => {
				onChange(date?.toDate().toISOString() ?? "");
			}}
		>
			<Label>{label}</Label>
			<DateField.Group variant='secondary'>
				<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
				<DateField.Suffix>
					<DatePicker.Trigger>
						<DatePicker.TriggerIndicator />
					</DatePicker.Trigger>
				</DateField.Suffix>
			</DateField.Group>
			<DatePicker.Popover>
				<Calendar aria-label={`${label} date`}>
					<Calendar.Header>
						<Calendar.NavButton slot='previous' />
						<Calendar.Heading />
						<Calendar.NavButton slot='next' />
					</Calendar.Header>
					<Calendar.Grid>
						<Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
						<Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
					</Calendar.Grid>
				</Calendar>
			</DatePicker.Popover>
		</DatePicker>
	);
}
