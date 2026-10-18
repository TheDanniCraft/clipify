import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
const Selection = existsSync(join(process.cwd(), "src/app/components/runnerDestinationSelection.tsx")) ? require("@/app/components/runnerDestinationSelection").default : () => null;
const canStart = require("@/app/components/runnerDestinationSelection").canStartWithDestinations ?? (() => undefined);
const destinations = [
	{ id: "youtube", name: "My YouTube", provider: "youtube", host: "youtube.example", credentialConfigured: true },
	{ id: "twitch", name: "My Twitch", provider: "twitch", host: "twitch.example", credentialConfigured: true },
	{ id: "missing", name: "Needs key", provider: "youtube", host: "youtube.example", credentialConfigured: false },
];

test.each([true, false])("TDD-US2-FR006: saved destination selection uses protected metadata and enforces Free single selection (Pro=%s)", (runnerPro) => {
	const onChange = jest.fn();
	const { rerender } = render(<Selection destinations={destinations} selectedIds={[]} runnerPro={runnerPro} onChange={onChange} />);
	fireEvent.click(screen.getByRole("button", { name: /My YouTube/ }));
	expect(onChange).toHaveBeenLastCalledWith(["youtube"]);
	rerender(<Selection destinations={destinations} selectedIds={["youtube"]} runnerPro={runnerPro} onChange={onChange} />);
	expect(screen.getByRole("button", { name: /My YouTube/ })).toHaveAttribute("aria-pressed", "true");
	fireEvent.click(screen.getByRole("button", { name: /My Twitch/ }));
	expect(onChange).toHaveBeenLastCalledWith(runnerPro ? ["youtube", "twitch"] : ["twitch"]);
	fireEvent.click(screen.getByRole("button", { name: /My YouTube/ }));
	expect(onChange).toHaveBeenLastCalledWith([]);
	expect(screen.getByRole("button", { name: /Needs key/ })).toBeDisabled();
	expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("TDD-US2-FR006: a keyless custom destination remains selectable and an empty library explains setup", () => {
	const onChange = jest.fn();
	const { rerender } = render(<Selection destinations={[]} selectedIds={[]} runnerPro={false} onChange={onChange} />);
	expect(screen.getByText(/Add a destination below/)).toBeInTheDocument();
	rerender(<Selection destinations={[{ id: "custom", name: "Local RTMP", provider: "custom", host: "127.0.0.1", credentialConfigured: false }]} selectedIds={[]} runnerPro={false} onChange={onChange} />);
	fireEvent.click(screen.getByRole("button", { name: /Local RTMP/ }));
	expect(onChange).toHaveBeenCalledWith(["custom"]);
});

test("TDD-US2-FR008: a selected destination remains removable after its required key is cleared", () => {
	const onChange = jest.fn();
	render(<Selection destinations={destinations} selectedIds={["missing"]} runnerPro onChange={onChange} />);
	const selected = screen.getByRole("button", { name: /Needs key/ });
	expect(selected).not.toBeDisabled();
	fireEvent.click(selected);
	expect(onChange).toHaveBeenCalledWith([]);
});

test("TDD-US2-FR008: Start requires ready saved targets while custom keyless targets stay usable", () => {
	expect(canStart(destinations, ["missing"])).toBe(false);
	expect(canStart(destinations, [])).toBe(false);
	expect(canStart(destinations, ["deleted"])).toBe(false);
	expect(canStart(destinations, ["youtube", "twitch"])).toBe(true);
	expect(canStart([{ id: "custom", name: "Custom", provider: "custom", host: "localhost", credentialConfigured: false }], ["custom"])).toBe(true);
});
