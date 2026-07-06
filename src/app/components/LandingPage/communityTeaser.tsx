"use client";
import { Avatar } from "@heroui/react";

import type { ComponentProps } from "react";

import type { CommunityTeaserStreamer, CommunityStreamerStatus } from "@lib/community-types";

type CommunityTeaserProps = {
	className?: string;
	countClassName?: string;
	maxVisible?: number;
	streamers: CommunityTeaserStreamer[];
};

function getStatusClass(status: CommunityStreamerStatus): NonNullable<ComponentProps<typeof Avatar>["color"]> {
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

	const visibleStreamers = streamers.slice(0, maxVisible);

	return (
		<div className={["flex items-center", className].filter(Boolean).join(" ")}>
			{visibleStreamers.map((streamer, index) => (
				<Avatar key={streamer.id} className={["relative h-7 w-7 rounded-full text-xs ring-2 ring-background", index > 0 ? "-ms-2" : ""].filter(Boolean).join(" ")} color={getStatusClass(streamer.status)} style={{ zIndex: visibleStreamers.length - index }}>
					<Avatar.Image alt={streamer.displayName} src={streamer.avatar} />
					<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
				</Avatar>
			))}
			{streamers.length > maxVisible ? <span className={["ml-2 text-xs font-medium text-muted", countClassName].filter(Boolean).join(" ")}>+{streamers.length - maxVisible} more</span> : null}
		</div>
	);
}
