import { render, screen } from "@testing-library/react";
import OutputStatus from "@/app/components/runnerOutputStatus";

test.each([
	["connecting", "Connecting"],
	["streaming", "Live"],
	["retrying", "Retrying"],
	["failed", "Failed"],
	["stopped", "Stopped"],
] as const)("a destination exposes its reported %s state inline", (state, label) => {
	render(<OutputStatus online name='Twitch' output={{ id: "twitch", state }} />);
	expect(screen.getByRole("status", { name: `Twitch: ${label}` })).toHaveTextContent(label);
	expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

test("offline output reports never claim to be live and missing telemetry stays neutral", () => {
	const { rerender } = render(<OutputStatus online={false} name='Twitch' output={{ id: "twitch", state: "streaming" }} />);
	expect(screen.getByRole("status", { name: "Twitch: Offline" })).toHaveClass("text-muted");
	expect(screen.queryByText("Live")).not.toBeInTheDocument();
	rerender(<OutputStatus online name='Twitch' />);
	expect(screen.getByRole("status", { name: "Twitch: Awaiting status" })).toHaveClass("text-muted");
});
