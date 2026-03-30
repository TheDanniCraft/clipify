import React from "react";
import { render, screen } from "@testing-library/react";

const redirect = jest.fn();
const validateAuth = jest.fn();
const getAccessTokenResult = jest.fn();

jest.mock("next/navigation", () => ({
	redirect: (...args: unknown[]) => redirect(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/database", () => ({
	getAccessTokenResult: (...args: unknown[]) => getAccessTokenResult(...args),
}));

jest.mock("@components/OverlayTable", () => ({
	__esModule: true,
	default: ({ userId, accessToken }: { userId: string; accessToken: string }) => <div>{`overlay-table:${userId}:${accessToken}`}</div>,
}));

jest.mock("@components/dashboardNavbar", () => ({
	__esModule: true,
	default: ({ children, user }: { children: React.ReactNode; user: { id: string } }) => (
		<div>
			<div>{`dashboard-navbar:${user.id}`}</div>
			{children}
		</div>
	),
}));

jest.mock("@components/feedbackWidget", () => ({
	__esModule: true,
	default: () => <div>feedback-widget</div>,
}));

jest.mock("@components/chatwootData", () => ({
	__esModule: true,
	default: ({ user }: { user: { id: string } }) => <div>{`chatwoot:${user.id}`}</div>,
}));

function makeUser(role: "user" | "admin", id = "user-1") {
	return {
		id,
		username: role === "admin" ? "root" : "alice",
		email: `${id}@example.com`,
		avatar: "",
		role,
		plan: "free",
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe("app/dashboard/page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
		getAccessTokenResult.mockResolvedValue({
			token: {
				id: "user-1",
				accessToken: "access-token",
				refreshToken: "refresh-token",
				expiresAt: new Date(Date.now() + 60_000),
				scope: [],
				tokenType: "bearer",
			},
		});
	});

	it("renders dashboard for a normal user after login", async () => {
		validateAuth.mockResolvedValue(makeUser("user", "user-1"));
		const DashboardPage = (await import("@/app/dashboard/page")).default;

		render(await DashboardPage());

		expect(redirect).not.toHaveBeenCalled();
		expect(getAccessTokenResult).toHaveBeenCalledWith("user-1");
		expect(screen.getByText("dashboard-navbar:user-1")).toBeInTheDocument();
		expect(screen.getByText("overlay-table:user-1:access-token")).toBeInTheDocument();
		expect(screen.getByText("chatwoot:user-1")).toBeInTheDocument();
		expect(screen.getByText("feedback-widget")).toBeInTheDocument();
	});

	it("renders dashboard for an admin user after login", async () => {
		validateAuth.mockResolvedValue(makeUser("admin", "admin-1"));
		getAccessTokenResult.mockResolvedValue({
			token: {
				id: "admin-1",
				accessToken: "admin-token",
				refreshToken: "refresh-token",
				expiresAt: new Date(Date.now() + 60_000),
				scope: [],
				tokenType: "bearer",
			},
		});
		const DashboardPage = (await import("@/app/dashboard/page")).default;

		render(await DashboardPage());

		expect(redirect).not.toHaveBeenCalled();
		expect(getAccessTokenResult).toHaveBeenCalledWith("admin-1");
		expect(screen.getByText("dashboard-navbar:admin-1")).toBeInTheDocument();
		expect(screen.getByText("overlay-table:admin-1:admin-token")).toBeInTheDocument();
		expect(screen.getByText("chatwoot:admin-1")).toBeInTheDocument();
	});

	it("redirects to logout when user is not authenticated", async () => {
		validateAuth.mockResolvedValue(false);
		const DashboardPage = (await import("@/app/dashboard/page")).default;

		await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/logout");
		expect(getAccessTokenResult).not.toHaveBeenCalled();
	});

	it("redirects to logout when token lookup fails", async () => {
		validateAuth.mockResolvedValue(makeUser("user", "user-2"));
		getAccessTokenResult.mockResolvedValue({ token: null, reason: "token_row_missing" });
		const DashboardPage = (await import("@/app/dashboard/page")).default;

		await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
		expect(getAccessTokenResult).toHaveBeenCalledWith("user-2");
		expect(redirect).toHaveBeenCalledWith("/logout");
	});

	it("redirects to logout with accountDisabled when token missing and user is disabled", async () => {
		validateAuth.mockResolvedValue(makeUser("user", "user-3"));
		getAccessTokenResult.mockResolvedValue({ token: null, reason: "user_disabled" });
		const DashboardPage = (await import("@/app/dashboard/page")).default;

		await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
		expect(getAccessTokenResult).toHaveBeenCalledWith("user-3");
		expect(redirect).toHaveBeenCalledWith("/logout?error=accountDisabled");
	});
});
