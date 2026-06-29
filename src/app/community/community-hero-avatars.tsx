"use client";

import { Avatar } from "@heroui/react";

import type { CommunityPageStreamer } from "./community-data";

type CommunityHeroAvatarsProps = {
	streamers: CommunityPageStreamer[];
};

export default function CommunityHeroAvatars({ streamers }: CommunityHeroAvatarsProps) {
	const maxVisible = 5;
	const visibleStreamers = streamers.slice(0, maxVisible);

	return (
		<div className='flex items-center'>
			{visibleStreamers.map((streamer, index) => (
				<Avatar
					key={streamer.id}
					alt={streamer.displayName}
					isBordered
					className={["relative h-8 w-8 text-tiny", index > 0 ? "-ms-2" : ""].filter(Boolean).join(" ")}
					src={streamer.avatar}
					style={{ zIndex: visibleStreamers.length - index }}
				/>
			))}
			{streamers.length > maxVisible ? <p className='ms-2 text-sm font-medium text-white/70'>+{streamers.length - maxVisible} more</p> : null}
		</div>
	);
}
