"use client";
import { Avatar } from "@heroui/react";


import type { CommunityTeaserStreamer } from "@lib/community-types";

type CommunityHeroAvatarsProps = {
	streamers: CommunityTeaserStreamer[];
};

export default function CommunityHeroAvatars({ streamers }: CommunityHeroAvatarsProps) {
	const maxVisible = 5;
	const visibleStreamers = streamers.slice(0, maxVisible);

	return (
		<div className='flex items-center'>
			{visibleStreamers.map((streamer, index) => (
				<Avatar
					key={streamer.id}
					className={["relative h-8 w-8 text-xs ring-2 ring-background", index > 0 ? "-ms-2" : ""].filter(Boolean).join(" ")}
					style={{ zIndex: visibleStreamers.length - index }}
				>
					<Avatar.Image alt={streamer.displayName} src={streamer.avatar} />
					<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
				</Avatar>
			))}
			{streamers.length > maxVisible ? <p className='ms-2 text-sm font-medium text-white/70'>+{streamers.length - maxVisible} more</p> : null}
		</div>
	);
}
