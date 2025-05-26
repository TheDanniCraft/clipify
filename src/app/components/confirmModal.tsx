"use client";

import { Button, Input, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";

export default function ConfirmModal({ isOpen, onOpenChange, keyword, onConfirm }: { isOpen: boolean; onOpenChange: () => void; keyword: string; onConfirm: () => void }) {
	const [confirmed, setConfirmed] = useState(false);

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
			<ModalContent>
				<ModalHeader>
					<div className='flex items-center'>
						<IconAlertTriangle />
						<p className='ml-2'>Confirm Action</p>
					</div>
				</ModalHeader>
				<ModalBody>
					<span className='leading-snug'>
						Are you sure that you want to delete <strong>{keyword}</strong>?
					</span>
					<p className='leading-snug'>
						<strong>This action is irreversible!</strong>
					</p>
					<Input
						className='pt-4'
						label={
							<>
								Type <strong>{keyword}</strong> to continue
							</>
						}
						onValueChange={(e) => {
							if (e === keyword) {
								setConfirmed(true);
							} else {
								setConfirmed(false);
							}
						}}
						labelPlacement='outside'
						placeholder={keyword}
						required
					/>
					<div className='flex justify-end gap-2'>
						<Button onPress={onOpenChange}>Cancel</Button>
						<Button color='danger' isDisabled={!confirmed} onPress={onConfirm}>
							Delete
						</Button>
					</div>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
