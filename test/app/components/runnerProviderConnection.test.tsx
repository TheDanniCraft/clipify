import { render, screen, fireEvent } from "@testing-library/react";
import { connectRunnerStreamingProvider } from "@/app/actions/runner";
import RunnerDestinations from "@/app/components/runnerDestinations";
jest.mock("@/app/actions/runner", () => ({
	listRunnerDestinations: jest.fn(async () => ({ success: true, destinations: [] })),
	getRunnerStreamingConnections: jest.fn(async () => ({ success: true, connections: [] })),
	connectRunnerStreamingProvider: jest.fn(async () => ({ success: false, error: "Account connection is not available yet. You can enter a stream key instead.", code: "INVALID_INPUT" })),
	getRunnerYoutubeStreams: jest.fn(),
	saveRunnerDestination: jest.fn(),
	deleteRunnerDestination: jest.fn(),
}));
test("PC-1/6 one contextual connection action preserves the draft after a configuration failure", async () => {
	const close = jest.fn();
	const opened = jest.spyOn(window, "open").mockReturnValue({ close, closed: false } as unknown as Window);
	try {
		render(<RunnerDestinations ownerId='owner' runnerId='11111111-1111-4111-8111-111111111111' />);
		fireEvent.click(await screen.findByRole("button", { name: "Add destination" }));
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "Draft channel" } });
		fireEvent.click(await screen.findByRole("button", { name: "Connect Twitch" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("You can enter a stream key instead.");
		expect(screen.getByRole("textbox")).toHaveValue("Draft channel");
		expect(close).toHaveBeenCalledTimes(1);
		expect(connectRunnerStreamingProvider).toHaveBeenCalledWith({ ownerId: "owner", provider: "twitch" });
	} finally {
		opened.mockRestore();
	}
});
