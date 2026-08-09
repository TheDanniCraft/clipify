/** @jest-environment jsdom */
export {};

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TiersComponent from "@/app/components/Pricing";

jest.mock("next-plausible", () => ({
	usePlausible: () => jest.fn(),
}));

jest.mock("@lib/paywallTracking", () => ({
	trackPaywallEvent: jest.fn(),
}));

jest.mock("@/app/components/Pricing/ProSetupModal", () => ({
	__esModule: true,
	default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Shared Pro setup</div> : null),
}));

jest.mock("@tabler/icons-react", () => ({
	IconArrowRight: () => <svg data-testid='icon-arrow-right' />,
	IconCheck: () => <svg data-testid='icon-check' />,
	IconHeart: () => <svg data-testid='icon-heart' />,
}));

jest.mock("@heroui/react", () => {
	const React = require("react") as typeof import("react");

	function TabsRoot({ children, selectedKey, onSelectionChange }: { children: ReactNode; selectedKey?: string; onSelectionChange?: (key: string) => void }) {
		return (
			<div data-testid='tabs' data-selected-key={selectedKey}>
				{React.Children.map(children, (child) =>
					React.isValidElement(child)
						? React.cloneElement(child, {
								onSelect: onSelectionChange,
							} as Record<string, unknown>)
						: child,
				)}
			</div>
		);
	}

	const passSelection = ({ children, onSelect }: { children: ReactNode; onSelect?: (key: string) => void }) => <div>{React.Children.map(children, (child) => (React.isValidElement(child) ? React.cloneElement(child, { onSelect } as Record<string, unknown>) : child))}</div>;
	const Tabs = Object.assign(TabsRoot, {
		ListContainer: passSelection,
		List: passSelection,
		Tab: ({ children, id, onSelect }: { children: ReactNode; id: string; onSelect?: (key: string) => void }) => (
			<button type='button' onClick={() => onSelect?.(id)}>
				{children}
			</button>
		),
		Indicator: () => null,
	});

	return {
		Button: ({ children, onPress, as: _as, fullWidth: _fullWidth, color: _color, variant: _variant, ...props }: { children: ReactNode; onPress?: () => void; as?: unknown; fullWidth?: boolean; color?: string; variant?: string; [key: string]: unknown }) => (
			<button type='button' onClick={onPress} {...props}>
				{children}
			</button>
		),
		Card: Object.assign(({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>, {
			Header: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
			Content: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
			Footer: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
		}),
		Chip: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
		Separator: () => <hr />,
		Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
		Spacer: () => <div />,
		Tabs,
		cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
	};
});

describe("components/Pricing index", () => {
	const pricing = {
		pro: { monthly: { amount: 2, currency: "EUR", formatted: "2 EUR" }, yearly: { amount: 20, currency: "EUR", formatted: "20 EUR" } },
		runner: { monthly: { amount: 3, currency: "EUR", formatted: "3 EUR" }, yearly: { amount: 30, currency: "EUR", formatted: "30 EUR" } },
	};

	it("shows campaign-configured promo copy on the pro tier", () => {
		render(
			<TiersComponent
				pricing={pricing}
				campaignOffer={{
					id: "offer-1",
					name: "Launch Offer",
					slug: "launch-offer",
					isEnabled: true,
					startAt: "2026-01-01T00:00:00.000Z",
					endAt: null,
					priority: 100,
					showFloatingBanner: true,
					showPricingCard: true,
					showPricingTierPromo: true,
					title: "Launch Offer",
					subtitle: "for 50% OFF your first year.",
					badgeText: "We're launched!",
					ctaLabel: "Register To Claim Offer",
					floatingCtaLabel: "Claim Now",
					ctaHref: "/redeem?code=EARLYCLIPPY",
					offerCode: "EARLYCLIPPY",
					utmCampaign: "launch_offer",
					pricingMonthlyPromo: 1,
					pricingYearlyPromo: 10,
					iconUrl: null,
					updated: null,
				}}
			/>,
		);

		expect(screen.getAllByText("2 months free").length).toBeGreaterThan(0);
		expect(screen.getByText("Limited offer")).toBeInTheDocument();
		expect(screen.getAllByText("Save 2 months with yearly billing").length).toBeGreaterThan(0);
		expect(screen.getByText("10 EUR")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Pay Monthly/i }));
		expect(screen.getByText("1 EUR")).toBeInTheDocument();
	});

	it("falls back to non-promo pricing when there is no active campaign", () => {
		render(<TiersComponent pricing={pricing} />);

		expect(screen.queryByText("Limited offer")).not.toBeInTheDocument();
		expect(screen.getAllByText("2 months free").length).toBeGreaterThan(0);
		expect(screen.getByText("20 EUR")).toBeInTheDocument();
	});

	it("keeps the cards concise and links to the full comparison", () => {
		render(<TiersComponent pricing={pricing} />);

		expect(screen.getByText("One branded website gallery")).toBeInTheDocument();
		expect(screen.queryByText("Append or replace behavior on playlist import")).not.toBeInTheDocument();
		expect(screen.getByText(/directly supports an independent developer/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Compare all features/i })).toHaveAttribute("href", "/pricing");
		expect(screen.queryByRole("link", { name: "Add Runner" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Get Pro" }));
		expect(screen.getByText("Shared Pro setup")).toBeInTheDocument();
	});
});
