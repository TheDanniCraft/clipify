import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
const Controls = existsSync(join(process.cwd(), "src/app/components/runnerBroadcastControls.tsx")) ? require("@/app/components/runnerBroadcastControls").default : () => null;

test.each([true, false])("TDD-US1-FR004 dashboard distinguishes requested Stop from output closure (clip=%s)", (clipPlayback) => {
	const onStart = jest.fn(),
		onStop = jest.fn();
	const props = { onStart, onStop, canStart: true, requiresConnection: true, clipPlayback, desiredState: "running", actualState: "running" };
	const { rerender } = render(<Controls {...props} />);
	expect(screen.getByText(/Keep Runner connected to the internet/)).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
	expect(screen.queryByRole("button", { name: "Stop now" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Stop" }));
	expect(onStop).toHaveBeenCalledWith("graceful");
	rerender(<Controls {...props} desiredState='stopped' />);
	expect(screen.getByRole("status")).toHaveTextContent(clipPlayback ? "Finishing current clip" : "Stopping broadcast");
	expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
	expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Stop now" }));
	expect(onStop).toHaveBeenLastCalledWith("immediate");
	rerender(<Controls {...props} desiredState='stopped' actualState='stopped' />);
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Stop now" })).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
	rerender(<Controls {...props} requiresConnection={false} desiredState='stopped' actualState='stopped' />);
	expect(screen.queryByText(/Keep Runner connected to the internet/)).not.toBeInTheDocument();
});

test("TDD-US3-EC009: closed playback timeout explains the watchdog without exposing native error text", () => {
	render(<Controls desiredState='stopped' actualState='stopped' canStart={true} clipPlayback={true} playbackTimedOut={true} onStart={jest.fn()} onStop={jest.fn()} />);
	expect(screen.getByRole("alert")).toHaveTextContent("Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit.");
	expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
	expect(screen.queryByRole("button", { name: "Stop now" })).not.toBeInTheDocument();
});
