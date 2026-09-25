import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CookiePreferencesLink from "@/app/components/legal/CookiePreferencesLink";

const mockOpenDialog = jest.fn();
const mockUseHeadlessConsentUI = jest.fn();

jest.mock("@c15t/nextjs/headless", () => ({
	useHeadlessConsentUI: () => mockUseHeadlessConsentUI(),
}));

describe("components/legal/CookiePreferencesLink", () => {
	let originalUrl: string;

	beforeEach(() => {
		originalUrl = window.location.href;
		jest.clearAllMocks();
		mockUseHeadlessConsentUI.mockReturnValue({ openDialog: mockOpenDialog });
	});

	afterEach(() => {
		window.history.replaceState({}, "", originalUrl);
	});

	it("opens the existing dialog without leaving the legal route", () => {
		window.history.replaceState({}, "", "/legal/cookies");
		render(<CookiePreferencesLink />);

		fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));

		expect(mockOpenDialog).toHaveBeenCalledTimes(1);
		expect(window.location.pathname).toBe("/legal/cookies");
	});

	it("reports an unavailable dialog without saving a choice", () => {
		mockUseHeadlessConsentUI.mockReturnValue({});
		const storedBefore = { ...localStorage };
		render(<CookiePreferencesLink />);

		fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));

		expect(screen.getByRole("status")).toHaveTextContent("Cookie preferences are currently unavailable.");
		expect({ ...localStorage }).toEqual(storedBefore);
	});
});
