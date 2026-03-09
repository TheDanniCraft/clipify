import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ConfirmModal from "@/app/components/confirmModal";

jest.mock("@heroui/react", () => ({
	Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (isOpen ? <div>{children}</div> : null),
	ModalContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	ModalHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Input: ({ onValueChange, placeholder }: { onValueChange: (value: string) => void; placeholder?: string }) => (
		<input aria-label='confirm-input' placeholder={placeholder} onChange={(e) => onValueChange(e.currentTarget.value)} />
	),
	Button: ({ onPress, children, isDisabled }: { onPress?: () => void; children: React.ReactNode; isDisabled?: boolean }) => (
		<button onClick={onPress} disabled={isDisabled}>
			{children}
		</button>
	),
}));

jest.mock("@tabler/icons-react", () => ({
	IconAlertTriangle: () => <span>warning</span>,
}));

describe("components/ConfirmModal", () => {
	it("keeps delete disabled until the exact keyword is entered", () => {
		const onConfirm = jest.fn();
		const onOpenChange = jest.fn();

		render(<ConfirmModal isOpen onOpenChange={onOpenChange} keyword='DELETE' onConfirm={onConfirm} />);

		const deleteButton = screen.getByRole("button", { name: "Delete" });
		expect(deleteButton).toBeDisabled();

		fireEvent.change(screen.getByLabelText("confirm-input"), { target: { value: "DEL" } });
		expect(deleteButton).toBeDisabled();

		fireEvent.change(screen.getByLabelText("confirm-input"), { target: { value: "DELETE" } });
		expect(deleteButton).toBeEnabled();

		fireEvent.click(deleteButton);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("calls cancel action", () => {
		const onConfirm = jest.fn();
		const onOpenChange = jest.fn();

		render(<ConfirmModal isOpen onOpenChange={onOpenChange} keyword='DELETE' onConfirm={onConfirm} />);
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
	});
});
