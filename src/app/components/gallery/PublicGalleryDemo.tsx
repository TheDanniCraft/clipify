"use client";

import { Button, Link, Modal, Spinner } from "@heroui/react";
import { useState, useRef } from "react";
import { getDemoGalleryClips } from "@actions/gallery";
import { getTwitchClipPlaybackUrl } from "@actions/twitch";
import type { TwitchClip } from "@types";
import GalleryFrame, { type GalleryFrameConfig } from "./GalleryFrame";

const gallery: GalleryFrameConfig = {
	id: "clipify-public-demo",
	layout: "grid",
	listDensity: "comfortable",
	gridAuto: true,
	gridMobileColumns: 1,
	gridTabletColumns: 3,
	gridDesktopColumns: 3,
	carouselMobileCards: 1,
	carouselTabletCards: 2,
	carouselDesktopCards: 3,
	carouselShowNavigation: true,
	carouselShowIndicators: true,
	accentColor: "#7C3AED",
	cardSurfaceColor: "#18181B",
	textColor: "#FFFFFF",
	cardRadius: 16,
	gap: 16,
	backgroundMode: "transparent",
	backgroundColor: "#000000",
	thumbnailTreatment: "cover",
	showDuration: true,
	showTitle: true,
	showCreator: true,
	showViews: false,
	showCreatedAt: false,
};

export default function PublicGalleryDemo() {
	const [bundle, setBundle] = useState<Awaited<ReturnType<typeof getDemoGalleryClips>>>(null);
	const [loading, setLoading] = useState(false);
	const [galleryError, setGalleryError] = useState(false);
	const [selected, setSelected] = useState<TwitchClip | null>(null);
	const [media, setMedia] = useState<string | null>(null);
	const [playerError, setPlayerError] = useState(false);
	const request = useRef(0);
	async function loadGallery() {
		setLoading(true);
		setGalleryError(false);
		try {
			const result = await getDemoGalleryClips();
			setBundle(result);
			setGalleryError(!result);
		} catch {
			setGalleryError(true);
		} finally {
			setLoading(false);
		}
	}
	async function play(clip: TwitchClip) {
		const generation = ++request.current;
		setSelected(clip);
		setMedia(null);
		setPlayerError(false);
		try {
			const url = await getTwitchClipPlaybackUrl(clip.id, clip.broadcaster_id, { kind: "demo", overlayId: bundle!.overlayId });
			if (generation !== request.current) return;
			setMedia(url ?? null);
			setPlayerError(!url);
		} catch {
			if (generation === request.current) setPlayerError(true);
		}
	}
	return (
		<section aria-labelledby='gallery-demo-heading' className='w-full py-10 sm:py-14'>
			<h2 id='gallery-demo-heading' className='text-2xl font-semibold'>
				Inside a Clipify gallery
			</h2>
			<p className='mt-3 mb-7 max-w-2xl leading-relaxed text-foreground/75'>These clips come from Clipify’s public demo. Open the gallery below, then choose a clip to watch.</p>
			{bundle ? (
				<GalleryFrame gallery={gallery} clips={bundle.clips} ownerName='the Clipify demo' showAttribution onSelectClip={play} />
			) : (
				<Button isPending={loading} isDisabled={loading} onPress={loadGallery}>
					{galleryError ? "Try gallery again" : "Explore the demo gallery"}
				</Button>
			)}
			{galleryError ? (
				<p role='alert' className='mt-3'>
					The gallery couldn&apos;t load. Please try again.
				</p>
			) : null}
			<Modal.Backdrop
				isOpen={selected !== null}
				onOpenChange={(open) => {
					if (!open) {
						++request.current;
						setSelected(null);
						setMedia(null);
					}
				}}
			>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger aria-label='Close gallery player' />
						<Modal.Header>
							<Modal.Heading>{selected?.title}</Modal.Heading>
						</Modal.Header>
						<Modal.Body>
							{playerError ? (
								<div role='alert'>
									<p>This clip couldn&apos;t play.</p>
									<Button className='mt-3' onPress={() => selected && play(selected)}>
										Try clip again
									</Button>
								</div>
							) : media ? (
								<video className='aspect-video w-full rounded-xl bg-black' src={media} controls autoPlay playsInline onError={() => setPlayerError(true)} aria-label={selected?.title} />
							) : (
								<div role='status' className='flex items-center gap-3'>
									<Spinner />
									Loading clip…
								</div>
							)}
							{selected ? (
								<Link className='mt-4' href={`https://clips.twitch.tv/${encodeURIComponent(selected.id)}`} target='_blank' rel='noreferrer'>
									Watch on Twitch
								</Link>
							) : null}
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</section>
	);
}
