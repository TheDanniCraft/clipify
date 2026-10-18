"use client";

import { Label, ListBox, Select } from "@heroui/react";
import { IconLock } from "@tabler/icons-react";
import type { StreamControlMode } from "@types";

export default function RunnerControlSelection({ value, clipPlayback, scheduling, onChange, onUpgrade }: { value: StreamControlMode; clipPlayback: boolean; scheduling: boolean | null; onChange: (value: StreamControlMode) => void; onUpgrade: () => void }) {
	return (
		<Select
			value={value}
			onChange={(selected) => {
				if (selected === "manual") onChange("manual");
				else if (selected === "scheduled" && clipPlayback && scheduling !== null) {
					if (scheduling) onChange("scheduled");
					else onUpgrade();
				}
			}}
			variant='secondary'
		>
			<Label>Control</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					<ListBox.Item id='manual' textValue='Manual'>
						<ListBox.ItemIndicator />
						<Label>Manual</Label>
					</ListBox.Item>
					<ListBox.Item id='scheduled' textValue='Scheduled' isDisabled={!clipPlayback || scheduling === null}>
						<ListBox.ItemIndicator />
						<Label>Scheduled</Label>
						{scheduling === false && <IconLock size={16} role='img' aria-label='Requires Pro' />}
					</ListBox.Item>
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
