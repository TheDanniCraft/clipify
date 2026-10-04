import { Plan } from "@types";

import type { CommunityStreamer } from "./community-types";

export type CommunityAvatarTone = {
	color: "default" | "accent" | "success" | "warning" | "danger";
	label: string;
	ringClass: string;
};

export function getCommunityAvatarTone(streamer: Pick<CommunityStreamer, "plan" | "partner" | "status">): CommunityAvatarTone {
	if (streamer.status === "live_with_overlay") {
		return { color: "success", label: "Live with Clipify", ringClass: "ring-success" };
	}

	if (streamer.status === "live") {
		return { color: "danger", label: "Live on Twitch", ringClass: "ring-danger" };
	}

	if (streamer.partner) {
		return { color: "warning", label: "Clipify Partner", ringClass: "ring-warning" };
	}

	if (streamer.plan === Plan.Pro) {
		return { color: "accent", label: "Clipify Pro", ringClass: "ring-accent" };
	}

	return { color: "default", label: "Offline", ringClass: "ring-default" };
}
