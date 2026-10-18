"use client";

import { Button } from "@heroui/react";

type Destination = { id: string; name: string; provider: string; host: string; credentialConfigured: boolean };

export function canStartWithDestinations(destinations: readonly Destination[], selectedIds: readonly string[]) {
	return selectedIds.length > 0 && selectedIds.every((id) => destinations.some((destination) => destination.id === id && (destination.provider === "custom" || destination.credentialConfigured)));
}

export default function RunnerDestinationSelection({ destinations, selectedIds, runnerPro, onChange }: { destinations: readonly Destination[]; selectedIds: readonly string[]; runnerPro: boolean; onChange: (ids: string[]) => void }) {
	return (
		<fieldset className='space-y-3'>
			<legend className='text-sm font-medium'>Broadcast destinations</legend>
			<p className='text-sm text-muted'>{runnerPro ? "Select the destinations for this broadcast. Your Runner sends to each from your computer." : "Free includes one destination per broadcast."}</p>
			<div className='grid gap-2 sm:grid-cols-2'>
				{destinations.map((destination) => {
					const selected = selectedIds.includes(destination.id);
					const ready = destination.provider === "custom" || destination.credentialConfigured;
					return (
						<Button key={destination.id} variant={selected ? "secondary" : "outline"} aria-pressed={selected} isDisabled={!ready && !selected} className='h-auto justify-start whitespace-normal px-4 py-3 text-left' onPress={() => onChange(selected ? selectedIds.filter((id) => id !== destination.id) : runnerPro ? [...selectedIds, destination.id] : [destination.id])}>
							<span className='flex flex-col gap-1'>
								<span className='font-medium'>{destination.name}</span>
								<span className='text-xs text-muted'>
									{destination.host}
									{ready ? "" : " · Add a stream key in Destinations"}
								</span>
							</span>
						</Button>
					);
				})}
			</div>
			{!destinations.length && <p className='text-sm text-muted'>Add a destination below, then select it for this broadcast.</p>}
		</fieldset>
	);
}
