import type { ButtonProps } from "@heroui/react";

export enum TiersEnum {
	Free = "free",
	Pro = "pro",
}

export enum FrequencyEnum {
	Yearly = "yearly",
	Monthly = "monthly",
}

export type Frequency = {
	key: FrequencyEnum;
	label: string;
	priceSuffix: string;
};

export type Tier = {
	key: TiersEnum;
	title: string;
	price:
		| {
				[FrequencyEnum.Yearly]: string;
				[FrequencyEnum.Monthly]: string;
		  }
		| string;
	discountedPrice?: {
		[FrequencyEnum.Yearly]?: string;
		[FrequencyEnum.Monthly]?: string;
	};
	description?: string;
	mostPopular?: boolean;
	featured?: boolean;
	features?: string[];
	buttonText: string;
	buttonColor?: ButtonProps["color"];
	buttonVariant: ButtonProps["variant"];
};
