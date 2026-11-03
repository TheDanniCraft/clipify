import React from "react";
import { render, screen } from "@testing-library/react";

const redirect = jest.fn();
const validateAuth = jest.fn();
const getAccessTokenResult = jest.fn();
const getActiveCampaignOffer = jest.fn();

jest.mock("next/navigation", () => ({
	redirect: (...args: unknown[]) => redirect(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/database", () => ({
	getAccessTokenResult: (...args: unknown[]) => getAccessTokenResult(...args),
}));

jest.mock("@lib/campaignOffers", () => ({
	getActiveCampaignOffer: (...args: unknown[]) => getActiveCampaignOffer(...args),
}));

jest.mock("@components/OverlayTable", () => ({
	__esModule: true,
	default: ({ userId }: { userId: string }) => <div>{`overlay-table:${userId}`}</div>,
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

jest.mock("@components/creator/creatorOverview", () => ({ __esModule: true, default: ({ creatorId }: { creatorId: string }) => <div>{`creator-overview:${creatorId}`}</div> }));
describe("app/dashboard/page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
	});
	it.each(["user", "admin"] as const)("renders cached creator metrics for a %s without requiring a fresh provider token", async (role) => {
		validateAuth.mockResolvedValue(makeUser(role, "owner"));
		const DashboardPage = (await import("@/app/dashboard/page")).default;
		render(await DashboardPage());
		expect(screen.getByText("creator-overview:owner")).toBeInTheDocument();
		expect(screen.getByText("chatwoot:owner")).toBeInTheDocument();
		expect(screen.getByText("dashboard-navbar:owner")).toBeInTheDocument();
		expect(getAccessTokenResult).not.toHaveBeenCalled();
		expect(redirect).not.toHaveBeenCalled();
	});
	it("redirects an unauthenticated visitor", async () => {
		validateAuth.mockResolvedValue(false);
		const DashboardPage = (await import("@/app/dashboard/page")).default;
		await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/logout");
	});
});

it.each([
	["overlays", "/dashboard/overlays"],
	["playlists", "/dashboard/playlists"],
	["galleries", "/dashboard/galleries"],
	["runners", "/dashboard/runners"],
])("preserves a bookmarked %s dashboard tab", async (tab, target) => {
	validateAuth.mockResolvedValue(makeUser("user", "owner"));
	const Page = (await import("@/app/dashboard/page")).default;
	await expect(Page({ searchParams: Promise.resolve({ tab }) })).rejects.toThrow("NEXT_REDIRECT");
	expect(redirect).toHaveBeenCalledWith(target);
});
