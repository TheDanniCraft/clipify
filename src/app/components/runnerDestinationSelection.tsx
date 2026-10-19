"use client";
import { Button, Label, ListBox, Select } from "@heroui/react";

type Destination = { id: string; name: string; provider: string; host: string; credentialConfigured: boolean };
export function canStartWithDestinations(destinations: readonly Destination[], selectedIds: readonly string[]) {
	return selectedIds.length > 0 && selectedIds.every((id) => destinations.some((destination) => destination.id === id && (destination.provider === "custom" || destination.credentialConfigured)));
}
export default function RunnerDestinationSelection({ destinations, selectedIds, runnerPro, onChange, onManage, label = "Broadcast destinations" }: { destinations: readonly (Pick<Destination, "id" | "name"> & Partial<Destination>)[]; selectedIds: readonly string[]; runnerPro: boolean; onChange: (ids: string[]) => void; onManage?: () => void; label?: string }) {
	const multiple = runnerPro || selectedIds.length > 1;
	return (
		<fieldset className='space-y-3'>
			<legend className='sr-only'>{label}</legend>
			<Select variant='secondary' selectionMode={multiple ? "multiple" : "single"} value={multiple ? selectedIds : (selectedIds[0] ?? null)} placeholder={destinations.length ? "Choose destinations" : "No destinations yet"} isDisabled={!destinations.length} onChange={(value) => onChange(Array.isArray(value) ? value.map(String) : value ? [String(value)] : [])} onClear={() => onChange([])}>
				<Label>{label}</Label>
				<Select.Trigger>
					<Select.Value />
					<Select.ClearButton />
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						{destinations.map((destination) => {
							const ready = destination.provider === undefined || destination.provider === "custom" || destination.credentialConfigured;
							return (
								<ListBox.Item key={destination.id} id={destination.id} textValue={destination.name} isDisabled={(!ready || (!runnerPro && selectedIds.length > 1)) && !selectedIds.includes(destination.id)}>
									<ListBox.ItemIndicator />
									<div>
										<Label>{destination.name}</Label>
										<p className='text-xs text-muted'>
											{destination.host}
											{!ready && <span className='block'>Add a stream key in Destinations</span>}
										</p>
									</div>
								</ListBox.Item>
							);
						})}
					</ListBox>
				</Select.Popover>
			</Select>
			{!runnerPro && selectedIds.length > 1 && <p className='text-sm text-muted'>Select one destination before saving.</p>}
			{onManage && (
				<Button variant='secondary' size='sm' onPress={onManage}>
					{destinations.length ? "Manage destinations" : "Add destination"}
				</Button>
			)}
		</fieldset>
	);
}
