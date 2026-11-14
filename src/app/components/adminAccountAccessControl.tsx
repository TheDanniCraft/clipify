"use client";
import { notify } from "@lib/toast";

import { useState, useTransition } from "react";
import { Button, Modal, TextField, Label, TextArea, Tooltip } from "@heroui/react";
import { setAdminAccountAccess } from "@/app/actions/admin-account-access";

import { IconUserOff, IconUserCheck } from "@tabler/icons-react";

export default function AdminAccountAccessControl({ user, onChanged, compact = false }: { user: { id: string; username: string; disabled?: boolean; disabledReason?: string | null }; onChanged: () => Promise<void>; compact?: boolean }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [pending, startTransition] = useTransition();
	function submit() {
		startTransition(async () => {
			try {
				const result = await setAdminAccountAccess({ userId: user.id, disabled: !user.disabled, reason });
				await onChanged();
				if (result.changed && !result.notificationQueued) {
					notify({ title: "Account access updated, but the notification email could not be queued.", color: "warning" });
					setOpen(false);
				} else {
					setOpen(false);
					setReason("");
				}
			} catch (error) {
				notify({ title: error instanceof Error && error.message === "CANNOT_DISABLE_OWN_ACCOUNT" ? "You cannot disable your own account." : "Could not update account access. Please try again.", color: "danger" });
			}
		});
	}
	return (
		<>
			<Tooltip isDisabled={!compact}>
				<Button
					size='sm'
					isIconOnly={compact}
					aria-label={compact ? (user.disabled ? "Enable" : "Disable") : undefined}
					variant='tertiary'
					className={user.disabled ? "text-success" : "text-danger"}
					onPress={() => {
						setReason("");
						setOpen(true);
					}}
				>
					{compact ? user.disabled ? <IconUserCheck className='size-4' /> : <IconUserOff className='size-4' /> : user.disabled ? "Enable" : "Disable"}
				</Button>
				<Tooltip.Content>{user.disabled ? "Enable account" : "Disable account"}</Tooltip.Content>
			</Tooltip>
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
