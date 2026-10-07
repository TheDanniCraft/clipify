import React, { createContext, useContext } from "react";
// Semantic controls preserve selection and form behavior in component tests.
const radioContext = createContext<{ value?: string; onChange?: (value: string) => void; name?: string }>({});
const Slot = ({ children, ...props }: any) => <span {...props}>{children}</span>;
const Checkbox = Object.assign(
	({ children, name, value, isSelected, onChange, isDisabled, className }: any) => (
		<label className={className}>
			<input type='checkbox' name={name} value={value} checked={isSelected} disabled={isDisabled} onChange={(event) => onChange?.(event.target.checked)} />
			{children}
		</label>
	),
	{ Content: Slot, Control: Slot, Indicator: () => null },
);
const RadioGroup = ({ children, value, onChange, name, className }: any) => (
	<radioContext.Provider value={{ value, onChange, name }}>
		<div className={className}>{children}</div>
	</radioContext.Provider>
);
const Radio = Object.assign(
	({ children, value, className, "aria-label": ariaLabel }: any) => {
		const group = useContext(radioContext);
		return (
			<label className={className}>
				<input type='radio' aria-label={ariaLabel} name={group.name} value={value} checked={group.value === value} onChange={() => group.onChange?.(value)} />
				{children}
			</label>
		);
	},
	{ Content: Slot, Control: Slot, Indicator: () => null },
);
const Button = ({ children, onPress, isDisabled, isPending, variant: _variant, size: _size, ...props }: any) => (
	<button {...props} disabled={isDisabled || isPending} onClick={onPress}>
		{children}
	</button>
);
const Card = Object.assign(({ children, ...props }: any) => <div {...props}>{children}</div>, { Header: Slot, Title: Slot, Description: Slot, Content: Slot, Footer: Slot });
const Alert = Object.assign(({ children, status: _status, ...props }: any) => <div {...props}>{children}</div>, { Indicator: () => null, Content: Slot, Title: Slot, Description: Slot });
const selectContext = createContext<{ value?: string; onChange?: (value: string) => void }>({});
const Select = Object.assign(
	({ children, value, onChange, "aria-label": ariaLabel }: any) => (
		<selectContext.Provider value={{ value, onChange }}>
			<div role='combobox' aria-expanded={true} aria-controls='fixture-listbox' aria-label={ariaLabel}>
				{children}
			</div>
		</selectContext.Provider>
	),
	{
		Trigger: Slot,
		Value: () => {
			const context = useContext(selectContext);
			return <span>{context.value}</span>;
		},
		Indicator: () => null,
		Popover: Slot,
	},
);
const ListBox = Object.assign(Slot, {
	Item: ({ id, children }: any) => {
		const context = useContext(selectContext);
		return (
			<button role='option' aria-selected={context.value === id} onClick={() => context.onChange?.(String(id))}>
				{children}
			</button>
		);
	},
	ItemIndicator: () => null,
});
export const components = { Select, ListBox, Checkbox, Radio, RadioGroup, Button, Card, Alert, Chip: Slot, Separator: () => <hr />, Spinner: () => <span>Loading…</span>, Description: Slot, Label: Slot };

export const proComponents = { RadioButtonGroup: Object.assign(RadioGroup, { Item: Radio, ItemContent: Slot, ItemIcon: Slot, Indicator: () => null }), EmptyState: Object.assign(Slot, { Header: Slot, Media: Slot, Title: Slot, Description: Slot, Content: Slot }) };
