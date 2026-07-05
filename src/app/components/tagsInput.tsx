"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, CloseButton, Description, FieldError, InputGroup, Label, ListBox, Popover, TextField } from "@heroui/react";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";
type ChipVariant = "primary" | "secondary" | "tertiary" | "soft";
type ChipSize = "sm" | "md" | "lg";

export type TagsInputProps = {
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
	chipClassName?: string;

	suggestionItemClassName?: string;

	className?: string;
	showCounter?: boolean;
	label?: React.ReactNode;
	description?: React.ReactNode;
	errorMessage?: React.ReactNode;
	placeholder?: string;
	name?: string;
	fullWidth?: boolean;
	isDisabled?: boolean;
	isReadOnly?: boolean;
	isClearable?: boolean;
	isInvalid?: boolean;
	isRequired?: boolean;
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
		chipClassName,

		suggestionItemClassName,
		className,
		showCounter = true,
		label,
		description,
		errorMessage,
		placeholder,
		name,
		fullWidth,
		isDisabled = false,
		isReadOnly = false,
		isClearable = false,
		isInvalid,
		isRequired,
	} = props;

	const ariaLabel = typeof label === "string" ? label : "Tags input";

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

	const counterText = hasMax ? `${tags.length}/${maxInputs}` : `${tags.length}`;
	const counterClassName = isAtLimit ? "text-danger" : "text-muted";

	const rootClassName = [fullWidth ? "w-full" : "inline-block", className].filter(Boolean).join(" ");

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

	const field = (
		<div
			ref={rootRef}
			className={rootClassName}
			onMouseDown={() => {
				if (isDisabled || isReadOnly) return;
				queueMicrotask(() => inputRef.current?.focus());
			}}
		>
			<TextField fullWidth={fullWidth} isDisabled={isDisabled} isInvalid={isInvalid ?? derivedIsInvalid} isReadOnly={isReadOnly} isRequired={isRequired} name={name}>
				{label ? <Label>{label}</Label> : null}
				<InputGroup fullWidth={fullWidth} variant='secondary' className='h-auto min-h-11 flex-wrap gap-2 px-3 py-2'>
					{tags.length > 0 ? (
						<InputGroup.Prefix className='flex flex-wrap gap-2 p-0'>
							{tags.map((t, idx) => (
								<Chip key={`${t}-${idx}`} color={chipColor} variant={chipVariant} size={chipSize} className={["max-w-full", chipClassName].filter(Boolean).join(" ")}>
									<span className='truncate'>{t}</span>
									{isDisabled || isReadOnly ? null : <CloseButton aria-label={`Remove ${t}`} onPress={() => removeTag(t)} />}
								</Chip>
							))}
						</InputGroup.Prefix>
					) : null}
					<InputGroup.Input
						ref={inputRef}
						aria-label={ariaLabel}
						enterKeyHint='done'
						disabled={isDisabled || isAtLimit}
						readOnly={isReadOnly}
						value={inputValue}
						onChange={handleInputChange}
						onFocus={() => {
							if (!isDisabled && !isReadOnly) setIsFocused(true);
						}}
						onBlur={() => {
							if (ignoreBlurRef.current) return;
							setIsFocused(false);
						}}
						onKeyDown={(event) => {
							if (isDisabled || isReadOnly) return;
							if (event.key === "Enter") {
								const token = normalize(inputValue);
								if (!token) return;
								event.preventDefault();
								addTag(token);
								return;
							}
							if (event.key === "Backspace" && !inputValue && tags.length > 0) {
								event.preventDefault();
								removeTag(tags[tags.length - 1]);
								return;
							}
							if (event.key === "Escape") setIsFocused(false);
						}}
						placeholder={tags.length === 0 ? placeholder : undefined}
						className='min-w-[10ch] flex-1 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted'
					/>
					{showCounter || (isClearable && hasContent && !isDisabled && !isReadOnly) ? (
						<InputGroup.Suffix className='flex items-center gap-2 p-0'>
							{showCounter && <span className={["text-xs tabular-nums", counterClassName].join(" ")}>{counterText}</span>}
							{isClearable && hasContent && !isDisabled && !isReadOnly && (
								<Button size='sm' variant='ghost' onPress={clearAll}>
									Clear
								</Button>
							)}
						</InputGroup.Suffix>
					) : null}
				</InputGroup>
				{(errorMessage ?? derivedErrorMessage) ? <FieldError>{errorMessage ?? derivedErrorMessage}</FieldError> : description ? <Description>{description}</Description> : null}
			</TextField>
		</div>
	);

	if (!suggestions?.length) return field;

	return (
		<Popover isOpen={isOpen}>
			<Popover.Trigger className={fullWidth ? "block w-full" : undefined}>{field}</Popover.Trigger>

			<Popover.Content placement='bottom start' offset={8} className='w-[--trigger-width] p-1'>
				<Popover.Dialog>
					<ListBox
						aria-label='Suggestions'
						selectionMode='single'
						onAction={(key) => {
							if (isAtLimit || isDisabled || isReadOnly) return;
							addTag(String(key));
						}}
					>
						{filteredSuggestions.map((s) => (
							<ListBox.Item
								key={s}
								id={s}
								textValue={s}
								className={["rounded-[12px]", "data-[hovered=true]:bg-transparent", "data-[hovered=true]:ring-1 data-[hovered=true]:ring-foreground/15", "data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent", suggestionItemClassName].filter(Boolean).join(" ")}
								onMouseDown={() => {
									ignoreBlurRef.current = true;
								}}
								onMouseUp={() => {
									ignoreBlurRef.current = false;
									queueMicrotask(() => inputRef.current?.focus());
								}}
							>
								<Label>{s}</Label>
							</ListBox.Item>
						))}
					</ListBox>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
