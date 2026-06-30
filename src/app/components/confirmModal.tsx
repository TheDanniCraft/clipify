"use client";
import { Button, Input, Modal, TextField, Label, FieldError } from "@heroui/react";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";

export default function ConfirmModal({ isOpen, onOpenChange, keyword, onConfirm }: { isOpen: boolean; onOpenChange: () => void; keyword: string; onConfirm: () => void }) {
	const [confirmed, setConfirmed] = useState(false);

	return (
		<Modal>
			<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header><Modal.Heading>
					<div className='flex items-center'>
						<IconAlertTriangle />
						<p className='ml-2'>Confirm Action</p>
					</div>
						</Modal.Heading></Modal.Header>
						<Modal.Body>
					<span className='leading-snug'>
						Are you sure that you want to delete <strong>{keyword}</strong>?
					</span>
					<p className='leading-snug'>
						<strong>This action is irreversible!</strong>
					</p>
					<TextField className='pt-4' isRequired><Label>{<>
								Type <strong>{keyword}</strong> to continue
							</>}</Label><Input onChange={(event) => ((e) => {
							if (e === keyword) {
								setConfirmed(true);
							} else {
								setConfirmed(false);
							}
						})(event.target.value)} placeholder={keyword} /><FieldError /></TextField>
					<div className='flex justify-end gap-2'>
						<Button onPress={onOpenChange}>Cancel</Button>
						<Button isDisabled={!confirmed} onPress={onConfirm} variant='danger'>
							Delete
						</Button>
					</div>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
