"use client";

import type { RadioProps } from "@heroui/react";

import React from "react";
import { VisuallyHidden, useRadio, useRadioGroupContext } from "@heroui/react";
import { cn } from "@heroui/react";
import { RatingValueEnum } from "@types";

const emojis: Record<RatingValueEnum, string> = {
	[RatingValueEnum.BAD]: "😣",
	[RatingValueEnum.POOR]: "🙁",
	[RatingValueEnum.NEUTRAL]: "😐",
	[RatingValueEnum.GREAT]: "🙂",
	[RatingValueEnum.EXCELLENT]: "🥰",
};

export type FeedbackRatingItemProps = Omit<RadioProps, "value"> & {
	value: RatingValueEnum;
	fullWidth?: boolean;
};

const FeedbackRatingItem = React.forwardRef<HTMLInputElement, FeedbackRatingItemProps>((props, ref) => {
	const { Component, isSelected: isSelfSelected, getBaseProps, getInputProps } = useRadio(props);

	const groupContext = useRadioGroupContext();

	const isSelected = isSelfSelected || Number(groupContext.groupState.selectedValue) >= Number(props.value);
	const isReadOnly = groupContext.groupState.isReadOnly;
	const baseProps = getBaseProps();
	return (
		<Component
			{...baseProps}
			ref={ref}
			className={cn("flex items-center justify-center text-[30px]", baseProps?.["className"], {
				"cursor-default": isReadOnly,
			})}
		>
			<VisuallyHidden>
				<input {...getInputProps()} />
			</VisuallyHidden>
			<span
				className={cn("transition-transform pointer-events-none select-none ", isSelected ? "" : "opacity-40", {
					"group-data-[pressed=true]:scale-90": !isReadOnly,
				})}
				aria-label={props.value}
			>
				{emojis[props.value]}
			</span>
		</Component>
	);
});

FeedbackRatingItem.displayName = "FeedbackRatingItem";

export default FeedbackRatingItem;
