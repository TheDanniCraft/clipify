"use client";
import { useEffect, useState } from "react";
import { Button, Link, Modal } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import { getCreatorClipPreview } from "@actions/creatorLibrary";

export default function ClipPreview({ creatorId, clip, onClose }: { creatorId: string; clip: { id: string; title: string; url: string }; onClose: () => void }) {
	const [playbackUrl, setPlaybackUrl] = useState<string | null>();
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		let current = true;
		void getCreatorClipPreview({ creatorId, clipId: clip.id })
			.then((result) => {
				if (current) setPlaybackUrl(result?.playbackUrl ?? null);
			})
			.catch(() => {
				if (current) setPlaybackUrl(null);
			});
		return () => {
			current = false;
		};
	}, [creatorId, clip.id, retry]);
	return (
		<ControlledModal isOpen onClose={onClose} size='lg'>
			<Modal.Header>
				<Modal.Heading>{clip.title || "Untitled clip"}</Modal.Heading>
			</Modal.Header>
			<Modal.Body>
				{playbackUrl ? (
					<video src={playbackUrl} controls autoPlay playsInline className='aspect-video w-full rounded-lg bg-black' />
				) : playbackUrl === undefined ? (
					<p role='status'>Loading preview…</p>
				) : (
					<div role='alert'>
						<p>This preview is unavailable. You can still open the clip on Twitch.</p>
						<Button
							variant='secondary'
							onPress={() => {
								setPlaybackUrl(undefined);
								setRetry((value) => value + 1);
							}}
						>
							Retry preview
						</Button>
					</div>
				)}
				<Link href={clip.url} target='_blank' rel='noopener noreferrer'>
					Open on Twitch
				</Link>
			</Modal.Body>
		</ControlledModal>
	);
}
