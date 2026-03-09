import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CopyText } from "@/app/components/OverlayTable/copy-text";

jest.mock("@heroui/react", () => ({
	cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
	Tooltip: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => (
		<div>
			<span data-testid='tooltip-content'>{content}</span>
			{children}
		</div>
	),
	Button: ({ onPress, children, "aria-label": ariaLabel }: { onPress?: () => void; children: React.ReactNode; "aria-label"?: string }) => (
		<button onClick={onPress} aria-label={ariaLabel}>
			{children}
		</button>
	),
}));

jest.mock("@tabler/icons-react", () => ({
	IconClipboard: () => <span>clipboard</span>,
	IconChecks: () => <span>checks</span>,
}));

describe("components/OverlayTable/CopyText", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		Object.assign(navigator, {
			clipboard: {
				writeText: jest.fn(),
			},
		});
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	it("copies text and toggles feedback state", () => {
		render(<CopyText>overlay-id-123</CopyText>);
		expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Copy");

		fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith("overlay-id-123");
		expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Copied");

		act(() => {
			jest.advanceTimersByTime(3000);
		});

		expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Copy");
	});
});
