import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConsentManager from "@/app/components/ConsentManager";

const mockPerformBannerAction = jest.fn();
const mockOpenBanner = jest.fn();
const mockOpenDialog = jest.fn();
const mockReloadAfterConsentSave = jest.fn();

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));

jest.mock("c15t/next", () => ({
	ConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	ConsentDraftProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	useConsent: () => false,
	useConsents: () => ({ necessary: true, functionality: false, measurement: false }),
	useExplicitChoice: () => null,
	useConsentDraft: () => ({ values: {}, set: jest.fn(), displayedCategories: ["necessary", "functionality", "measurement"] }),
}));

jest.mock("c15t/react", () => ({ hosted: () => ({ kind: "hosted" }) }));

jest.mock("c15t/next/headless", () => ({
	useHeadlessConsentUI: () => ({
		banner: { isVisible: true },
		dialog: { isVisible: false },
		openBanner: mockOpenBanner,
		openDialog: mockOpenDialog,
		closeUI: jest.fn(),
		performBannerAction: mockPerformBannerAction,
		performDialogAction: jest.fn(),
		saveCustomPreferences: jest.fn(),
	}),
}));

jest.mock("@/app/lib/consent/reload", () => ({ reloadAfterConsentSave: (...args: unknown[]) => mockReloadAfterConsentSave(...args) }));
jest.mock("@/app/lib/sentryReplayConsent", () => ({ applySentryReplayConsent: jest.fn() }));
jest.mock("@/app/lib/consent/browserMeasurement", () => ({ hadMeasurementConsentAtPageLoad: () => false, setBrowserMeasurementConsent: jest.fn() }));
jest.mock("@sentry/nextjs", () => ({ getClient: () => undefined, startBrowserTracingPageLoadSpan: jest.fn() }));

describe("components/ConsentManager", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPerformBannerAction.mockRejectedValue(new Error("consent backend unavailable"));
	});

	it("keeps the banner open and surfaces a retryable error when saving fails", async () => {
		render(
			<ConsentManager>
				<div>Application</div>
			</ConsentManager>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Accept all" }));

		expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your privacy choices. Please try again.");
		await waitFor(() => expect(mockOpenBanner).toHaveBeenCalledWith());
		expect(screen.getByRole("button", { name: "Accept all" })).toBeEnabled();
		expect(mockReloadAfterConsentSave).not.toHaveBeenCalled();
	});
});
