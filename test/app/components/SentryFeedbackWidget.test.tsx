jest.mock("@components/dashboardUtilityPortal", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const notify = jest.fn();
beforeEach(() => notify.mockReset());
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
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
			setTheme: jest.fn(),
			createForm: async () => ({ el: document.createElement("div"), appendToDom, removeFromDom, open: jest.fn() }),
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
		setTheme: jest.fn(),
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
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
	const open = jest.fn();
	getFeedback.mockReturnValue({ setTheme: jest.fn(), createForm: async () => ({ el: document.createElement("div"), appendToDom: jest.fn(), removeFromDom: jest.fn(), open }) });
	fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
	await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("reports service failures without inserting an error into the sidebar", async () => {
	pathname = "/dashboard/clips";
	getFeedback.mockReturnValue(null);
	const Component = (await import("@/app/components/SentryFeedbackWidget")).default;
	render(<Component />);
	fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
	expect(screen.queryByRole("alert")).toBeNull();
});
it("matches the dashboard theme and names the real feedback dialog", async () => {
	pathname = "/dashboard/clips";
	const el = document.createElement("div");
	el.innerHTML = '<div role="dialog"><h2>Report a problem</h2></div>';
	const setTheme = jest.fn();
	getFeedback.mockReturnValue({ setTheme, createForm: async () => ({ el, appendToDom: () => document.body.append(el), open: jest.fn(), removeFromDom: () => el.remove() }) });
	document.documentElement.classList.add("dark");
	try {
		const Component = (await import("@/app/components/SentryFeedbackWidget")).default;
		render(<Component />);
		fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
		await waitFor(() => expect(setTheme).toHaveBeenCalledWith("dark"));
		expect(screen.getByRole("dialog", { name: "Report a problem" })).toBeVisible();
	} finally {
		document.documentElement.classList.remove("dark");
	}
});

it("keeps admin feedback in the shared sidebar instead of creating a floating widget", async () => {
	pathname = "/admin/agencies";
	const createWidget = jest.fn();
	getFeedback.mockReturnValue({ createWidget });
	const Widget = (await import("@/app/components/SentryFeedbackWidget")).default;
	render(<Widget />);
	expect(screen.getByRole("button", { name: "Report a problem" })).toBeVisible();
	expect(createWidget).not.toHaveBeenCalled();
});
