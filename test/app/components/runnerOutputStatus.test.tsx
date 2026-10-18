import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
const OutputStatus = existsSync(join(process.cwd(), "src/app/components/runnerOutputStatus.tsx")) ? require("@/app/components/runnerOutputStatus").default : () => null;

test("TDD-US2-FR008: each named destination exposes its own live or retrying status", () => {
	render(
		<OutputStatus
			online
			outputs={[
				{ id: "youtube", state: "retrying" },
				{ id: "twitch", state: "streaming" },
			]}
			destinations={[
				{ id: "youtube", name: "My YouTube" },
				{ id: "twitch", name: "My Twitch" },
			]}
		/>,
	);
	const list = screen.getByRole("list", { name: "Destination status" });
	expect(within(list).getByText("My YouTube")).toBeInTheDocument();
	expect(within(list).getByText("Retrying")).toBeInTheDocument();
	expect(within(list).getByText("My Twitch")).toBeInTheDocument();
	expect(within(list).getByText("Live")).toBeInTheDocument();
	expect(screen.getByText(/other destinations keep streaming/i)).toBeInTheDocument();
});

test("TDD-US2-EC005: exhausted destinations show actionable failure without claiming another output is live", () => {
	render(<OutputStatus online outputs={[{ id: "youtube", state: "failed" }]} destinations={[{ id: "youtube", name: "My YouTube" }]} />);
	expect(screen.getByText("Failed")).toBeInTheDocument();
	expect(screen.getByText(/check.*destination settings.*stop and start/i)).toBeInTheDocument();
	expect(screen.queryByText(/other destinations keep streaming/i)).not.toBeInTheDocument();
});

test("TDD-US2-FR008: offline reports are historical and a fresh connection does not claim streaming", () => {
	const { rerender } = render(
		<OutputStatus
			online={false}
			outputs={[
				{ id: "retained", state: "streaming" },
				{ id: "retry", state: "retrying" },
			]}
			destinations={[]}
		/>,
	);
	expect(screen.getByText(/Runner offline.*last reported status/)).toBeInTheDocument();
	expect(screen.getByText("Destination retained")).toBeInTheDocument();
	expect(screen.queryByText(/other destinations keep streaming/)).not.toBeInTheDocument();
	rerender(<OutputStatus online outputs={[{ id: "new", state: "connecting" }]} destinations={[{ id: "new", name: "New destination" }]} />);
	expect(screen.getByText("Connecting")).toBeInTheDocument();
	expect(screen.queryByText("Live")).not.toBeInTheDocument();
});

test("TDD-US2-FR008: a missing initial report remains waiting instead of displaying a stale success", () => {
	render(<OutputStatus online destinations={[]} />);
	expect(screen.getByText(/Waiting for the Runner to report destination status/)).toBeInTheDocument();
	expect(screen.queryByText("Live")).not.toBeInTheDocument();
	expect(screen.queryByText("Failed")).not.toBeInTheDocument();
});
