"use client";

import { useCallback, useEffect, useState } from "react";
import { TwitchClip } from "@types";
import { getRawMediaUrl } from "@actions/twitch";

type VideoClip = {
	id: string;
	mediaUrl: string;
};

export default function OverlayPlayer({ clips }: { clips: TwitchClip[] }) {
	const [videoClip, setVideoClip] = useState<VideoClip | null>(null);
	const [playedClips, setPlayedClips] = useState<string[]>([]);

	const getRandomClip = useCallback(() => {
		let unplayedClips = clips.filter((clip) => !playedClips.includes(clip.id));

		if (unplayedClips.length === 0) {
			setPlayedClips([]);
			unplayedClips = clips;
		}

		const randomIndex = Math.floor(Math.random() * unplayedClips.length);
		return unplayedClips[randomIndex];
	}, [clips, playedClips]);

	useEffect(() => {
		async function fetchVideoSource() {
			const randomClip = getRandomClip();
			const mediaUrl = await getRawMediaUrl(randomClip?.id);

			if (mediaUrl)
				setVideoClip({
					id: randomClip.id,
					mediaUrl,
				});
		}

		fetchVideoSource();
	}, [getRandomClip]);

	return (
		<video
			autoPlay
			src={videoClip?.mediaUrl}
			onEnded={() => {
				async function fetchNewClip() {
					setPlayedClips((prevPlayedClips) => [...prevPlayedClips, videoClip!.id]);

					const randomClip = getRandomClip();
					const mediaUrl = await getRawMediaUrl(randomClip.id);
					if (mediaUrl) {
						setVideoClip({
							id: randomClip.id,
							mediaUrl,
						});
					}
				}
				fetchNewClip();
			}}
		>
			Your browser does not support the video tag.
		</video>
	);
}
