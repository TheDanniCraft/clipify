"use client";
import { useEffect, useMemo, useState } from "react";
import { Calendar, ComboBox, DatePicker, DateField, Input, Label, ListBox, TimeField, FieldError } from "@heroui/react";
import { parseDate, parseTime } from "@internationalized/date";

export function ScheduleDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
	return (
		<DatePicker value={value ? parseDate(value) : null} onChange={(date) => onChange(date?.toString() ?? "")}>
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
				<Calendar>
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
export function ScheduleTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
	return (
		<TimeField value={value ? parseTime(value) : null} hourCycle={24} granularity='minute' onChange={(time) => onChange(time?.toString().slice(0, 5) ?? "")}>
			<Label>{label}</Label>
			<DateField.Group variant='secondary'>
				<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
			</DateField.Group>
		</TimeField>
	);
}
export function TimezonePicker({ value, onChange, label = "Timezone", onValidityChange }: { value: string; onChange: (value: string) => void; label?: string; onValidityChange?: (valid: boolean) => void }) {
	const [search, setSearch] = useState({ source: value, text: value });
	const query = search.source === value ? search.text : value;
	useEffect(() => {
		onValidityChange?.(query === value);
	}, [onValidityChange, query, value]);
	const setQuery = (text: string) => setSearch({ source: value, text });
	const zones = useMemo(() => [...new Set([value, "UTC", ...Intl.supportedValuesOf("timeZone")])], [value]);
	const filtered = zones.filter((zone) => query === value || zone.toLowerCase().includes(query.toLowerCase()));
	return (
		<ComboBox
			variant='secondary'
			selectedKey={value}
			inputValue={query}
			allowsCustomValue
			isInvalid={query !== value}
			onInputChange={(text) => {
				setQuery(text);
			}}
			onSelectionChange={(key) => {
				if (key) {
					onChange(String(key));

					setQuery(String(key));
				}
			}}
			defaultFilter={() => true}
		>
			<Label>{label}</Label>
			<ComboBox.InputGroup>
				<Input variant='secondary' aria-label={label} />
				<ComboBox.Trigger />
			</ComboBox.InputGroup>
			<ComboBox.Popover>
				<ListBox items={filtered.map((id) => ({ id }))}>
					{(zone) => (
						<ListBox.Item id={zone.id} textValue={zone.id}>
							<Label>{zone.id.replaceAll("_", " ")}</Label>
							<ListBox.ItemIndicator />
						</ListBox.Item>
					)}
				</ListBox>
			</ComboBox.Popover>
			{query !== value && <FieldError>Choose a timezone from the list.</FieldError>}
		</ComboBox>
	);
}
