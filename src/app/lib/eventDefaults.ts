import type { EventConfiguration } from "./eventConfiguration";
export function createAwardConfiguration(title: string, timezone: string, now = new Date()): EventConfiguration {
	const instant = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
	return {
		title,
		description: "",
		visibility: "unlisted",
		schedule: { submissionsStart: instant(1), submissionsEnd: instant(8), votingStart: instant(10), votingEnd: instant(17), timezone, reviewRequired: true },
		votesPerCategory: 1,
		tiePolicy: "shared",
		resultDetail: "percentages",
		whiteLabel: false,
		storageConnectionId: null,
		categories: [{ id: crypto.randomUUID(), title: "Best clip", group: "", source: "clip", selection: "audience", submissionLimit: 1, nomineeLimit: 6, rules: {}, options: [] }],
		slides: [],
	};
}
