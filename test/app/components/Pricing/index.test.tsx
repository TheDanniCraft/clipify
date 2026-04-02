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

jest.mock("@tabler/icons-react", () => ({
	IconCheck: () => <svg data-testid='icon-check' />,
}));

jest.mock("@heroui/react", () => {
	const React = require("react") as typeof import("react");

	function Tabs({ children, selectedKey, onSelectionChange }: { children: ReactNode; selectedKey?: string; onSelectionChange?: (key: string) => void }) {
		return (
			<div data-testid='tabs' data-selected-key={selectedKey}>
				{React.Children.map(children, (child) =>
					React.isValidElement(child)
						? React.cloneElement(child, {
								tabKey: String(child.key ?? ""),
								onSelect: onSelectionChange,
								selectedKey,
							} as Record<string, unknown>)
						: child,
				)}
			</div>
		);
	}

	function Tab({
		children,
		title,
		tabKey,
		onSelect,
		selectedKey,
	}: {
		children?: ReactNode;
		title: ReactNode;
		tabKey?: string;
		onSelect?: (key: string) => void;
		selectedKey?: string;
	}) {
		const safeTabKey = tabKey ?? "";
		return (
			<button type='button' data-selected={selectedKey === safeTabKey} onClick={() => onSelect?.(safeTabKey)}>
				{title}
				{children}
			</button>
		);
	}

	return {
		Button: ({
			children,
			onPress,
			as: _as,
			fullWidth: _fullWidth,
			color: _color,
			variant: _variant,
			...props
		}: {
			children: ReactNode;
			onPress?: () => void;
			as?: unknown;
			fullWidth?: boolean;
			color?: string;
			variant?: string;
			[key: string]: unknown;
		}) => (
			<button type='button' onClick={onPress} {...props}>
				{children}
			</button>
		),
		Card: ({ children, isBlurred: _isBlurred, shadow: _shadow, ...props }: { children: ReactNode; isBlurred?: boolean; shadow?: string; [key: string]: unknown }) => <div {...props}>{children}</div>,
		CardBody: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
		CardFooter: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
		CardHeader: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
		Chip: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
		Divider: () => <hr />,
		Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
		Spacer: () => <div />,
		Tab,
		Tabs,
		cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
	};
});

describe("components/Pricing index", () => {
	it("shows campaign-configured promo copy on the pro tier", () => {
		render(
			<TiersComponent
				campaignOffer={
					{
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
					}
				}
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
		render(<TiersComponent />);

		expect(screen.queryByText("Limited offer")).not.toBeInTheDocument();
		expect(screen.getAllByText("2 months free").length).toBeGreaterThan(0);
		expect(screen.getByText("20 EUR")).toBeInTheDocument();
	});
});
