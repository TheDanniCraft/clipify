import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

	it("opens feedback on demand and removes its form on unmount", async () => {
		const appendToDom = jest.fn();
		const removeFromDom = jest.fn();
		getFeedback.mockReturnValue({
			createForm: async () => ({ appendToDom, removeFromDom, open: jest.fn() }),
		});
		const SentryFeedbackWidget = (await import("@/app/components/SentryFeedbackWidget")).default;

		const { unmount } = render(<SentryFeedbackWidget />);

		expect(appendToDom).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
		await waitFor(() => expect(appendToDom).toHaveBeenCalledTimes(1));
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

it("does not append a feedback form after its page unmounts", async () => {
	pathname = "/dashboard/clips";
	let resolve!: (value: unknown) => void;
	const appendToDom = jest.fn();
	getFeedback.mockReturnValue({
		createForm: () =>
			new Promise((done) => {
				resolve = done;
			}),
	});
	const Component = (await import("@/app/components/SentryFeedbackWidget")).default;
	const view = render(<Component />);
	fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
	view.unmount();
	await act(async () => resolve({ appendToDom, removeFromDom: jest.fn(), open: jest.fn() }));
	expect(appendToDom).not.toHaveBeenCalled();
});
it("offers a local retry when feedback is unavailable", async () => {
	pathname = "/dashboard/clips";
	getFeedback.mockReturnValue(null);
	const Component = (await import("@/app/components/SentryFeedbackWidget")).default;
	render(<Component />);
	fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
	await screen.findByRole("alert");
	const open = jest.fn();
	getFeedback.mockReturnValue({ createForm: async () => ({ appendToDom: jest.fn(), removeFromDom: jest.fn(), open }) });
	fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
	await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
