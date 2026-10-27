"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { frequencies } from "./pricing-catalog";
import { FrequencyEnum } from "./pricing-types";

export default function BillingFrequency({ value, onChange }: { value: FrequencyEnum; onChange: (value: FrequencyEnum) => void }) {
	return (
		<ToggleButtonGroup
			aria-label='Billing frequency'
			selectionMode='single'
			disallowEmptySelection
			selectedKeys={[value]}
			onSelectionChange={(keys) => {
				const selected = keys.values().next().value;
				if (selected === FrequencyEnum.Monthly || selected === FrequencyEnum.Yearly) onChange(selected);
			}}
			size='sm'
			className='mx-auto w-fit max-w-full'
		>
			{frequencies.map((frequency) => (
				<ToggleButton key={frequency.key} id={frequency.key} className='whitespace-nowrap px-4 text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'>
					{frequency.label}
				</ToggleButton>
			))}
		</ToggleButtonGroup>
	);
}
