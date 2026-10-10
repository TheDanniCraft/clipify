"use client";

import { useState, useTransition } from "react";
import { Button, Modal, TextField, Label, TextArea } from "@heroui/react";
import { setAdminAccountAccess } from "@/app/actions/admin-account-access";

export default function AdminAccountAccessControl({ user, onChanged }: { user: { id: string; username: string; disabled?: boolean; disabledReason?: string | null }; onChanged: () => Promise<void> }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [message, setMessage] = useState("");
	const [pending, startTransition] = useTransition();
	function submit() {
		startTransition(async () => {
			setMessage("");
			try {
				const result = await setAdminAccountAccess({ userId: user.id, disabled: !user.disabled, reason });
				await onChanged();
				if (result.changed && !result.notificationQueued) {
					setMessage("Account access updated, but the notification email could not be queued.");
					setOpen(false);
				} else {
					setOpen(false);
					setReason("");
				}
			} catch (error) {
				setMessage(error instanceof Error && error.message === "CANNOT_DISABLE_OWN_ACCOUNT" ? "You cannot disable your own account." : "Could not update account access. Please try again.");
			}
		});
	}
	return (
		<>
			<Button
				size='sm'
				variant='tertiary'
				className={user.disabled ? "mr-2 text-success" : "mr-2 text-danger"}
				onPress={() => {
					setMessage("");
					setReason("");
					setOpen(true);
				}}
			>
				{user.disabled ? "Enable" : "Disable"}
			</Button>
			{!open && message && (
				<p role='alert' className='text-sm text-danger'>
					{message}
				</p>
			)}
			{open && (
				<Modal.Backdrop
					isOpen={open}
					onOpenChange={(value) => {
						if (!pending) setOpen(value);
					}}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.CloseTrigger isDisabled={pending} />
							<Modal.Header>
								<Modal.Heading>
									{user.disabled ? "Enable" : "Disable"} @{user.username}
								</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p>{user.disabled ? "Restore access and send an account-enabled email. Paused overlays will remain paused." : "Disable access, pause this user’s overlays, and email the user with your reason."}</p>
								{user.disabledReason && <p className='text-sm text-muted'>Current reason: {user.disabledReason}</p>}
								{!user.disabled && (
									<TextField isRequired>
										<Label>Reason shown to the user</Label>
										<TextArea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} disabled={pending} aria-label='Reason shown to the user' />
									</TextField>
								)}
								{message && (
									<p role='alert' className='text-sm text-danger'>
										{message}
									</p>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button variant='tertiary' isDisabled={pending} onPress={() => setOpen(false)}>
									Cancel
								</Button>
								<Button variant={user.disabled ? "primary" : "danger"} isPending={pending} isDisabled={!user.disabled && !reason.trim()} onPress={submit}>
									{user.disabled ? "Enable account" : "Disable account"}
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			)}
		</>
	);
}
