import { Plan } from "@types";

import { getCommunityAvatarTone } from "@/app/lib/communityAvatarTone";

describe("getCommunityAvatarTone", () => {
	it.each([
		[
			{ status: "live_with_overlay", partner: true, plan: Plan.Pro },
			{ color: "success", label: "Live with Clipify", ringClass: "ring-success" },
		],
		[
			{ status: "live", partner: true, plan: Plan.Pro },
			{ color: "danger", label: "Live on Twitch", ringClass: "ring-danger" },
		],
		[
			{ status: "offline", partner: true, plan: Plan.Pro },
			{ color: "warning", label: "Clipify Partner", ringClass: "ring-warning" },
		],
		[
			{ status: "offline", partner: false, plan: Plan.Pro },
			{ color: "accent", label: "Clipify Pro", ringClass: "ring-accent" },
		],
		[
			{ status: "offline", partner: false, plan: Plan.Free },
			{ color: "default", label: "Offline", ringClass: "ring-default" },
		],
	] as const)("maps %o to its semantic avatar tone", (streamer, expected) => {
		expect(getCommunityAvatarTone(streamer)).toEqual(expected);
	});
});
