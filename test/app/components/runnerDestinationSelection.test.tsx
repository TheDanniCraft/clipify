import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("@heroui/react");
	const React = jest.requireActual("react");
	const Context = React.createContext({});
	const Box = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
	const Select = Object.assign(({ children, ...props }: { children: React.ReactNode }) => <Context.Provider value={props}>{children}</Context.Provider>, {
		Trigger: Box,
		Value: ({ children }: { children: (props: unknown) => React.ReactNode }) => {
			const { value } = React.useContext(Context);
			const keys = Array.isArray(value) ? value : value ? [value] : [];
			return children({ isPlaceholder: !keys.length, defaultChildren: "Choose destinations", selectedItems: keys.map((key: string) => ({ key, textValue: key })) });
		},
		ClearButton: () => {
			const { onClear } = React.useContext(Context);
			return <button onClick={onClear}>Clear destinations</button>;
		},
		Indicator: () => null,
		Popover: Box,
	});
	const Item = ({ children, id, isDisabled }: { children: React.ReactNode; id: string; isDisabled?: boolean }) => {
		const { value, onChange, selectionMode } = React.useContext(Context);
		const selected = Array.isArray(value) ? value.includes(id) : value === id;
		return (
			<button disabled={isDisabled} aria-pressed={selected} onClick={() => onChange(selectionMode === "multiple" ? (selected ? value.filter((key: string) => key !== id) : [...value, id]) : selected ? null : id)}>
				{children}
			</button>
		);
	};
	return { ...base, Select, ListBox: Object.assign(Box, { Item, ItemIndicator: () => null }) };
});

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
	expect(screen.getByRole("group", { name: "Broadcast destinations" })).toBeInTheDocument();
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

test("UX-C3: empty destination selection offers creation beside the control", () => {
	const onManage = jest.fn();
	render(<Selection destinations={[]} selectedIds={[]} runnerPro={false} onChange={jest.fn()} onManage={onManage} />);
	fireEvent.click(screen.getByRole("button", { name: "Add destination" }));
	expect(onManage).toHaveBeenCalledTimes(1);
});

test("UX-C9: a downgraded multi-destination draft exposes every retained target and can reduce to one", () => {
	const onChange = jest.fn();
	render(<Selection destinations={destinations} selectedIds={["youtube", "twitch"]} runnerPro={false} onChange={onChange} />);
	expect(screen.getByRole("button", { name: /My YouTube/ })).toHaveAttribute("aria-pressed", "true");
	expect(screen.getByRole("button", { name: /My Twitch/ })).toHaveAttribute("aria-pressed", "true");
	fireEvent.click(screen.getByRole("button", { name: /My YouTube/ }));
	expect(onChange).toHaveBeenLastCalledWith(["twitch"]);
});

test("clearing all selected destinations reports an empty draft and leaves saved targets available", () => {
	const onChange = jest.fn();
	const onManage = jest.fn();
	render(<Selection destinations={destinations} selectedIds={["youtube", "twitch"]} runnerPro onChange={onChange} onManage={onManage} />);
	fireEvent.click(screen.getByRole("button", { name: "Clear destinations" }));
	expect(onChange).toHaveBeenLastCalledWith([]);
	expect(screen.getByRole("button", { name: /My YouTube/ })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Manage destinations" }));
	expect(onManage).toHaveBeenCalledTimes(1);
});

test("live telemetry stays inside the destination selector and offline reports lose live status", () => {
	const props = { destinations, selectedIds: ["youtube", "twitch"], runnerPro: true, onChange: jest.fn() };
	const outputs = [
		{ id: "youtube", state: "streaming" },
		{ id: "twitch", state: "retrying" },
	] as const;
	const { rerender } = render(<Selection {...props} outputs={outputs} online />);
	expect(screen.getAllByRole("status", { name: "My YouTube: Live" })).toHaveLength(2);
	expect(screen.getAllByRole("status", { name: "My Twitch: Retrying" })).toHaveLength(2);
	expect(screen.queryByRole("heading", { name: "Destination status" })).not.toBeInTheDocument();
	expect(screen.queryByText(/Waiting for the Runner to report/)).not.toBeInTheDocument();
	rerender(<Selection {...props} outputs={outputs} online={false} />);
	expect(screen.getAllByRole("status", { name: "My YouTube: Offline" })).toHaveLength(2);
	expect(screen.queryByText("Live")).not.toBeInTheDocument();
	rerender(<Selection {...props} outputs={[]} online />);
	expect(screen.getAllByRole("status", { name: "My Twitch: Awaiting status" })).toHaveLength(2);
});
