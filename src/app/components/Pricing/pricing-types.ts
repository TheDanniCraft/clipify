import type { ButtonProps } from "@heroui/react";

export enum TiersEnum {
	Free = "free",
	Pro = "pro",
}

export type Tier = {
	key: TiersEnum;
	title: string;
	price: string;
	priceSuffix?: string;
	description?: string;
	mostPopular?: boolean;
	featured?: boolean;
	features?: string[];
	buttonText: string;
	buttonColor?: ButtonProps["color"];
	buttonVariant: ButtonProps["variant"];
};
