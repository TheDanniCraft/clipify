const navbarIdentity = jest.fn();
jest.mock("@/auth/navigation-user", () => ({ getDashboardNavbarUser: () => navbarIdentity() }));
jest.mock("@actions/userTour", () => ({ getUserTourProgress: async () => ({ progress: { version: 2, completed: [], skipped: [], active: null, minimized: false }, importLegacy: false }) }));
jest.mock("@components/user-tour/provider", () => ({
	UserTourProvider: ({ children, accountId, dashboardContent }: { children: React.ReactNode; accountId: string; dashboardContent: unknown[] }) => (
		<div data-testid='user-tour' data-account={accountId}>
			{children}
			<span>{`dashboard-content:${dashboardContent.length}`}</span>
		</div>
	),
}));
import React from "react";
import { render, screen } from "@testing-library/react";

const validateAuth = jest.fn();
const getPendingDashboardContent = jest.fn();
const connection = jest.fn();

jest.mock("next/server", () => ({
	connection: (...args: unknown[]) => connection(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@lib/dashboardContent", () => ({
	getPendingDashboardContent: (...args: unknown[]) => getPendingDashboardContent(...args),
}));

jest.mock("@components/dashboardContentHost", () => ({
	__esModule: true,
	default: ({ items }: { items: unknown[] }) => <div>{`dashboard-content:${items.length}`}</div>,
}));

jest.mock("@components/SentryFeedbackWidget", () => ({
	__esModule: true,
	default: () => <div>feedback-widget</div>,
}));

describe("app/dashboard/layout", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		authorize.mockResolvedValue({ allowed: true, accessPath: "owner" });
	});

	it("mounts feedback for every dashboard page", async () => {
		const user = { id: "user-1" };
		validateAuth.mockResolvedValue(user);
		getPendingDashboardContent.mockResolvedValue([{ id: "item-1" }]);
		const DashboardLayout = (await import("@/app/dashboard/layout")).default;

		render(await DashboardLayout({ children: <div>playlist-page</div> }));

		expect(screen.getByText("feedback-widget")).toBeInTheDocument();
		expect(screen.getByText("dashboard-content:1")).toBeInTheDocument();
		expect(screen.getByText("playlist-page")).toBeInTheDocument();
		expect(connection).toHaveBeenCalledTimes(1);
		expect(getPendingDashboardContent).toHaveBeenCalledWith(user);
	});
});

const authorize = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@components/dashboardShell", () => ({
	__esModule: true,
	default: ({ children, creatorId, permissions }: { children: React.ReactNode; creatorId: string; permissions: string[] }) => (
		<div data-testid='shell' data-creator={creatorId} data-permissions={permissions.join(",")}>
			{children}
		</div>
	),
}));
it("filters navigation using each permission for a delegated account", async () => {
	validateAuth.mockResolvedValue({ id: "delegated" });
	getPendingDashboardContent.mockResolvedValue([]);
	authorize.mockImplementation(async ({ permission }: { permission: string }) => ({ allowed: permission === "playlist:read", accessPath: "membership" }));
	const Layout = (await import("@/app/dashboard/layout")).default;
	render(await Layout({ children: <div>Delegated editor</div> }));
	expect(screen.getByTestId("shell")).toHaveAttribute("data-permissions", "playlist:read");
	expect(screen.getByTestId("shell")).toHaveAttribute("data-creator", "delegated");
});
it("keeps unauthenticated content outside the creator shell", async () => {
	validateAuth.mockResolvedValue(false);
	const Layout = (await import("@/app/dashboard/layout")).default;
	render(await Layout({ children: <div>Public content</div> }));
	expect(screen.getByText("Public content")).toBeInTheDocument();
	expect(screen.queryByTestId("shell")).not.toBeInTheDocument();
});

it("retains the sidebar and account switcher for email-only agency members", async () => {
	validateAuth.mockResolvedValue(false);
	navbarIdentity.mockResolvedValue({ id: "agency-member", username: "Agency owner" });
	const Layout = (await import("@/app/dashboard/layout")).default;
	render(await Layout({ children: <p>Agency recovery</p> }));
	expect(screen.getByTestId("shell")).toHaveAttribute("data-creator", "agency-member");
	expect(screen.getByTestId("shell")).toHaveAttribute("data-permissions", "");
	expect(screen.getByText("Agency recovery")).toBeVisible();
});
