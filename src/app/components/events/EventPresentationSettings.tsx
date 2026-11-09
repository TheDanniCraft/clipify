"use client";
import { useState } from "react";
import { Button, Label, Modal, Switch, TextArea, TextField } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import type { EventConfiguration } from "@lib/eventConfiguration";
export default function EventPresentationSettings({ value, onChange, disabled = false }: { value: EventConfiguration["presentation"]; onChange: (value: EventConfiguration["presentation"]) => void; disabled?: boolean }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant='secondary' isDisabled={disabled} onPress={() => setOpen(true)}>
				Chat settings
			</Button>
			<ControlledModal isOpen={open} onOpenChange={setOpen} ariaLabel='Presenter chat settings' size='lg'>
				<Modal.Header>
					<Modal.Heading>Presenter chat</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='space-y-5'>
					<Switch aria-label='Show Twitch chat' isSelected={value.showChat} onChange={(showChat) => onChange({ ...value, showChat })}>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Switch.Content>
							<Label>Show Twitch chat</Label>
						</Switch.Content>
					</Switch>
					<p className='text-sm text-muted'>Show live reactions beside enlarged nominees.</p>
					<TextField>
						<Label>Hidden accounts</Label>
						<TextArea variant='secondary' aria-label='Hidden accounts' placeholder='One Twitch username per line' value={value.hiddenAccounts.join("\n")} onChange={(event) => onChange({ ...value, hiddenAccounts: event.target.value.split("\n") })} />
					</TextField>
					<TextField>
						<Label>Hidden command prefixes</Label>
						<TextArea variant='secondary' aria-label='Hidden command prefixes' placeholder='One prefix per line' value={value.commandPrefixes.join("\n")} onChange={(event) => onChange({ ...value, commandPrefixes: event.target.value.split("\n") })} />
					</TextField>
					<p className='text-sm text-muted'>Messages beginning with these prefixes stay hidden. Leave this empty to show commands.</p>
				</Modal.Body>
				<Modal.Footer>
					<Button onPress={() => setOpen(false)}>Done</Button>
				</Modal.Footer>
			</ControlledModal>
		</>
	);
}
