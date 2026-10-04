"use client";
import { Avatar } from "@heroui/react";
import type { CommunityTeaserStreamer } from "@lib/community-types";
import { getCommunityAvatarTone } from "@lib/communityAvatarTone";

type CommunityTeaserProps = {
	className?: string;
	countClassName?: string;
	maxVisible?: number;
	streamers: CommunityTeaserStreamer[];
	totalCount?: number;
};

export default function CommunityTeaser({ className, countClassName, maxVisible = 5, streamers, totalCount = streamers.length }: CommunityTeaserProps) {
	if (streamers.length === 0) {
		return null;
	}

	const visibleStreamers = streamers.slice(0, maxVisible);

	return (
		<div className={["flex max-w-full flex-wrap items-center gap-y-2", className].filter(Boolean).join(" ")}>
			<div className='flex shrink-0 items-center'>
				{visibleStreamers.map((streamer, index) => {
					const tone = getCommunityAvatarTone(streamer);
					return (
						<Avatar key={streamer.id} aria-label={`${streamer.displayName}: ${tone.label}`} className={["relative h-7 w-7 rounded-full text-xs ring-2", tone.ringClass, index > 0 ? "-ms-2" : ""].filter(Boolean).join(" ")} color={tone.color} variant='soft' style={{ zIndex: visibleStreamers.length - index }}>
							<Avatar.Image alt='' src={streamer.avatar} />
							<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar>
					);
				})}
			</div>
			{totalCount > visibleStreamers.length ? <span className={["ml-2 shrink-0 whitespace-nowrap text-xs font-medium text-muted", countClassName].filter(Boolean).join(" ")}>+{totalCount - visibleStreamers.length} more</span> : null}
		</div>
	);
}
