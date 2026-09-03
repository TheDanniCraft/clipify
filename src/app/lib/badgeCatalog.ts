export const badgeIconKeys = ["badge", "crown", "flask", "heart", "shield", "sparkles", "star"] as const;
export type BadgeIconKey = (typeof badgeIconKeys)[number];

type BadgeDefinition = {
	name: string;
	description: string;
	icon: BadgeIconKey;
	priority: number;
};

/** Authoritative badge registry. A badge cannot be awarded unless it exists here. */
export const badgeCatalog = {
	founder: {
		name: "Founder",
		description: "One of the first 100 registered Clipify accounts.",
		icon: "crown",
		priority: 100,
	},
	"founder-supporter": {
		name: "Founder Supporter",
		description: "Supported Clipify during its founding chapter.",
		icon: "heart",
		priority: 90,
	},
	"beta-member": {
		name: "Beta Member",
		description: "Helped shape Clipify during its beta.",
		icon: "flask",
		priority: 80,
	},
	"beta-member-test": {
		name: "Beta Member",
		description: "A test badge for previewing the Clipify badge experience.",
		icon: "flask",
		priority: 10,
	},
} as const satisfies Record<string, BadgeDefinition>;

export type BadgeSlug = keyof typeof badgeCatalog;

/** PostgreSQL enum values, derived from the registry so there is one source of truth. */
export const badgeSlugs = Object.keys(badgeCatalog) as [BadgeSlug, ...BadgeSlug[]];

export function isBadgeSlug(value: string): value is BadgeSlug {
	return Object.hasOwn(badgeCatalog, value);
}
