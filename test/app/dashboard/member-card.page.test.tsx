/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import MemberCardPage from "@/app/dashboard/member-card/page";
const validateAuth = jest.fn();
const getMemberProfile = jest.fn();
const redirect = jest.fn((..._args: unknown[]) => {
	throw new Error("REDIRECT");
});
const notFound = jest.fn((..._args: unknown[]) => {
	throw new Error("NOT_FOUND");
});
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@lib/membership", () => ({ getMemberProfile: (...args: unknown[]) => getMemberProfile(...args) }));
jest.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirect(...args), notFound: (...args: unknown[]) => notFound(...args) }));
jest.mock("@components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock("@components/membership/MemberCard", () => ({ __esModule: true, default: ({ profile }: { profile: { username: string } }) => <div>{profile.username}</div> }));
jest.mock("@components/membership/MemberCardActions", () => ({ __esModule: true, default: ({ cardId, memberNumber, isOwner }: { cardId: string; memberNumber: number; isOwner: boolean }) => <div data-testid='card-actions' data-card-id={cardId} data-member-number={memberNumber} data-owner={String(isOwner)} /> }));
jest.mock("@components/membership/BadgeGrid", () => ({
	__esModule: true,
	default: ({ badges }: { badges: { name: string }[] }) => (
		<div>
			{badges.map((badge) => (
				<span key={badge.name}>{badge.name}</span>
			))}
		</div>
	),
}));
jest.mock("@components/heroui-client", () => {
	const Box = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	return { CardRoot: Box, CardHeader: Box, CardTitle: Box, CardDescription: Box, CardContent: Box };
});
jest.mock("@tabler/icons-react", () => ({ IconAward: () => <svg /> }));
describe("member card server page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		validateAuth.mockResolvedValue({ id: "current-actor" });
		getMemberProfile.mockResolvedValue({ username: "Current member", cardId: "current-card", memberNumber: 42, badges: [{ name: "Founding member" }] });
	});
	test("redirects anonymous viewers before looking up a profile", async () => {
		validateAuth.mockResolvedValue(null);
		await expect(MemberCardPage()).rejects.toThrow("REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/logout");
		expect(getMemberProfile).not.toHaveBeenCalled();
	});
	test("returns not found when the authenticated actor has no profile", async () => {
		getMemberProfile.mockResolvedValue(null);
		await expect(MemberCardPage()).rejects.toThrow("NOT_FOUND");
		expect(getMemberProfile).toHaveBeenCalledWith("current-actor");
		expect(notFound).toHaveBeenCalledTimes(1);
	});
	test("renders the current member's badges and owner card actions", async () => {
		render(await MemberCardPage());
		expect(getMemberProfile).toHaveBeenCalledWith("current-actor");
		expect(screen.getByText("Current member")).toBeInTheDocument();
		expect(screen.getByText("Founding member")).toBeInTheDocument();
		expect(screen.getByTestId("card-actions")).toHaveAttribute("data-card-id", "current-card");
		expect(screen.getByTestId("card-actions")).toHaveAttribute("data-member-number", "42");
		expect(screen.getByTestId("card-actions")).toHaveAttribute("data-owner", "true");
	});
});
