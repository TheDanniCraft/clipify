import React from "react";
import { render, screen } from "@testing-library/react";
import { Plan } from "@/app/lib/types";

const validateAuth = jest.fn();
const redirect = jest.fn();
const getOverlayWithEditAccess = jest.fn();
const getOverlayOwnerPlanPublic = jest.fn();
const jwtSign = jest.fn();

jest.mock("next/navigation", () => ({
	redirect: (...args: unknown[]) => redirect(...args),
}));

jest.mock("jsonwebtoken", () => ({
	sign: (...args: unknown[]) => jwtSign(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/database", () => ({
	getOverlayWithEditAccess: (...args: unknown[]) => getOverlayWithEditAccess(...args),
	getOverlayOwnerPlanPublic: (...args: unknown[]) => getOverlayOwnerPlanPublic(...args),
}));

jest.mock("@/app/controller/[overlayId]/controllerClient", () => ({
	__esModule: true,
	default: ({ overlayId, controllerToken }: { overlayId: string; controllerToken: string }) => <div>{`controller-client:${overlayId}:${controllerToken}`}</div>,
}));

describe("app/controller/[overlayId]/page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
		validateAuth.mockResolvedValue({ id: "user-1" });
		getOverlayWithEditAccess.mockResolvedValue({ id: "ov-1", ownerId: "owner-1" });
		getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Pro);
		jwtSign.mockReturnValue("signed-controller-token");
	});

	it("redirects unauthenticated users to login with a controller return url", async () => {
		validateAuth.mockResolvedValue(false);
		const Page = (await import("@/app/controller/[overlayId]/page")).default;

		await expect(Page({ params: Promise.resolve({ overlayId: "ov-1" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/login?returnUrl=%2Fcontroller%2Fov-1");
	});

	it("renders access denied when the user cannot edit the overlay", async () => {
		getOverlayWithEditAccess.mockResolvedValue(null);
		const Page = (await import("@/app/controller/[overlayId]/page")).default;

		render(await Page({ params: Promise.resolve({ overlayId: "ov-1" }), searchParams: Promise.resolve({}) }));

		expect(screen.getByText("Access denied")).toBeInTheDocument();
		expect(screen.getByText(/Only the streamer or editors/)).toBeInTheDocument();
	});

	it("renders the pro gate for non-pro owners", async () => {
		getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Free);
		const Page = (await import("@/app/controller/[overlayId]/page")).default;

		render(await Page({ params: Promise.resolve({ overlayId: "ov-1" }), searchParams: Promise.resolve({}) }));

		expect(screen.getByText("This feature is Pro only")).toBeInTheDocument();
		expect(screen.getByText("Upgrade now")).toBeInTheDocument();
	});

	it("renders controller client with a signed token for authorized users", async () => {
		const Page = (await import("@/app/controller/[overlayId]/page")).default;

		render(await Page({ params: Promise.resolve({ overlayId: "ov-1" }), searchParams: Promise.resolve({}) }));

		expect(jwtSign).toHaveBeenCalledWith(
			{ overlayId: "ov-1", userId: "user-1" },
			process.env.JWT_SECRET,
			expect.objectContaining({ issuer: "clipify-controller", expiresIn: "12h" }),
		);
		expect(screen.getByText("controller-client:ov-1:signed-controller-token")).toBeInTheDocument();
	});
});
