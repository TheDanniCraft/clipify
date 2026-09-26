import React from "react";
import { render } from "@testing-library/react";

const getFeedback = jest.fn();
let pathname = "/dashboard/playlists";

jest.mock("@sentry/nextjs", () => ({
	getFeedback: (...args: unknown[]) => getFeedback(...args),
}));

jest.mock("next/navigation", () => ({
	usePathname: () => pathname,
}));

describe("components/SentryFeedbackWidget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		pathname = "/dashboard/playlists";
	});

	it("mounts and removes the Sentry widget on dashboard pages", async () => {
		const appendToDom = jest.fn();
		const removeFromDom = jest.fn();
		getFeedback.mockReturnValue({
			createWidget: () => ({ appendToDom, removeFromDom }),
		});
		const SentryFeedbackWidget = (await import("@/app/components/SentryFeedbackWidget")).default;

		const { unmount } = render(<SentryFeedbackWidget />);

		expect(appendToDom).toHaveBeenCalledTimes(1);
		unmount();
		expect(removeFromDom).toHaveBeenCalledTimes(1);
	});

	it("does not mount the widget on embedded dashboard previews", async () => {
		pathname = "/dashboard/galleries/gallery-1/preview";
		const SentryFeedbackWidget = (await import("@/app/components/SentryFeedbackWidget")).default;

		render(<SentryFeedbackWidget />);

		expect(getFeedback).not.toHaveBeenCalled();
	});
});
