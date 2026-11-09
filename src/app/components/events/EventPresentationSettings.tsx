"use client";
import { Label, Switch, TextArea, TextField } from "@heroui/react";
import type { EventConfiguration } from "@lib/eventConfiguration";
export default function EventPresentationSettings({ value, onChange, disabled = false }: { value: EventConfiguration["presentation"]; onChange: (value: EventConfiguration["presentation"]) => void; disabled?: boolean }) {
	return (
		<fieldset disabled={disabled} className='max-w-3xl space-y-6'>
			<div>
				<h2 className='font-semibold'>Presenter chat</h2>
				<p className='mt-1 text-sm text-muted'>Show live Twitch reactions beside an enlarged nominee during your show.</p>
			</div>
			<Switch aria-label='Show Twitch chat' isSelected={value.showChat} onChange={(showChat) => onChange({ ...value, showChat })}>
				<Switch.Content>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Label>Show Twitch chat</Label>
				</Switch.Content>
			</Switch>
			<div className='grid gap-5 sm:grid-cols-2'>
				<TextField>
					<Label>Hidden accounts</Label>
					<TextArea variant='secondary' aria-label='Hidden accounts' placeholder='One Twitch username per line' value={value.hiddenAccounts.join("\n")} onChange={(event) => onChange({ ...value, hiddenAccounts: event.target.value.split("\n") })} />
					<p className='text-sm text-muted'>Hide messages from these accounts, including bots.</p>
				</TextField>
				<TextField>
					<Label>Hidden command prefixes</Label>
					<TextArea variant='secondary' aria-label='Hidden command prefixes' placeholder='One prefix per line' value={value.commandPrefixes.join("\n")} onChange={(event) => onChange({ ...value, commandPrefixes: event.target.value.split("\n") })} />
					<p className='text-sm text-muted'>Messages starting with these prefixes stay hidden. Leave empty to show commands.</p>
				</TextField>
			</div>
		</fieldset>
	);
}
