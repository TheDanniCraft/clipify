import React from "react";
export function compositionControls(base: any) {
	const nodes = (children: React.ReactNode): React.ReactElement<any>[] => React.Children.toArray(children).flatMap((child) => (React.isValidElement(child) ? [child, ...nodes((child.props as any).children)] : []));
	const label = (children: React.ReactNode) => String(nodes(children).find((child) => typeof child.props.children === "string")?.props.children ?? "Field");
	const TextField = ({ children, value, onChange }: any) => (
		<label>
			{label(children)}
			<input aria-label={label(children)} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
		</label>
	);
	const NumberField = Object.assign(
		({ children, value, onChange }: any) => (
			<label>
				{label(children)}
				<input type='number' aria-label={label(children)} value={value ?? ""} onChange={(event) => onChange(Number(event.target.value))} />
			</label>
		),
		{ Group: base.NumberField.Group, Input: base.NumberField.Input, DecrementButton: base.NumberField.DecrementButton, IncrementButton: base.NumberField.IncrementButton },
	);
	const Select = Object.assign(
		({ children, value, onChange, isDisabled, "aria-label": ariaLabel }: any) => (
			<label>
				{ariaLabel ?? label(children)}
				<select aria-label={ariaLabel ?? label(children)} disabled={isDisabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
					<option value=''>Choose</option>
					{nodes(children)
						.filter((child) => child.props.id)
						.map((child) => (
							<option key={child.props.id} value={child.props.id}>
								{child.props.textValue ?? label(child.props.children)}
							</option>
						))}
				</select>
			</label>
		),
		{ Trigger: base.Select.Trigger, Value: base.Select.Value, Indicator: base.Select.Indicator, Popover: base.Select.Popover },
	);
	const FilterContext = React.createContext<any>({});
	const Autocomplete = Object.assign(
		({ children, value, onChange, selectionMode, "aria-label": name }: any) => (
			<div>
				<select aria-label={name ?? label(children)} multiple={selectionMode === "multiple"} value={value ?? (selectionMode === "multiple" ? [] : "")} onChange={(event) => onChange(selectionMode === "multiple" ? Array.from(event.target.selectedOptions, (o) => o.value) : event.target.value)}>
					{selectionMode !== "multiple" ? <option value=''>Choose</option> : null}
					{nodes(children)
						.filter((child) => child.props.id)
						.map((child) => (
							<option key={child.props.id} value={child.props.id}>
								{child.props.textValue ?? label(child.props.children)}
							</option>
						))}
				</select>
				{children}
			</div>
		),
		{ Trigger: base.Autocomplete.Trigger, Value: base.Autocomplete.Value, Indicator: base.Autocomplete.Indicator, Popover: base.Autocomplete.Popover, Filter: ({ children, inputValue, onInputChange }: any) => <FilterContext.Provider value={{ inputValue, onInputChange }}>{children}</FilterContext.Provider> },
	);
	const SearchField = Object.assign(
		({ "aria-label": name }: any) => {
			const filter = React.useContext(FilterContext);
			return <input aria-label={name} value={filter.inputValue ?? ""} onChange={(event) => filter.onInputChange?.(event.target.value)} />;
		},
		{ Group: base.SearchField.Group, Input: base.SearchField.Input, SearchIcon: base.SearchField.SearchIcon, ClearButton: base.SearchField.ClearButton },
	);
	return new Proxy({ ...base, TextField, NumberField, Select, Autocomplete, SearchField, useFilter: () => ({ contains: (text: string, input: string) => text.toLowerCase().includes(input.toLowerCase()) }) }, { get: (target: any, key: any) => (key in target ? target[key] : base[key]) });
}
