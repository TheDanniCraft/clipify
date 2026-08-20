import type { AuthenticatedUser } from "@types";
import { getDismissedContentKeys } from "@lib/contentStates";

export type DashboardContentItem = {
	key: string;
	title: string;
	headline: string;
	intro: string;
	highlight: { title: string; text: string };
	helpText?: string;
	expiresAt?: string;
	image: { src: string; alt: string };
	actionLabel: string;
};

type DashboardContentDefinition = {
	key: string;
	priority: number;
	isEligible: (user: AuthenticatedUser) => boolean;
	build: (user: AuthenticatedUser) => DashboardContentItem;
};

const dashboardContentRegistry: DashboardContentDefinition[] = [
	{
		key: "new-account-pro-trial",
		priority: 100,
		isEligible: (user) => Boolean(user.entitlements?.reverseTrialActive && user.entitlements.trialEndsAt),
		build: (user) => ({
			key: "new-account-pro-trial",
			title: "Welcome",
			headline: "Happy to have you on board!",
			intro: "Thanks for joining Clipify. We're excited to see what you create.",
			highlight: {
				title: "7 days of Pro, on us.",
				text: "Try every Pro feature and explore Clipify at your own pace. No credit card needed.",
			},
			helpText: "Need help, have feedback, or missing a feature? Contact us anytime. We'd love to hear from you.",
			expiresAt: new Date(user.entitlements!.trialEndsAt!).toISOString(),
			image: { src: "/clippy/Clippy.svg", alt: "Clippy, the Clipify mascot" },
			actionLabel: "Got it",
		}),
	},
];

export function isDashboardContentKey(contentKey: string) {
	return dashboardContentRegistry.some((definition) => definition.key === contentKey);
}

export async function getPendingDashboardContent(user: AuthenticatedUser) {
	const eligible = dashboardContentRegistry.filter((definition) => definition.isEligible(user)).sort((a, b) => b.priority - a.priority);
	const dismissed = await getDismissedContentKeys(
		user.id,
		eligible.map((definition) => definition.key),
	);
	return eligible.filter((definition) => !dismissed.has(definition.key)).map((definition) => definition.build(user));
}
