import { resolveBaseUrl } from "@/app/lib/baseUrl";

export function formatEmailDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(date);
}
export function emailUrl(path: string) {
	return new URL(path, resolveBaseUrl()).href;
}

export const EMAIL_SUPPORT_ADDRESS = "contact@clipify.us";
export const EMAIL_SUPPORT_URL = `mailto:${EMAIL_SUPPORT_ADDRESS}`;
export const EMAIL_HELP_CENTER_URL = "https://help.clipify.us/";
