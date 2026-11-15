/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import PricingPage, { dynamic, metadata } from "@/app/pricing/page";
import { BillingProduct } from "@types";
const getActiveCampaignOffer = jest.fn();
const resolveBillingCatalog = jest.fn();
const comparisonProps = jest.fn();
const readCheckoutIntent = jest.fn();
const recoveryProps = jest.fn();
jest.mock("@/server/checkoutIntent", () => ({ readCheckoutIntent: () => readCheckoutIntent() }));
jest.mock("@components/Pricing/CheckoutRecovery", () => ({
	__esModule: true,
	default: (props: { status: string; canRetry: boolean }) => {
		recoveryProps(props);
		return <aside aria-label='Checkout recovery'>{props.status}</aside>;
	},
}));
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
	beforeEach(() => {
		jest.clearAllMocks();
		getActiveCampaignOffer.mockResolvedValue(null);
		resolveBillingCatalog.mockResolvedValue({ [BillingProduct.Pro]: { monthly: null, yearly: null } });
		readCheckoutIntent.mockResolvedValue(null);
	});
	test.each(["cancelled", "unavailable"] as const)("shows %s recovery with a retry only when the signed selection survives", async (status) => {
		readCheckoutIntent.mockResolvedValueOnce({ product: BillingProduct.Pro });
		const view = render(await PricingPage({ searchParams: Promise.resolve({ checkout: status }) }));
		expect(recoveryProps).toHaveBeenLastCalledWith({ status, canRetry: true });
		expect(screen.getByRole("complementary", { name: "Checkout recovery" })).toHaveTextContent(status);
		expect(screen.getByText("Plan comparison")).toBeInTheDocument();
		view.unmount();
		render(await PricingPage({ searchParams: Promise.resolve({ checkout: status }) }));
		expect(recoveryProps).toHaveBeenLastCalledWith({ status, canRetry: false });
		expect(readCheckoutIntent).toHaveBeenCalledTimes(2);
	});
	test.each([{}, { checkout: "success" }, { checkout: ["cancelled", "unavailable"] }])("ignores unrecognized checkout parameters %j", async (parameters) => {
		render(await PricingPage({ searchParams: Promise.resolve(parameters) }));
		expect(readCheckoutIntent).not.toHaveBeenCalled();
		expect(recoveryProps).not.toHaveBeenCalled();
		expect(screen.queryByRole("complementary", { name: "Checkout recovery" })).not.toBeInTheDocument();
		expect(screen.getByText("Plan comparison")).toBeInTheDocument();
	});
	test("passes current billing prices and campaign to comparison and renders all FAQ content", async () => {
		const campaign = { title: "Current offer" };
		const proMonthly = { amount: 4, currency: "EUR", formatted: "4 EUR" };
		const proYearly = { amount: 40, currency: "EUR", formatted: "40 EUR" };
		getActiveCampaignOffer.mockResolvedValue(campaign);
		resolveBillingCatalog.mockResolvedValue({ [BillingProduct.Pro]: { monthly: proMonthly, yearly: proYearly } });
		render(await PricingPage());
		expect(comparisonProps).toHaveBeenCalledWith({ campaignOffer: campaign, pricing: { pro: { monthly: proMonthly, yearly: proYearly } } });
		expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Pricing questions" })).toBeInTheDocument();
		for (const question of ["Can I use Clipify for free?", "Can I try Pro without a card?", "Do I need to keep my computer running?", "Can I switch between monthly and yearly billing?", "What happens if I stop using Pro?"]) expect(screen.getByRole("button", { name: question })).toBeInTheDocument();
		expect(screen.getByText(/Free includes unlimited Twitch clips/)).toBeInTheDocument();
		expect(screen.getByText(/computer running it must also stay on and connected/)).toBeInTheDocument();
		expect(screen.getByText(/Annual plans are billed once per year/)).toBeInTheDocument();
		expect(screen.getByText(/Returning creators do not receive another/)).toBeInTheDocument();
		expect(screen.queryByText(/two months free/)).not.toBeInTheDocument();
		expect(screen.getByText(/saved settings and content are kept/)).toBeInTheDocument();
		expect(screen.getByText("Clipify footer")).toBeInTheDocument();
	});
	test("propagates unavailable billing lookup instead of inventing a payable price", async () => {
		getActiveCampaignOffer.mockResolvedValue(null);
		resolveBillingCatalog.mockRejectedValue(new Error("BILLING_UNAVAILABLE"));
		await expect(PricingPage()).rejects.toThrow("BILLING_UNAVAILABLE");
		expect(comparisonProps).not.toHaveBeenCalled();
	});
});
