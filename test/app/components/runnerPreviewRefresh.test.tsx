import { act, render, screen } from "@testing-library/react";
import Refresh from "@/app/components/runnerPreviewRefresh";

test("snapshot countdown reaches refreshing, resets only after a response, and cleans up its timer", () => {
	jest.useFakeTimers();
	jest.setSystemTime(10000);
	try {
		const view = render(<Refresh refreshedAt={10000} />);
		const timer = screen.getByRole("timer", { name: "Snapshot refresh" });
		expect(timer).toHaveTextContent("Refresh in 2s");
		act(() => jest.advanceTimersByTime(1000));
		expect(timer).toHaveTextContent("Refresh in 1s");
		act(() => jest.advanceTimersByTime(5000));
		expect(timer).toHaveTextContent("Refreshing…");
		view.rerender(<Refresh refreshedAt={Date.now()} />);
		expect(timer).toHaveTextContent("Refresh in 2s");
		expect(timer).toHaveAttribute("aria-live", "off");
		view.unmount();
		expect(jest.getTimerCount()).toBe(0);
	} finally {
		jest.useRealTimers();
	}
});
