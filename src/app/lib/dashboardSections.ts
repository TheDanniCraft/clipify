import type { Permission } from "@/auth/permissions";

export const settingsSections = [
	{ key: "settings", title: "Account", href: "/dashboard/settings", permission: "account:read", tour: "settings-core-tab" },
	{ key: "brand", title: "Brand styling", href: "/dashboard/settings?tab=brand", permission: "creator:read" },
	{ key: "connections", title: "Connections", href: "/dashboard/settings?tab=connections", permission: "account:read", tour: "settings-connections-tab" },
	{ key: "creator", title: "Creator Page", href: "/dashboard/settings?tab=creator", permission: "creator:read", tour: "settings-creator-tab" },
	{ key: "billing", title: "Billing", href: "/dashboard/settings?tab=billing", permission: "billing:read" },
	{ key: "team", title: "Team", href: "/dashboard/settings?tab=team", permission: "member:read", tour: "settings-team-tab" },
] as const satisfies readonly { key: string; title: string; href: string; permission: Permission; tour?: string }[];
export type SettingsSection = (typeof settingsSections)[number]["key"];
export function settingsSection(params: Pick<URLSearchParams, "get" | "has">): SettingsSection {
	const tab = params.get("tab");
	if (settingsSections.some((section) => section.key === tab)) return tab as SettingsSection;
	return params.has("billing") || params.has("checkout") || params.get("addon") === "runner" ? "billing" : "settings";
}
export const toolSections = [
	{ title: "Clip Player", href: "/dashboard/tools?tool=player" },
	{ title: "Clip Gallery", href: "/dashboard/tools?tool=gallery" },
] as const;
