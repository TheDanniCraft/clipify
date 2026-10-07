/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import PricingPage, { dynamic, metadata } from "@/app/pricing/page";
import { BillingProduct } from "@types";
const getActiveCampaignOffer = jest.fn();
const resolveBillingCatalog = jest.fn();
const comparisonProps = jest.fn();
jest.mock("@lib/campaignOffers", () => ({ getActiveCampaignOffer: () => getActiveCampaignOffer() }));
jest.mock("@/server/billingCatalog", () => ({ resolveBillingCatalog: () => resolveBillingCatalog() }));
jest.mock("@components/LandingPage/basicNavbar", () => ({ __esModule: true, default: () => <nav aria-label='Public navigation' /> }));
jest.mock("@components/footer", () => ({ __esModule: true, default: () => <footer>Clipify footer</footer> }));
jest.mock("@components/Pricing/comparison", () => ({
	__esModule: true,
	default: (props: unknown) => {
		comparisonProps(props);
		return <div>Plan comparison</div>;
	},
}));
jest.mock("@heroui/react", () => {
	const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
	const Trigger = ({ children }: { children?: React.ReactNode }) => <button>{children}</button>;
	return { Accordion: Object.assign(Box, { Item: Box, Heading: Box, Trigger, Indicator: () => null, Panel: Box, Body: Box }) };
});
describe("public pricing server page and FAQ boundary", () => {
	test("keeps current-price rendering dynamic and publishes plan metadata", () => {
		expect(dynamic).toBe("force-dynamic");
		expect(metadata.title).toBe("Pricing | Clipify");
		expect(metadata.description).toMatch(/Free and Pro/);
	});
	beforeEach(() => jest.clearAllMocks());
	test("passes current billing prices and campaign to comparison and renders all FAQ content", async () => {
		const campaign = { title: "Current offer" };
		const proMonthly = { amount: 4, currency: "EUR", formatted: "4 EUR" };
		const proYearly = { amount: 40, currency: "EUR", formatted: "40 EUR" };
		const runnerMonthly = { amount: 2, currency: "EUR", formatted: "2 EUR" };
		const runnerYearly = { amount: 20, currency: "EUR", formatted: "20 EUR" };
		getActiveCampaignOffer.mockResolvedValue(campaign);
		resolveBillingCatalog.mockResolvedValue({ [BillingProduct.Pro]: { monthly: proMonthly, yearly: proYearly }, [BillingProduct.RunnerSelfHosted]: { monthly: runnerMonthly, yearly: runnerYearly } });
		render(await PricingPage());
		expect(comparisonProps).toHaveBeenCalledWith({ campaignOffer: campaign, pricing: { pro: { monthly: proMonthly, yearly: proYearly }, runner: { monthly: runnerMonthly, yearly: runnerYearly } } });
		expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Pricing questions" })).toBeInTheDocument();
		for (const question of ["Can I use Clipify for free?", "Is the Self-hosted Runner a separate plan?", "Can I switch between monthly and yearly billing?", "What happens if I stop using Pro?"]) expect(screen.getByRole("button", { name: question })).toBeInTheDocument();
		expect(screen.getByText(/Free includes unlimited Twitch clips/)).toBeInTheDocument();
		expect(screen.getByText(/Runner is an optional add-on/)).toBeInTheDocument();
		expect(screen.getByText(/two months free/)).toBeInTheDocument();
		expect(screen.getByText(/preserves supported data/)).toBeInTheDocument();
		expect(screen.getByText("Clipify footer")).toBeInTheDocument();
	});
	test("propagates unavailable billing lookup instead of inventing a payable price", async () => {
		getActiveCampaignOffer.mockResolvedValue(null);
		resolveBillingCatalog.mockRejectedValue(new Error("BILLING_UNAVAILABLE"));
		await expect(PricingPage()).rejects.toThrow("BILLING_UNAVAILABLE");
		expect(comparisonProps).not.toHaveBeenCalled();
	});
});
