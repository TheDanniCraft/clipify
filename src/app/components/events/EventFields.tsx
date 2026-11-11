"use client";
import { Input, Label, ListBox, NumberField, Select, TextField } from "@heroui/react";
export function EventText({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
	return (
		<TextField>
			<Label>{label}</Label>
			<Input aria-label={label} variant='secondary' value={value} onChange={(e) => onChange(e.target.value)} {...(multiline ? { className: "min-w-0" } : {})} />
		</TextField>
	);
}
export function EventSelect({ label, value, onChange, options, isDisabled }: { isDisabled?: boolean; label: string; value: string; onChange: (value: string) => void; options: readonly { id: string; label: string; isDisabled?: boolean }[] }) {
	return (
		<Select
			isDisabled={isDisabled}
			aria-label={label}
			variant='secondary'
			value={value}
			onChange={(key) => {
				if (key !== null) onChange(String(key));
			}}
		>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item isDisabled={option.isDisabled} key={option.id} id={option.id} textValue={option.label}>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
export function EventNumber({ label, value, onChange, min = 0, max = 10000 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
	return (
		<NumberField variant='secondary' value={value} minValue={min} maxValue={max} onChange={onChange}>
			<Label>{label}</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
		</NumberField>
	);
}
