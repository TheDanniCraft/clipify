"use client";

import { Button } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import type { Gallery, TwitchClip } from "@types";
import { useRef, useState, type CSSProperties } from "react";
import GalleryFrame from "./GalleryFrame";

export default function GalleryInlinePreview({ gallery, clips, ownerName, showAttribution, isUpdating = false, hasError = false }: { gallery: Gallery; clips: TwitchClip[]; ownerName: string; showAttribution: boolean; isUpdating?: boolean; hasError?: boolean }) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [selectedClip, setSelectedClip] = useState<TwitchClip | null>(null);

	const openClip = (clip: TwitchClip) => {
		setSelectedClip(clip);
		requestAnimationFrame(() => dialogRef.current?.showModal());
	};

	const close = () => {
		dialogRef.current?.close();
		setSelectedClip(null);
	};

	return (
		<>
			<div className='overflow-hidden rounded-xl border border-default bg-[#f4f1eb] text-[#191714] dark:bg-[#16171b] dark:text-[#f4f4f5]'>
				<div className='flex items-center gap-1.5 border-b border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-[#202126]/90' aria-hidden='true'>
					<span className='size-2.5 rounded-full bg-red-400' />
					<span className='size-2.5 rounded-full bg-amber-400' />
					<span className='size-2.5 rounded-full bg-green-400' />
					<span className='ml-2 text-[11px] text-black/45 dark:text-white/50'>Website preview</span>
					{isUpdating ? <span className='ml-auto text-[11px] text-black/45 dark:text-white/50'>Updating...</span> : null}
					{hasError ? <span className='ml-auto text-[11px] text-danger'>Preview unavailable</span> : null}
				</div>
				<div className='p-4 sm:p-6'>
					<p className='mb-3 text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/55'>Featured clips</p>
					<GalleryFrame gallery={gallery} clips={clips} ownerName={ownerName} showAttribution={showAttribution} onSelectClip={openClip} />
				</div>
			</div>

			<dialog ref={dialogRef} className='m-auto max-h-[calc(100dvh-48px)] w-[min(var(--gallery-modal-width,960px),calc(100vw-48px))] overflow-hidden rounded-2xl bg-transparent p-0 shadow-2xl backdrop:bg-[var(--gallery-backdrop)] max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none' style={{ "--gallery-modal-width": `${gallery.desktopModalWidth}px`, "--gallery-backdrop": gallery.modalBackdrop } as CSSProperties} onClose={() => setSelectedClip(null)}>
				{selectedClip ? (
					<div className='relative aspect-[4/3] max-h-[calc(100dvh-48px)] w-full bg-transparent max-sm:h-dvh max-sm:max-h-dvh max-sm:aspect-auto'>
						<iframe className='h-full w-full border-0 bg-transparent' src={`/dashboard/galleries/${encodeURIComponent(gallery.id)}/preview/clip/${encodeURIComponent(selectedClip.id)}`} title={`Playing ${selectedClip.title}`} allow='autoplay' />
						<Button isIconOnly variant='secondary' className='absolute right-3 top-3 z-10' aria-label='Close player' onPress={close}>
							<IconX />
						</Button>
					</div>
				) : null}
			</dialog>
		</>
	);
}
