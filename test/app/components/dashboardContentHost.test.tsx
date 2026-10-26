import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardContentHost from "@components/dashboardContentHost";
import type { DashboardContentItem } from "@lib/dashboardContent";
const dismiss = jest.fn();
jest.mock("@actions/contentStates", () => ({ dismissDashboardContent: (...args: unknown[]) => dismiss(...args) }));
const welcome: DashboardContentItem = { key: "new-account-pro-trial", title: "Welcome", headline: "Happy to have you on board!", intro: "Welcome to Clipify", highlight: { title: "7 days of Pro, on us.", text: "No credit card needed." }, image: { src: "/clippy/Clippy.svg", alt: "Clippy" }, actionLabel: "Got it" };
beforeEach(() => {
	jest.clearAllMocks();
	dismiss.mockResolvedValue({ ok: true });
});
it("combines the trial message with the tour and starts only after successful dismissal", async () => {
	const start = jest.fn();
	render(<DashboardContentHost items={[welcome]} onStartGuide={start} />);
	expect(screen.getByText("7 days of Pro, on us.")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Start guided tour" }));
	await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
	expect(dismiss).toHaveBeenCalledWith(welcome.key);
	expect(screen.queryByRole("button", { name: "Start guided tour" })).not.toBeInTheDocument();
});
it("keeps welcome visible when its account dismissal fails", async () => {
	dismiss.mockResolvedValue({ ok: false });
	const start = jest.fn();
	render(<DashboardContentHost items={[welcome]} onStartGuide={start} />);
	fireEvent.click(screen.getByRole("button", { name: "Start guided tour" }));
	await waitFor(() => expect(dismiss).toHaveBeenCalled());
	expect(start).not.toHaveBeenCalled();
	expect(screen.getByRole("button", { name: "Start guided tour" })).toBeVisible();
});
it("lets the user defer the generic welcome through the guide account preference", async () => {
	const later = jest.fn(),
		start = jest.fn();
	render(<DashboardContentHost items={[{ ...welcome, key: "guided-welcome" }]} onStartGuide={start} onDismissGuide={later} />);
	fireEvent.click(screen.getByRole("button", { name: "Maybe later" }));
	await waitFor(() => expect(later).toHaveBeenCalledTimes(1));
	expect(start).not.toHaveBeenCalled();
	expect(dismiss).not.toHaveBeenCalled();
});
