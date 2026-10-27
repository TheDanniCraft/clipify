/** @jest-environment jsdom */

import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import PricingComparison from "@/app/components/Pricing/comparison";

jest.mock("@/app/components/Pricing/BillingFrequency", () => ({
	__esModule: true,
	default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
		<div>
			<button aria-pressed={value === "yearly"} onClick={() => onChange("yearly")}>
				Pay Yearly
			</button>
			<button aria-pressed={value === "monthly"} onClick={() => onChange("monthly")}>
				Pay Monthly
			</button>
		</div>
	),
}));

jest.mock("next-plausible", () => ({ usePlausible: () => jest.fn() }));
jest.mock("@lib/paywallTracking", () => ({ trackPaywallEvent: jest.fn() }));
jest.mock("@heroui/styles", () => ({ buttonVariants: () => "button" }));
jest.mock("@tabler/icons-react", () => ({
	IconCheck: () => <svg />,
	IconHeart: () => <svg />,
	IconInfoCircle: () => <svg />,
	IconMinus: () => <svg />,
}));

jest.mock("@heroui/react", () => {
	const React = require("react") as typeof import("react");
	const Box = ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>;
	const Card = Object.assign(Box, { Header: Box, Title: Box, Description: Box, Content: Box, Footer: Box });
	const Accordion = Object.assign(Box, { Item: Box, Heading: Box, Trigger: Box, Indicator: () => null, Panel: Box, Body: Box });
	const Tooltip = Object.assign(Box, { Trigger: Box, Content: Box, Arrow: () => null });
	const Checkbox = Object.assign(
		({ children, isSelected, isDisabled, onChange, "aria-label": ariaLabel }: { children: ReactNode; isSelected?: boolean; isDisabled?: boolean; onChange?: (selected: boolean) => void; "aria-label"?: string }) => (
			<label>
				<input type='checkbox' aria-label={ariaLabel} checked={isSelected} disabled={isDisabled} onChange={(event) => onChange?.(event.target.checked)} />
				{children}
			</label>
		),
		{ Content: Box, Control: Box, Indicator: () => null },
	);
	const Modal = Object.assign(Box, {
		Backdrop: ({ children, isOpen }: { children: ReactNode; isOpen?: boolean }) => (isOpen ? <div>{children}</div> : null),
		Container: Box,
		Dialog: Box,
		CloseTrigger: () => null,
		Header: Box,
		Heading: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
		Body: Box,
		Footer: Box,
	});
	const Button = React.forwardRef<HTMLButtonElement, { children: ReactNode; onPress?: () => void; isDisabled?: boolean; fullWidth?: boolean; variant?: string; slot?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>(({ children, onPress, isDisabled, fullWidth: _fullWidth, variant: _variant, slot: _slot, ...props }, ref) => (
		<button ref={ref} type='button' disabled={isDisabled} onClick={onPress} {...props}>
			{children}
		</button>
	));
	Button.displayName = "Button";

	return {
		Accordion,
		Button,
		Card,
		Checkbox,
		Chip: Box,
		Link: ({ children, ...props }: { children: ReactNode; href?: string }) => <a {...props}>{children}</a>,
		Modal,
		Separator: () => <hr />,
		Tooltip,
		cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
	};
});

describe("PricingComparison Pro setup", () => {
	const pricing = {
		pro: { monthly: { amount: 2, currency: "EUR", formatted: "2 EUR" }, yearly: { amount: 20, currency: "EUR", formatted: "20 EUR" } },
		runner: { monthly: { amount: 3, currency: "EUR", formatted: "3 EUR" }, yearly: { amount: 30, currency: "EUR", formatted: "30 EUR" } },
	};

	it("keeps paid checkout unavailable when no price has been resolved", () => {
		render(<PricingComparison />);
		for (const action of screen.getAllByRole("button", { name: "Get Pro" })) expect(action).toBeDisabled();
		expect(screen.getByRole("status")).toHaveTextContent("Pro pricing is temporarily unavailable");
	});

	it("includes Runner in Pro setup without rendering a separate purchase option", () => {
		render(<PricingComparison pricing={pricing} />);

		expect(screen.queryByText("Build your plan")).not.toBeInTheDocument();
		fireEvent.click(screen.getAllByRole("button", { name: "Get Pro" })[0]);
		const dialog = screen.getByRole("heading", { name: "Complete your Pro setup" }).parentElement?.parentElement;
		expect(dialog).not.toBeNull();
		const dialogQueries = within(dialog as HTMLElement);
		const products = dialogQueries.getAllByRole("checkbox") as HTMLInputElement[];
		expect(products).toHaveLength(1);
		expect(products[0]).toBeChecked();
		expect(products[0]).toBeDisabled();
		expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Add Runner" })).not.toBeInTheDocument();

		expect(dialogQueries.queryByText("Runner included")).not.toBeInTheDocument();
		const runnerCheckout = dialogQueries.getByRole("link", { name: "Continue to checkout" });
		expect(runnerCheckout).toHaveAttribute("href", expect.stringContaining("plan=pro"));
		expect(runnerCheckout).not.toHaveAttribute("href", expect.stringContaining("runner=true"));
	});
});
