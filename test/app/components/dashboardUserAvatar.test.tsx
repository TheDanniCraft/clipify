import { act, render, screen, waitFor } from "@testing-library/react";
import DashboardUserAvatar from "@components/dashboardUserAvatar";
const presence = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
	presence.mockReset().mockResolvedValue({ ok: true, json: async () => ({ live: false }) });
	globalThis.fetch = presence;
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});
it("shows signed-in presence without a purple status border", () => {
	render(<DashboardUserAvatar username='Creator' avatar='/avatar.png' showStatus />);
	const status = screen.getByRole("status", { name: "Signed in" });
	expect(status).toHaveClass("bg-success");
	expect(status).not.toHaveClass("ring-accent");
});
it("shows red only for confirmed Twitch streaming", async () => {
	presence.mockResolvedValue({ ok: true, json: async () => ({ live: true }) });
	render(<DashboardUserAvatar username='Creator' avatar='/avatar.png' showStatus />);
	await waitFor(() => expect(screen.getByRole("status", { name: "Streaming on Twitch" })).toHaveClass("bg-danger"));
});
it("does not fetch presence for ordinary profile images", () => {
	render(<DashboardUserAvatar username='Creator' avatar='/avatar.png' />);
	expect(presence).not.toHaveBeenCalled();
	expect(screen.queryByRole("status")).toBeNull();
});

it("uses a private GET instead of a rerendering server action", async () => {
	render(<DashboardUserAvatar username='Creator' avatar='/avatar.png' showStatus />);
	await waitFor(() => expect(presence).toHaveBeenCalledWith("/api/dashboard/presence", { cache: "no-store" }));
});
it.each(["http", "network"])("keeps a quiet signed-in indicator after %s presence failure", async (mode) => {
	if (mode === "http") presence.mockResolvedValue({ ok: false });
	else presence.mockRejectedValue(new Error("offline"));
	render(<DashboardUserAvatar username='Creator' avatar='/avatar.png' showStatus />);
	await waitFor(() => expect(presence).toHaveBeenCalledTimes(1));
	expect(screen.getByRole("status", { name: "Signed in" })).toHaveClass("bg-success");
});
it("updates the indicator when a later presence poll confirms a stream", async () => {
	jest.useFakeTimers();
	presence.mockResolvedValueOnce({ ok: true, json: async () => ({ live: false }) }).mockResolvedValue({ ok: true, json: async () => ({ live: true }) });
	const view = render(<DashboardUserAvatar username='Creator' avatar='/avatar.png' showStatus />);
	try {
		await act(async () => {
			await Promise.resolve();
		});
		await act(async () => {
			jest.advanceTimersByTime(30000);
		});
		expect(screen.getByRole("status", { name: "Streaming on Twitch" })).toHaveClass("bg-danger");
	} finally {
		view.unmount();
		jest.useRealTimers();
	}
});
