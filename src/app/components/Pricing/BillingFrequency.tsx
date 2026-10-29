"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { annualSavingsPercent, FrequencyEnum, type RuntimePricing } from "./pricing-types";

export default function BillingFrequency({ value, onChange, pricing }: { value: FrequencyEnum; onChange: (value: FrequencyEnum) => void; pricing?: RuntimePricing | null }) {
	const saving = annualSavingsPercent(pricing);
	return (
		<div className='mx-auto w-full max-w-[22rem]'>
			<div className='relative rounded-full border border-border bg-surface-secondary p-1 shadow-inner'>
				<span aria-hidden='true' className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm transition-transform duration-300 motion-reduce:transition-none ${value === FrequencyEnum.Yearly ? "translate-x-full" : ""}`} />
				<ToggleButtonGroup
					aria-label='Billing frequency'
					selectionMode='single'
					disallowEmptySelection
					selectedKeys={[value]}
					onSelectionChange={(keys) => {
						const selected = keys.values().next().value;
						if (selected === FrequencyEnum.Monthly || selected === FrequencyEnum.Yearly) onChange(selected);
					}}
					className='relative grid w-full grid-cols-2 gap-0 rounded-full bg-transparent p-0'
				>
					{[FrequencyEnum.Monthly, FrequencyEnum.Yearly].map((frequency) => (
						<ToggleButton key={frequency} id={frequency} aria-label={frequency === FrequencyEnum.Monthly ? "Pay Monthly" : "Pay Yearly"} className='relative z-10 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-transparent px-2 text-sm font-medium text-foreground data-[selected=true]:bg-transparent data-[selected=true]:text-foreground'>
							<span>{frequency === FrequencyEnum.Monthly ? "Monthly" : "Yearly"}</span>
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			</div>
			{saving !== null ? <p className='mt-2 text-center text-xs text-foreground/70'>Save {saving}% with yearly billing</p> : null}
		</div>
	);
}
