"use client";

import { Button, DateField, DateRangePicker, Label, RangeCalendar } from "@heroui/react";
import type { ComponentProps } from "react";
import type { DateValue } from "@internationalized/date";

export type AppDateRange = { start: DateValue; end: DateValue };

type AppDateRangePickerProps = {
	label: string;
	value: AppDateRange | null;
	onChange: (value: AppDateRange | null) => void;
	className?: string;
	variant?: "primary" | "secondary";
	fullWidth?: boolean;
	presets?: Array<{ label: string; value: AppDateRange | null }>;
};

export default function AppDateRangePicker({ label, value, onChange, className, variant = "primary", fullWidth = false, presets = [] }: AppDateRangePickerProps) {
	return (
		<DateRangePicker className={`${fullWidth ? "w-full" : ""} ${className ?? ""}`.trim()} value={value as ComponentProps<typeof DateRangePicker>["value"]} onChange={(nextValue) => onChange(nextValue as unknown as AppDateRange | null)}>
			<Label>{label}</Label>
			<DateField.Group fullWidth variant={variant}>
				<DateField.Input slot='start'>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
				<DateRangePicker.RangeSeparator />
				<DateField.Input slot='end'>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
				<DateField.Suffix>
					<DateRangePicker.Trigger>
						<DateRangePicker.TriggerIndicator />
					</DateRangePicker.Trigger>
				</DateField.Suffix>
			</DateField.Group>
			<DateRangePicker.Popover>
				{presets.length > 0 ? (
					<div className='flex flex-wrap gap-2 border-b border-divider p-3'>
						{presets.map((preset) => (
							<Button key={preset.label} size='sm' variant='tertiary' onPress={() => onChange(preset.value)}>
								{preset.label}
							</Button>
						))}
					</div>
				) : null}
				<RangeCalendar aria-label={label}>
					<RangeCalendar.Header>
						<RangeCalendar.YearPickerTrigger>
							<RangeCalendar.YearPickerTriggerHeading />
							<RangeCalendar.YearPickerTriggerIndicator />
						</RangeCalendar.YearPickerTrigger>
						<RangeCalendar.NavButton slot='previous' />
						<RangeCalendar.NavButton slot='next' />
					</RangeCalendar.Header>
					<RangeCalendar.Grid>
						<RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
						<RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
					</RangeCalendar.Grid>
					<RangeCalendar.YearPickerGrid>
						<RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
					</RangeCalendar.YearPickerGrid>
				</RangeCalendar>
			</DateRangePicker.Popover>
		</DateRangePicker>
	);
}
