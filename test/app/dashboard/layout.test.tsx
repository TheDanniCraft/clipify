import React from "react";
import { render, screen } from "@testing-library/react";

const validateAuth = jest.fn();
const getPendingDashboardContent = jest.fn();

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
		expect(getPendingDashboardContent).toHaveBeenCalledWith(user);
	});
});
