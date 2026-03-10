/** @jest-environment jsdom */
export {};

import { render, screen } from "@testing-library/react";

const getOverlayPublic = jest.fn();
const getOverlayOwnerPlanPublic = jest.fn();
const getOverlayBySecret = jest.fn();
const touchOverlay = jest.fn();

jest.mock("@actions/database", () => ({
	getOverlayPublic: (...args: unknown[]) => getOverlayPublic(...args),
	getOverlayOwnerPlanPublic: (...args: unknown[]) => getOverlayOwnerPlanPublic(...args),
	getOverlayBySecret: (...args: unknown[]) => getOverlayBySecret(...args),
	touchOverlay: (...args: unknown[]) => touchOverlay(...args),
}));

jest.mock("@components/overlayPlayer", () => {
	const OverlayPlayer = () => <div data-testid='overlay-player'>player</div>;
	return {
		__esModule: true,
		default: OverlayPlayer,
	};
});

describe("overlay disabled account UX", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows disabled account message on embed route", async () => {
		getOverlayPublic.mockResolvedValue({
			id: "overlay-1",
			ownerId: "owner-1",
			status: "active",
			ownerDisabled: true,
		});

		const pageModule = await import("@/app/embed/[overlayId]/page");
		const Page = pageModule.default;
		const ui = await Page({
			params: Promise.resolve({ overlayId: "overlay-1" }),
			searchParams: Promise.resolve({}),
		});
		render(ui);

		expect(screen.getByText("Your account has been disabled. Please contact support.")).toBeInTheDocument();
	});

	it("shows disabled account message on secret overlay route", async () => {
		getOverlayBySecret.mockResolvedValue(null);
		getOverlayPublic.mockResolvedValue({
			id: "overlay-1",
			ownerId: "owner-1",
			status: "active",
			ownerDisabled: true,
		});

		const pageModule = await import("@/app/overlay/[overlayId]/page");
		const Page = pageModule.default;
		const ui = await Page({
			params: Promise.resolve({ overlayId: "overlay-1" }),
			searchParams: Promise.resolve({ secret: "abc" }),
		});
		render(ui);

		expect(screen.getByText("Your account has been disabled. Please contact support.")).toBeInTheDocument();
		expect(touchOverlay).not.toHaveBeenCalled();
	});
});
