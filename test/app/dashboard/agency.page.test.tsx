import { render, screen } from "@testing-library/react";
const identity = jest.fn();
const overview = jest.fn();
const redirect = jest.fn(() => {
	throw new Error("NEXT_REDIRECT");
});
jest.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirect(...(args as [])) }));
jest.mock("@/auth/navigation-user", () => ({ getDashboardNavbarUser: () => identity() }));
jest.mock("@/app/actions/agency", () => ({ getAgencyOverviewAction: (...args: unknown[]) => overview(...args) }));
jest.mock("@components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div data-testid='recoverable-navigation'>{children}</div> }));
beforeEach(() => {
	jest.clearAllMocks();
	identity.mockResolvedValue({ id: "member", username: "Member" });
});
it.each(["AGENCY_CONTEXT_REQUIRED", "ACTIVE_AGENCY_MEMBERSHIP_REQUIRED"])("retains account navigation for %s instead of redirecting to Home", async (code) => {
	overview.mockRejectedValue(new Error(code));
	const Page = (await import("@/app/dashboard/agency/page")).default;
	render(await Page({ searchParams: Promise.resolve({}) }));
	expect(screen.getByText("This agency is unavailable")).toBeVisible();
	expect(screen.getByTestId("recoverable-navigation")).toBeVisible();
	expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", "/logout");
	expect(redirect).not.toHaveBeenCalled();
});
it("does not swallow unexpected provider or database failures", async () => {
	overview.mockRejectedValue(new Error("database unavailable"));
	const Page = (await import("@/app/dashboard/agency/page")).default;
	await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("database unavailable");
});
it("sends signed-out visitors to login", async () => {
	identity.mockResolvedValue(null);
	const Page = (await import("@/app/dashboard/agency/page")).default;
	await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
	expect(redirect).toHaveBeenCalledWith("/login?returnUrl=%2Fdashboard%2Fagency");
});
