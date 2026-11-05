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
	return new Proxy({ ...base, TextField, NumberField, Select }, { get: (target: any, key: any) => (key in target ? target[key] : base[key]) });
}
