"use client";
import { IconSettings, IconPlus } from "@tabler/icons-react";
import { Button, Label, ListBox, Select } from "@heroui/react";
import RunnerOutputStatus, { type RunnerOutput } from "./runnerOutputStatus";

type Destination = { id: string; name: string; provider: string; host: string; credentialConfigured: boolean };
export function canStartWithDestinations(destinations: readonly Destination[], selectedIds: readonly string[]) {
	return selectedIds.length > 0 && selectedIds.every((id) => destinations.some((destination) => destination.id === id && (destination.provider === "custom" || destination.credentialConfigured)));
}
export default function RunnerDestinationSelection({ destinations, selectedIds, runnerPro, onChange, onManage, outputs, online = false, label = "Broadcast destinations" }: { destinations: readonly (Pick<Destination, "id" | "name"> & Partial<Destination>)[]; selectedIds: readonly string[]; runnerPro: boolean; onChange: (ids: string[]) => void; onManage?: () => void; outputs?: readonly RunnerOutput[]; online?: boolean; label?: string }) {
	const multiple = runnerPro || selectedIds.length > 1;
	return (
		<fieldset className='min-w-0 space-y-3'>
			<legend className='sr-only'>{label}</legend>
			<Select className='min-w-0' fullWidth aria-label={label} variant='secondary' selectionMode={multiple ? "multiple" : "single"} value={multiple ? selectedIds : (selectedIds[0] ?? null)} placeholder={destinations.length ? "Choose destinations" : "No destinations yet"} isDisabled={!destinations.length} onChange={(value) => onChange(Array.isArray(value) ? value.map(String) : value ? [String(value)] : [])} onClear={() => onChange([])}>
				<Label>{label}</Label>
				<Select.Trigger className='h-9'>
					<Select.Value className='min-w-0 flex-1'>
						{({ isPlaceholder, defaultChildren }) =>
							isPlaceholder ? (
								defaultChildren
							) : (
								<span className='flex min-w-0 items-center gap-3 overflow-hidden'>
									{destinations
										.filter((destination) => selectedIds.includes(destination.id))
										.map((destination) => (
											<span key={destination.id} className='flex min-w-0 items-center gap-2'>
												<span className='truncate'>{destination.name}</span>
												{outputs !== undefined && <RunnerOutputStatus name={destination.name} output={outputs.find((output) => output.id === destination.id)} online={online} />}
											</span>
										))}
								</span>
							)
						}
					</Select.Value>
					<Select.ClearButton />
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						{destinations.map((destination) => {
							const ready = destination.provider === undefined || destination.provider === "custom" || destination.credentialConfigured;
							return (
								<ListBox.Item className='pr-9' key={destination.id} id={destination.id} textValue={destination.name} isDisabled={(!ready || (!runnerPro && selectedIds.length > 1)) && !selectedIds.includes(destination.id)}>
									<ListBox.ItemIndicator />
									<div className='min-w-0 flex-1'>
										<Label>{destination.name}</Label>
										<p className='text-xs text-muted'>
											{destination.host}
											{!ready && <span className='block'>Add a stream key in Destinations</span>}
										</p>
									</div>
									{outputs !== undefined && (selectedIds.includes(destination.id) || outputs.some((output) => output.id === destination.id)) && <RunnerOutputStatus name={destination.name} output={outputs.find((output) => output.id === destination.id)} online={online} />}
								</ListBox.Item>
							);
						})}
					</ListBox>
				</Select.Popover>
			</Select>
			{!runnerPro && selectedIds.length > 1 && <p className='text-sm text-muted'>Select one destination before saving.</p>}
			{onManage && (
				<Button variant='secondary' size='sm' onPress={onManage}>
					{destinations.length ? <IconSettings size={16} aria-hidden='true' /> : <IconPlus size={16} aria-hidden='true' />}
					{destinations.length ? "Manage destinations" : "Add destination"}
				</Button>
			)}
		</fieldset>
	);
}
