"use client";
import { Avatar } from "@heroui/react";

import type { CommunityTeaserStreamer } from "@lib/community-types";
import { getCommunityAvatarTone } from "@lib/communityAvatarTone";

type CommunityHeroAvatarsProps = {
	streamers: CommunityTeaserStreamer[];
	totalCount: number;
};

export default function CommunityHeroAvatars({ streamers, totalCount }: CommunityHeroAvatarsProps) {
	const maxVisible = 5;
	const visibleStreamers = streamers.slice(0, maxVisible);

	return (
		<div className='flex max-w-full flex-wrap items-center gap-y-2'>
			<div className='flex shrink-0 items-center'>
				{visibleStreamers.map((streamer, index) => {
					const tone = getCommunityAvatarTone(streamer);
					return (
						<Avatar key={streamer.id} aria-label={`${streamer.displayName}: ${tone.label}`} className={["relative h-8 w-8 text-xs ring-2", tone.ringClass, index > 0 ? "-ms-2" : ""].filter(Boolean).join(" ")} color={tone.color} variant='soft' style={{ zIndex: visibleStreamers.length - index }}>
							<Avatar.Image alt='' src={streamer.avatar} />
							<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar>
					);
				})}
			</div>
			{totalCount > visibleStreamers.length ? <p className='ms-2 shrink-0 whitespace-nowrap text-sm font-medium text-white/70'>+{totalCount - visibleStreamers.length} more</p> : null}
		</div>
	);
}
