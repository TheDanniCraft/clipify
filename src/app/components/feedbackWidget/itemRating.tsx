"use client";
import { Radio } from "@heroui/react";
import { RatingValueEnum } from "@types";

const emojis: Record<RatingValueEnum, string> = {
	[RatingValueEnum.BAD]: "😣",
	[RatingValueEnum.POOR]: "🙁",
	[RatingValueEnum.NEUTRAL]: "😐",
	[RatingValueEnum.GREAT]: "🙂",
	[RatingValueEnum.EXCELLENT]: "🥰",
};

export type FeedbackRatingItemProps = {
	value: RatingValueEnum;
	fullWidth?: boolean;
	className?: string;
};

const FeedbackRatingItem = ({ className, fullWidth, value }: FeedbackRatingItemProps) => {
	return (
		<Radio aria-label={value} value={value} className={["flex min-h-11 items-center justify-center", fullWidth ? "flex-1" : "", className].filter(Boolean).join(" ")}>
			{({ isSelected, isReadOnly }) => (
				<Radio.Content>
					<Radio.Control className='sr-only'>
						<Radio.Indicator />
					</Radio.Control>
					<span className={["pointer-events-none select-none text-3xl leading-none transition-transform sm:text-4xl", isSelected ? "" : "opacity-40", isReadOnly ? "cursor-default" : "group-data-[pressed=true]:scale-90"].filter(Boolean).join(" ")} aria-label={value}>
						{emojis[value]}
					</span>
				</Radio.Content>
			)}
		</Radio>
	);
};

export default FeedbackRatingItem;
