"use client";

import React, { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Chip, Textarea, Popover, PopoverContent, Listbox, ListboxItem, type TextAreaProps } from "@heroui/react";

type ChipColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
type ChipVariant = "solid" | "bordered" | "flat" | "faded" | "light" | "shadow";
type ChipSize = "sm" | "md" | "lg";

type ChipClassNames = ComponentProps<typeof Chip>["classNames"];
type TextareaClassNames = ComponentProps<typeof Textarea>["classNames"];

type PassthroughTextAreaProps = Omit<TextAreaProps, "children" | "value" | "defaultValue" | "onChange" | "onValueChange" | "startContent" | "minRows" | "maxRows" | "disableAutosize" | "classNames">;

export type TagsInputProps = PassthroughTextAreaProps & {
	suggestions?: string[];

	value?: string[];
	onValueChange?: (next: string[]) => void;

	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onClear?: () => void;
	onHeightChange?: (height: number, meta: { rowHeight: number }) => void;

	validate?: (value: string[]) => string | null | true | undefined;

	allowDuplicates?: boolean;
	maxInputs?: number;

	chipColor?: ChipColor;
	chipVariant?: ChipVariant;
	chipSize?: ChipSize;
	chipClassNames?: ChipClassNames;

	suggestionItemClassName?: string;
	textareaClassNames?: TextareaClassNames;

	className?: string;
	showCounter?: boolean;
};

const DELIM_RE = /[,\s]+/g;
const HAS_DELIM_RE = /[,\s]/;

export default function TagsInput(props: TagsInputProps) {
	const {
		suggestions,

		value,
		onValueChange,

		onChange,
		onClear,
		onHeightChange,

		validate,

		allowDuplicates,
		maxInputs,

		chipColor,
		chipVariant,
		chipSize,
		chipClassNames,

		suggestionItemClassName,
		textareaClassNames,

		className,
		showCounter = true,

		...textareaProps
	} = props;

	const isDisabled = Boolean(textareaProps.isDisabled);
	const isReadOnly = Boolean(textareaProps.isReadOnly);
	const isClearable = Boolean(textareaProps.isClearable);

	const ariaLabel = typeof textareaProps.label === "string" ? textareaProps.label : "Tags input";

	const isControlled = value !== undefined;

	const [internalTags, setInternalTags] = useState<string[]>(value ?? []);
	const tags = isControlled ? (value as string[]) : internalTags;

	const [inputValue, setInputValue] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [transientError, setTransientError] = useState<string | null>(null);

	const rootRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const ignoreBlurRef = useRef(false);

	const setTags = (next: string[]) => {
		if (!isControlled) setInternalTags(next);
		onValueChange?.(next);
	};

	const normalize = (s: string) => s.trim();

	const hasMax = typeof maxInputs === "number" && maxInputs >= 0;
	const isAtLimit = hasMax && tags.length >= maxInputs;

	const committedValidation = useMemo(() => {
		if (!validate) return null;
		return validate(tags);
	}, [validate, tags]);

	const derivedErrorMessage = transientError ?? (typeof committedValidation === "string" ? committedValidation : undefined);

	const derivedIsInvalid = Boolean(derivedErrorMessage);

	const canAddToken = (token: string) => {
		if (isDisabled || isReadOnly || isAtLimit) return false;

		const t = normalize(token);
		if (!t) return false;

		if (!allowDuplicates) {
			const exists = tags.some((x) => x.toLowerCase() === t.toLowerCase());
			if (exists) return false;
		}

		const nextTags = [...tags, t];

		if (validate) {
			const res = validate(nextTags);
			if (typeof res === "string") {
				setTransientError(res);
				return false;
			}
		}

		setTags(nextTags);
		return true;
	};

	const addTag = (raw: string) => {
		const ok = canAddToken(raw);
		if (!ok) return;
		setInputValue("");
		setTransientError(null);
		queueMicrotask(() => inputRef.current?.focus());
	};

	const removeTag = (t: string) => {
		if (isDisabled || isReadOnly) return;
		setTags(tags.filter((x) => x !== t));
		queueMicrotask(() => inputRef.current?.focus());
	};

	const clearAll = () => {
		if (isDisabled || isReadOnly) return;
		setTags([]);
		setInputValue("");
		setTransientError(null);
		onClear?.();
		queueMicrotask(() => inputRef.current?.focus());
	};

	const filteredSuggestions = useMemo(() => {
		const q = inputValue.trim().toLowerCase();
		if (!q) return [];

		const used = new Set(tags.map((t) => t.toLowerCase()));
		return (suggestions ?? [])
			.filter((s) => s.toLowerCase().includes(q))
			.filter((s) => (allowDuplicates ? true : !used.has(s.toLowerCase())))
			.slice(0, 8);
	}, [inputValue, suggestions, tags, allowDuplicates]);

	const isOpen = !isDisabled && !isReadOnly && isFocused && filteredSuggestions.length > 0 && !isAtLimit;

	const hasContent = tags.length > 0 || inputValue.length > 0;
	const syntheticValue = hasContent ? " " : "";

	const counterText = hasMax ? `${tags.length}/${maxInputs}` : `${tags.length}`;
	const counterClassName = isAtLimit ? "text-danger" : "text-foreground-500";

	const mergedTextareaClassNames: TextareaClassNames = {
		...textareaClassNames,
		inputWrapper: ["h-auto min-h-11", textareaClassNames?.inputWrapper].filter(Boolean).join(" "),
		innerWrapper: ["h-auto items-start flex-wrap", textareaClassNames?.innerWrapper].filter(Boolean).join(" "),
		input: ["sr-only !w-0 !h-0 !p-0 !m-0", textareaClassNames?.input].filter(Boolean).join(" "),
	};

	const rootClassName = [textareaProps.fullWidth ? "w-full" : "inline-block", className].filter(Boolean).join(" ");

	useEffect(() => {
		if (!onHeightChange) return;
		const el = rootRef.current;
		if (!el) return;

		const computeRowHeight = () => {
			const inp = inputRef.current;
			if (!inp) return 0;
			const lh = Number.parseFloat(getComputedStyle(inp).lineHeight);
			return Number.isFinite(lh) ? lh : 0;
		};

		let last = -1;
		const ro = new ResizeObserver(() => {
			const h = el.getBoundingClientRect().height;
			if (Math.abs(h - last) < 0.5) return;
			last = h;
			onHeightChange(h, { rowHeight: computeRowHeight() });
		});

		ro.observe(el);
		return () => ro.disconnect();
	}, [onHeightChange]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange?.(e);
		setTransientError(null);

		const next = e.target.value;

		if (!HAS_DELIM_RE.test(next)) {
			setInputValue(next);
			return;
		}

		const endsWithDelim = /[,\s]$/.test(next);
		const parts = next
			.split(DELIM_RE)
			.map((p) => p.trim())
			.filter(Boolean);

		if (parts.length === 0) {
			setInputValue("");
			return;
		}

		const commitCount = endsWithDelim ? parts.length : Math.max(0, parts.length - 1);

		let committedCount = 0;
		for (let i = 0; i < commitCount; i += 1) {
			const ok = canAddToken(parts[i]);
			if (!ok) break;
			committedCount += 1;
		}

		if (committedCount !== commitCount) {
			setInputValue(parts.slice(committedCount).join(" "));
			return;
		}

		const remainder = endsWithDelim ? "" : parts[parts.length - 1];
		setInputValue(remainder);
		if (endsWithDelim) queueMicrotask(() => inputRef.current?.focus());
	};

	return (
		<Popover isOpen={isOpen} placement='bottom-start' offset={8}>
			<div
				ref={rootRef}
				className={rootClassName}
				onMouseDown={() => {
					if (isDisabled || isReadOnly) return;
					queueMicrotask(() => inputRef.current?.focus());
				}}
			>
				<Textarea
					{...textareaProps}
					isInvalid={textareaProps.isInvalid ?? derivedIsInvalid}
					errorMessage={textareaProps.errorMessage ?? derivedErrorMessage}
					minRows={1}
					maxRows={1}
					disableAutosize={false}
					value={syntheticValue}
					onValueChange={() => {}}
					startContent={
						<div className='flex flex-wrap items-center gap-2 w-full'>
							{tags.map((t, idx) => (
								<Chip key={`${t}-${idx}`} onClose={isDisabled || isReadOnly ? undefined : () => removeTag(t)} color={chipColor} variant={chipVariant} size={chipSize} classNames={chipClassNames} className='max-w-full'>
									<span className='truncate'>{t}</span>
								</Chip>
							))}

							<input
								ref={inputRef}
								aria-label={ariaLabel}
								enterKeyHint='done'
								disabled={isDisabled || isReadOnly || isAtLimit}
								value={inputValue}
								onChange={handleInputChange}
								onFocus={() => {
									if (!isDisabled && !isReadOnly) setIsFocused(true);
								}}
								onBlur={() => {
									if (ignoreBlurRef.current) return;
									setIsFocused(false);
								}}
								onKeyDown={(e) => {
									if (isDisabled || isReadOnly) return;

									if (e.key === "Enter") {
										const t = normalize(inputValue);
										if (!t) return;
										e.preventDefault();
										addTag(t);
										return;
									}

									if (e.key === "Backspace" && !inputValue && tags.length > 0) {
										e.preventDefault();
										removeTag(tags[tags.length - 1]);
										return;
									}

									if (e.key === "Escape") setIsFocused(false);
								}}
								placeholder={tags.length === 0 ? textareaProps.placeholder : undefined}
								className={["bg-transparent outline-none", "flex-1 min-w-[10ch]", "text-small text-foreground", "placeholder:text-foreground-500", "leading-5 py-0"].join(" ")}
							/>

							<div className='w-full flex items-center justify-between mt-1'>
								{isClearable && hasContent && !isDisabled && !isReadOnly ? (
									<button
										type='button'
										className='text-tiny text-foreground-500 hover:text-foreground'
										onMouseDown={() => {
											ignoreBlurRef.current = true;
										}}
										onMouseUp={() => {
											ignoreBlurRef.current = false;
											queueMicrotask(() => inputRef.current?.focus());
										}}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											clearAll();
										}}
									>
										Clear
									</button>
								) : (
									<span />
								)}

								{showCounter ? <span className={["text-tiny select-none", counterClassName].join(" ")}>{counterText}</span> : null}
							</div>
						</div>
					}
					classNames={mergedTextareaClassNames}
				/>
			</div>

			<PopoverContent className='w-[--trigger-width] p-1'>
				<Listbox
					aria-label='Suggestions'
					selectionMode='single'
					onAction={(key) => {
						if (isAtLimit || isDisabled || isReadOnly) return;
						addTag(String(key));
					}}
				>
					{filteredSuggestions.map((s) => (
						<ListboxItem
							key={s}
							textValue={s}
							className={["rounded-medium", "data-[hover=true]:bg-transparent", "data-[hover=true]:ring-1 data-[hover=true]:ring-foreground/15", "data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary", suggestionItemClassName].filter(Boolean).join(" ")}
							onMouseDown={() => {
								ignoreBlurRef.current = true;
							}}
							onMouseUp={() => {
								ignoreBlurRef.current = false;
								queueMicrotask(() => inputRef.current?.focus());
							}}
						>
							{s}
						</ListboxItem>
					))}
				</Listbox>
			</PopoverContent>
		</Popover>
	);
}
