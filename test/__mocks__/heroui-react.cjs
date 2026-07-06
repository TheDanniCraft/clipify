/* eslint-disable @typescript-eslint/no-require-imports */
const React = require("react");

const Component = React.forwardRef(function HeroUIComponent({ children, onPress, className, id, style, "aria-label": ariaLabel }, ref) {
	return React.createElement("div", { className, id, style, ref, "aria-label": ariaLabel, onClick: onPress }, children);
});

const CompoundComponent = new Proxy(Component, {
	get(target, property) {
		if (property in target) return target[property];
		return CompoundComponent;
	},
});

const toast = Object.assign(() => undefined, {
	success: () => undefined,
	warning: () => undefined,
	danger: () => undefined,
	info: () => undefined,
});

const Button = React.forwardRef(function HeroUIButton({ children, onPress, isDisabled, className, type, "aria-label": ariaLabel }, ref) {
	return React.createElement("button", { className, disabled: isDisabled, ref, type, "aria-label": ariaLabel, onClick: onPress }, children);
});

const Input = React.forwardRef(function HeroUIInput(props, ref) {
	return React.createElement("input", { ...props, ref });
});

const TextArea = React.forwardRef(function HeroUITextArea(props, ref) {
	return React.createElement("textarea", { ...props, ref });
});

const InputGroup = Object.assign(Component, {
	Input,
	Prefix: Component,
	Suffix: Component,
	TextArea,
});

const Card = Object.assign(Component, { Content: Component, Footer: Component, Header: Component, Title: Component });
const Table = Object.assign(Component, {
	Body: Component,
	Cell: Component,
	Column: Component,
	Content: Component,
	Footer: Component,
	Header: Component,
	Row: Component,
	ScrollContainer: Component,
	SortableColumnHeader: Component,
});

function useOverlayState(options = {}) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(options.defaultOpen ?? false);
	const isControlled = options.isOpen !== undefined;
	const isOpen = isControlled ? options.isOpen : uncontrolledOpen;
	const setOpen = React.useCallback(
		(nextOpen) => {
			if (!isControlled) setUncontrolledOpen(nextOpen);
			options.onOpenChange?.(nextOpen);
		},
		[isControlled, options.onOpenChange],
	);

	return {
		isOpen,
		open: () => setOpen(true),
		close: () => setOpen(false),
		toggle: () => setOpen(!isOpen),
		setOpen,
	};
}

module.exports = new Proxy(
	{
		Button,
		Card,
		CloseButton: Button,
		Form: React.forwardRef(function HeroUIForm(props, ref) {
			return React.createElement("form", { ...props, ref });
		}),
		Input,
		InputGroup,
		Label: React.forwardRef(function HeroUILabel(props, ref) {
			return React.createElement("label", { ...props, ref });
		}),
		Link: React.forwardRef(function HeroUILink({ children, onPress, ...props }, ref) {
			return React.createElement("a", { ...props, ref, onClick: onPress }, children);
		}),
		Table,
		TextArea,
		TextField: Component,
		cn: (...classes) => classes.filter(Boolean).join(" "),
		toast,
		useOverlayState,
	},
	{
		get(target, property) {
			if (property in target) return target[property];
			return CompoundComponent;
		},
	},
);
