export const displayDateOptions: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
export function formatDisplayDate(value: Date | string, locale?: string, options: Intl.DateTimeFormatOptions = {}) {
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return "Date unavailable";
	return new Intl.DateTimeFormat(locale, { ...displayDateOptions, ...(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: "UTC" } : {}), ...options }).format(date);
}
