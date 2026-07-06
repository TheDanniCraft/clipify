"use client";

import { Modal } from "@heroui/react";
import type { ReactNode } from "react";

type ControlledModalProps = {
	children: ReactNode;
	isOpen: boolean;
	onOpenChange?: (isOpen: boolean) => void;
	onClose?: () => void;
	variant?: "opaque" | "blur" | "transparent";
	size?: "xs" | "sm" | "md" | "lg" | "cover" | "full";
	containerClassName?: string;
	dialogClassName?: string;
	showCloseButton?: boolean;
};

export default function ControlledModal({ children, isOpen, onOpenChange, onClose, variant, size, containerClassName, dialogClassName, showCloseButton = true }: ControlledModalProps) {
	const handleOpenChange = (open: boolean) => {
		onOpenChange?.(open);
		if (!open) onClose?.();
	};

	return (
		<Modal>
			<Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange} variant={variant}>
				<Modal.Container size={size} className={containerClassName}>
					<Modal.Dialog className={dialogClassName}>
						{showCloseButton ? <Modal.CloseTrigger /> : null}
						{children}
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
