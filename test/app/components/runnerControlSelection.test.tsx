import { fireEvent, render, screen } from "@testing-library/react";
import RunnerControlSelection from "@/app/components/runnerControlSelection";

jest.mock("@heroui/react", () => {
	const React = jest.requireActual("react");
	const Selection = React.createContext(null);
	const Box = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
	const Select = Object.assign(({ children, onChange }: { children: React.ReactNode; onChange: (id: string) => void }) => <Selection.Provider value={onChange}>{children}</Selection.Provider>, { Trigger: Box, Value: () => null, Indicator: () => null, Popover: Box });
	const Item = Object.assign(({ children, id, isDisabled }: { children: React.ReactNode; id: string; isDisabled?: boolean }) => {
		const onChange = React.useContext(Selection);
		return (
			<button disabled={isDisabled} onClick={() => onChange(id)}>
				{children}
			</button>
		);
	}, {});
	return { Select, Label: Box, ListBox: Object.assign(Box, { Item, ItemIndicator: () => null }) };
});

test("Free scheduling opens upgrade without changing the saved control mode", () => {
	const onChange = jest.fn(),
		onUpgrade = jest.fn();
	render(<RunnerControlSelection value='manual' clipPlayback scheduling={false} onChange={onChange} onUpgrade={onUpgrade} />);
	expect(screen.getByRole("img", { name: "Requires Pro" })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /Scheduled/ }));
	expect(onUpgrade).toHaveBeenCalledTimes(1);
	expect(onChange).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Manual" }));
	expect(onChange).toHaveBeenCalledWith("manual");
});

test("Pro can select scheduling without an upgrade prompt", () => {
	const onChange = jest.fn(),
		onUpgrade = jest.fn();
	render(<RunnerControlSelection value='manual' clipPlayback scheduling onChange={onChange} onUpgrade={onUpgrade} />);
	expect(screen.queryByRole("img", { name: "Requires Pro" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Scheduled" }));
	expect(onChange).toHaveBeenCalledWith("scheduled");
	expect(onUpgrade).not.toHaveBeenCalled();
});

test.each([
	{ clipPlayback: false, scheduling: true },
	{ clipPlayback: true, scheduling: null },
])("unsupported or loading scheduling stays disabled (%j)", (state) => {
	const onChange = jest.fn(),
		onUpgrade = jest.fn();
	render(<RunnerControlSelection value='manual' {...state} onChange={onChange} onUpgrade={onUpgrade} />);
	const scheduled = screen.getByRole("button", { name: /Scheduled/ });
	expect(scheduled).toBeDisabled();
	fireEvent.click(scheduled);
	expect(onChange).not.toHaveBeenCalled();
	expect(onUpgrade).not.toHaveBeenCalled();
});
