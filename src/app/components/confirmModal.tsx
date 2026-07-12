"use client";
import { Button, Input, Modal, TextField, Label, FieldError } from "@heroui/react";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

type ConfirmModalProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title?: string;
	description?: ReactNode;
	content?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	keyword?: string;
	confirmVariant?: "primary" | "secondary" | "danger";
	cancelVariant?: "primary" | "secondary" | "danger";
	onConfirm: () => void | Promise<void>;
};

export default function ConfirmModal({ isOpen, onOpenChange, keyword, content, confirmVariant = "danger", cancelVariant = "secondary", onConfirm, title = "Confirm Action", description, confirmLabel = "Confirm", cancelLabel = "Cancel" }: ConfirmModalProps) {
	const [confirmed, setConfirmed] = useState(false);
	const requiresKeyword = Boolean(keyword);
	if (!isOpen) return null;
	const effectiveConfirmLabel = keyword && confirmLabel === "Confirm" ? "Delete" : confirmLabel;

	return (
		<Modal>
			<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>
								<div className='flex items-center'>
									<IconAlertTriangle />
									<p className='ml-2'>{title}</p>
								</div>
							</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='gap-4'>
							{content ?? <div className='leading-snug'>{description ?? (keyword ? `Are you sure that you want to delete ${keyword}?` : "Are you sure you want to continue?")}</div>}
							{requiresKeyword ? (
								<TextField className='pt-4 mb-2' variant='secondary' isRequired>
									<Label>
										Type <strong>{keyword}</strong> to continue
									</Label>
									<Input variant='secondary' onChange={(event) => setConfirmed(event.target.value === keyword)} placeholder={keyword} />
									<FieldError />
								</TextField>
							) : null}
							<div className='mt-3 flex justify-end gap-2'>
								<Button onPress={() => onOpenChange(false)} variant={cancelVariant}>
									{cancelLabel}
								</Button>
								<Button isDisabled={requiresKeyword && !confirmed} onPress={onConfirm} variant={confirmVariant}>
									{effectiveConfirmLabel}
								</Button>
							</div>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
