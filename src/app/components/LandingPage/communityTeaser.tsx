"use client";

import { Avatar } from "@heroui/react";
import type { ComponentProps } from "react";

import type { CommunityStreamer, CommunityStreamerStatus } from "@lib/community-types";
import { compareCommunityStreamers } from "@lib/communitySort";

type AvatarColor = NonNullable<ComponentProps<typeof Avatar>["color"]>;

type CommunityTeaserProps = {
	className?: string;
	countClassName?: string;
	maxVisible?: number;
	streamers: CommunityStreamer[];
};

function getStatusClass(status: CommunityStreamerStatus): AvatarColor {
	switch (status) {
		case "live_with_overlay":
			return "success";
		case "live":
			return "danger";
		default:
			return "default";
	}
}

export default function CommunityTeaser({ className, countClassName, maxVisible = 5, streamers }: CommunityTeaserProps) {
	if (streamers.length === 0) {
		return null;
	}

	const visibleStreamers = [...streamers].sort(compareCommunityStreamers).slice(0, maxVisible);

	return (
		<div className={["flex items-center", className].filter(Boolean).join(" ")}>
			{visibleStreamers.map((streamer, index) => (
				<Avatar key={streamer.id} alt={streamer.displayName} className={["relative w-7 h-7 text-tiny", index > 0 ? "-ms-2" : ""].filter(Boolean).join(" ")} color={getStatusClass(streamer.status)} fallback isBordered radius='full' src={streamer.avatar} style={{ zIndex: visibleStreamers.length - index }} />
			))}
			{streamers.length > maxVisible ? <span className={["ml-2 text-xs font-medium text-default-500", countClassName].filter(Boolean).join(" ")}>+{streamers.length - maxVisible} more</span> : null}
		</div>
	);
}
