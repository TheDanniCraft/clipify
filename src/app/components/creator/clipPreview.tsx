"use client";
import { buttonVariants } from "@heroui/styles";
import { IconBrandTwitch, IconArrowRight } from "@tabler/icons-react";
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
			</Modal.Body>
			<Modal.Footer className='flex flex-wrap items-center justify-between gap-3'>
				<Link className={buttonVariants({ variant: "tertiary", className: "gap-2" })} href={clip.url} target='_blank' rel='noopener noreferrer'>
					<IconBrandTwitch className='size-4' aria-hidden='true' />
					Open on Twitch
				</Link>
				<Link className={buttonVariants({ variant: "secondary", className: "gap-2" })} href={`/dashboard/clips/${encodeURIComponent(clip.id)}`}>
					View clip details
					<IconArrowRight className='size-4' aria-hidden='true' />
				</Link>
			</Modal.Footer>
		</ControlledModal>
	);
}
