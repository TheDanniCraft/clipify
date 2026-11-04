"use client";
import { Link, Modal } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import ClipPlayer from "./clipPlayer";

export default function ClipPreview({ creatorId, clip, onClose }: { creatorId: string; clip: { id: string; title: string; url: string }; onClose: () => void }) {
	return (
		<ControlledModal isOpen onClose={onClose} size='lg'>
			<Modal.Header>
				<Modal.Heading>{clip.title || "Untitled clip"}</Modal.Heading>
			</Modal.Header>
			<Modal.Body>
				<ClipPlayer key={`${creatorId}:${clip.id}`} creatorId={creatorId} clipId={clip.id} />
				<Link href={`/dashboard/clips/${encodeURIComponent(clip.id)}`}>View clip details</Link>
				<Link href={clip.url} target='_blank' rel='noopener noreferrer'>
					Open on Twitch
				</Link>
			</Modal.Body>
		</ControlledModal>
	);
}
