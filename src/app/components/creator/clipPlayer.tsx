"use client";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { getCreatorClipPreview } from "@actions/creatorLibrary";
import { notify } from "@lib/toast";

export default function ClipPlayer({ creatorId, clipId }: { creatorId: string; clipId: string }) {
	const [playbackUrl, setPlaybackUrl] = useState<string | null>();
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		let current = true;
		void getCreatorClipPreview({ creatorId, clipId, ...(retry ? { refresh: true } : {}) })
			.then((result) => {
				if (!current) return;
				setPlaybackUrl(result?.playbackUrl ?? null);
				if (!result?.playbackUrl) notify({ title: "Clip preview unavailable", description: "You can retry or open the clip on Twitch.", color: "danger" });
			})
			.catch(() => {
				if (!current) return;
				setPlaybackUrl(null);
				notify({ title: "Clip preview unavailable", description: "Please try again.", color: "danger" });
			});
		return () => {
			current = false;
		};
	}, [creatorId, clipId, retry]);
	return (
		<div className='aspect-video w-full overflow-hidden rounded-xl bg-surface-secondary'>
			{playbackUrl ? (
				<video
					src={playbackUrl}
					controls
					autoPlay
					playsInline
					onError={() => {
						setPlaybackUrl(null);
						notify({ title: "Clip preview unavailable", description: "Retry to load a fresh preview, or open the clip on Twitch.", color: "warning" });
					}}
					aria-label='Clip preview'
					className='h-full w-full bg-black'
				/>
			) : (
				<div className='flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted'>
					{playbackUrl === undefined ? (
						<p role='status'>Loading preview…</p>
					) : (
						<>
							<p>Preview unavailable. You can still open the clip on Twitch.</p>
							<Button
								variant='secondary'
								onPress={() => {
									setPlaybackUrl(undefined);
									setRetry((value) => value + 1);
								}}
							>
								Retry preview
							</Button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
