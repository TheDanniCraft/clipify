import { render, screen, waitFor } from "@testing-library/react";
import UmamiRuntime from "@/app/UmamiRuntime";

jest.mock("@/app/UmamiClient", () => ({ __esModule: true, default: ({ websiteId }: { websiteId: string }) => <div data-testid='collector'>{websiteId}</div> }));

it("loads the runtime site once without holding up page rendering", async () => {
	global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ websiteId: "sandbox-site" }) });
	const view = render(<UmamiRuntime />);
	await waitFor(() => expect(screen.getByTestId("collector")).toHaveTextContent("sandbox-site"));
	view.rerender(<UmamiRuntime />);
	expect(global.fetch).toHaveBeenCalledTimes(1);
	expect(global.fetch).toHaveBeenCalledWith("/api/analytics/config", expect.objectContaining({ cache: "no-store" }));
});

it.each(["missing", "invalid", "http", "network"])("leaves tracking disabled for %s configuration", async (failure) => {
	global.fetch = failure === "network" ? jest.fn().mockRejectedValue(new Error("offline")) : jest.fn().mockResolvedValue({ ok: failure !== "http", json: async () => ({ websiteId: failure === "invalid" ? 123 : "" }) });
	render(<UmamiRuntime />);
	await waitFor(() => expect(global.fetch).toHaveBeenCalled());
	expect(screen.queryByTestId("collector")).not.toBeInTheDocument();
});

it("does not initialize a collector after its page has unmounted", async () => {
	let finish!: (result: unknown) => void;
	global.fetch = jest.fn().mockReturnValue(
		new Promise((resolve) => {
			finish = resolve;
		}),
	);
	const view = render(<UmamiRuntime />);
	const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
	view.unmount();
	finish({ ok: true, json: async () => ({ websiteId: "sandbox-site" }) });
	await Promise.resolve();
	expect(signal.aborted).toBe(true);
});
