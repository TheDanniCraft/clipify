"use client";
import type { ComponentProps } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { formatDisplayDate } from "@lib/dateFormat";
export default function LocalizedDate({ value, showTime = false, timeZone, ...props }: { value: Date | string; showTime?: boolean; timeZone?: string } & Omit<ComponentProps<"time">, "children" | "dateTime">) {
	const { locale } = useLocale();
	if (Number.isNaN(new Date(value).getTime())) return <span>Date unavailable</span>;
	return (
		<time {...props} dateTime={typeof value === "string" ? value : value.toISOString()}>
			{formatDisplayDate(value, locale, { ...(showTime ? { hour: "2-digit", minute: "2-digit" } : {}), ...(timeZone ? { timeZone, ...(showTime ? { timeZoneName: "short" as const } : {}) } : {}) })}
		</time>
	);
}
