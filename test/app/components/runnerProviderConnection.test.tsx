import { render, screen, fireEvent } from "@testing-library/react";
import { connectRunnerStreamingProvider, getRunnerStreamingConnections, listRunnerDestinations, startRunnerConnectionTest } from "@/app/actions/runner";
import RunnerDestinations from "@/app/components/runnerDestinations";
jest.mock("@/app/actions/runner", () => ({
	listRunnerDestinations: jest.fn(async () => ({ success: true, destinations: [] })),
	getRunnerStreamingConnections: jest.fn(async () => ({ success: true, connections: [] })),
	connectRunnerStreamingProvider: jest.fn(async () => ({ success: false, error: "Account connection is not available yet. You can enter a stream key instead.", code: "INVALID_INPUT" })),
	getRunnerYoutubeStreams: jest.fn(),
	startRunnerConnectionTest: jest.fn(),
	readRunnerConnectionTest: jest.fn(),
	stopRunnerConnectionTest: jest.fn(),
	saveRunnerDestination: jest.fn(),
	deleteRunnerDestination: jest.fn(),
}));
test("PC-5 cancelling a failed connection test clears its error from the destination editor", async () => {
	jest.mocked(listRunnerDestinations).mockResolvedValueOnce({
		success: true,
		destinations: [{ id: "22222222-2222-4222-8222-222222222222", name: "Main Twitch", provider: "twitch", host: "live.twitch.tv", connectionId: "33333333-3333-4333-8333-333333333333", providerStreamId: null, credentialConfigured: true, credentialActions: ["keep", "replace", "clear"], credentialRevision: 1, configurationRevision: 1 }],
	});
	jest.mocked(getRunnerStreamingConnections).mockResolvedValueOnce({ success: true, connections: [{ id: "33333333-3333-4333-8333-333333333333", provider: "twitch", channelName: "dannicraft" }] });
	jest.mocked(startRunnerConnectionTest).mockResolvedValueOnce({ success: false, error: "Stop your broadcasts before testing this connection.", code: "INVALID_INPUT" });
	render(<RunnerDestinations ownerId='owner' runnerId='11111111-1111-4111-8111-111111111111' />);
	fireEvent.click(await screen.findByRole("button", { name: "Edit Main Twitch" }));
	fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
	fireEvent.click(screen.getByRole("button", { name: "Start test" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Stop your broadcasts");
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(await screen.findByRole("button", { name: "Save destination" })).toBeVisible();
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
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
