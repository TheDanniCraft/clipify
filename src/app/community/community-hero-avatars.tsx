"use client";

import { Avatar, AvatarGroup } from "@heroui/react";

import type { CommunityPageStreamer } from "./community-data";

type CommunityHeroAvatarsProps = {
	streamers: CommunityPageStreamer[];
};

export default function CommunityHeroAvatars({ streamers }: CommunityHeroAvatarsProps) {
	return (
		<AvatarGroup
			isBordered
			max={5}
			total={streamers.length}
			renderCount={(count) => <p className='ms-2 text-sm font-medium text-white/70'>+{count} more</p>}
		>
			{streamers.map((streamer) => (
				<Avatar key={streamer.id} alt={streamer.displayName} src={streamer.avatar} />
			))}
		</AvatarGroup>
	);
}
