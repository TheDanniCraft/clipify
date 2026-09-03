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
		description: "One of the first people to support Clipify commercially.",
		icon: "heart",
		priority: 90,
	},
	partner: {
		name: "Clipify Partner",
		description: "An official partner helping Clipify and its community grow.",
		icon: "shield",
		priority: 85,
	},
	"beta-tester": {
		name: "Beta Tester",
		description: "Helped test and shape Clipify in its earliest days.",
		icon: "flask",
		priority: 80,
	},
	contributor: {
		name: "Contributor",
		description: "Made Clipify better through feedback, ideas, or bug reports.",
		icon: "sparkles",
		priority: 70,
	},
} as const satisfies Record<string, BadgeDefinition>;

export type BadgeSlug = keyof typeof badgeCatalog;

/** PostgreSQL enum values, derived from the registry so there is one source of truth. */
export const badgeSlugs = Object.keys(badgeCatalog) as [BadgeSlug, ...BadgeSlug[]];

export function isBadgeSlug(value: string): value is BadgeSlug {
	return Object.hasOwn(badgeCatalog, value);
}
