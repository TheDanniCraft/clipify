"use client";
import { useState } from "react";
import { Button } from "@heroui/react";
import ClipPreview from "./clipPreview";
import LocalizedDate from "@components/localizedDate";
import type { getCreatorClipInventory } from "@actions/creatorLibrary";
type Clip = Extract<Awaited<ReturnType<typeof getCreatorClipInventory>>, { ok: true }>["items"][number];
export default function StreamMoments({ creatorId, clips }: { creatorId: string; clips: Clip[] }) {
	const [preview, setPreview] = useState<Clip | null>(null);
	if (!clips.length) return null;
	return (
		<section className='mt-6 min-w-0' aria-label='Stream moments'>
			<div className='mb-3'>
				<h2 className='font-semibold'>Stream moments</h2>
				<p className='text-sm text-muted'>A selection of clips in stream order</p>
			</div>
			<div className='flex gap-3 overflow-x-auto pb-3'>
				{clips.map((clip) => (
					<Button key={clip.id} variant='ghost' className='h-auto w-40 shrink-0 flex-col items-start gap-2 whitespace-normal p-0 text-left' onPress={() => setPreview(clip)}>
						{clip.thumbnailUrl ? <img src={clip.thumbnailUrl} alt='' className='aspect-video w-full rounded-lg object-cover' /> : null}
						<span className='line-clamp-2 text-sm font-medium'>{clip.title || "Untitled clip"}</span>
						<span className='text-xs text-muted'>{clip.vodOffsetSeconds != null ? `${Math.floor(clip.vodOffsetSeconds / 60)}:${String(Math.floor(clip.vodOffsetSeconds % 60)).padStart(2, "0")} into stream` : <LocalizedDate value={clip.createdAt} showTime />}</span>
					</Button>
				))}
			</div>
			{preview ? <ClipPreview creatorId={creatorId} clip={preview} onClose={() => setPreview(null)} /> : null}
		</section>
	);
}
