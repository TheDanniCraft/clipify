"use client";
import { useState } from "react";
import { Button } from "@heroui/react";
import { Timeline, HoverCard } from "@heroui-pro/react";
import ClipPreview from "./clipPreview";
import StreamThumbnail from "./streamThumbnail";
import LocalizedDate from "@components/localizedDate";
import { groupStreamMoments } from "@lib/streamMoments";
import type { getCreatorClipInventory } from "@actions/creatorLibrary";
type Clip = Extract<Awaited<ReturnType<typeof getCreatorClipInventory>>, { ok: true }>["items"][number];
function timeLabel(seconds: number) {
	const whole = Math.floor(seconds);
	return whole >= 3600 ? `${Math.floor(whole / 3600)}:${String(Math.floor(whole / 60) % 60).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}` : `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
function Moment({ moment, previewing, onPreview }: { moment: ReturnType<typeof groupStreamMoments<Clip>>[number]; previewing: boolean; onPreview: (clip: Clip) => void }) {
	const [open, setOpen] = useState(false);
	const primary = moment.clips[0];
	const stamp = moment.offsetSeconds == null ? null : timeLabel(moment.offsetSeconds);
	const thumbnail = <StreamThumbnail src={primary.thumbnailUrl} className='w-20' />;
	const content = (
		<>
			<span className='min-w-0 flex-1'>
				<span className='line-clamp-2 block text-sm font-medium'>{primary.title || "Untitled clip"}</span>
				<span className='mt-1 block text-xs text-muted'>{moment.clips.length > 1 ? `${moment.clips.length} clips` : `${primary.views.toLocaleString()} views`}</span>
			</span>
		</>
	);
	const name = moment.clips.length > 1 ? `${moment.clips.length} clips ${stamp ? `at ${stamp}` : "in this moment"}` : primary.title || "Untitled clip";
	const trigger = (
		<Button variant='ghost' className='h-auto w-full justify-start gap-3 whitespace-normal p-1 text-left' aria-label={name} aria-haspopup={moment.clips.length > 1 ? "dialog" : undefined} aria-expanded={moment.clips.length > 1 ? open : undefined} onPress={() => (moment.clips.length > 1 ? setOpen(true) : onPreview(primary))}>
			{thumbnail}
			{content}
		</Button>
	);
	return (
		<Timeline.Item>
			<Timeline.Marker />
			<Timeline.Content className='gap-1'>
				<div className='text-xs tabular-nums text-muted'>{stamp ? `${stamp} into stream` : <LocalizedDate value={primary.createdAt} showTime />}</div>
				{moment.clips.length > 1 ? (
					<HoverCard open={open} onOpenChange={setOpen} isDisabled={previewing} openDelay={400} closeDelay={300}>
						<HoverCard.Trigger className='w-full'>{trigger}</HoverCard.Trigger>
						<HoverCard.Content placement='top' className='max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-3'>
							<div role='dialog' aria-label={stamp ? `Clips at ${stamp}` : "Clips in this moment"}>
								<p className='mb-2 text-sm font-semibold'>Clips around this moment</p>
								{moment.clips.map((clip, index) => (
									<Button
										key={clip.id}
										variant='ghost'
										aria-label={`Preview ${clip.title || "Untitled clip"}`}
										className='h-auto w-full justify-start gap-3 whitespace-normal px-1 py-2 text-left'
										onPress={() => {
											setOpen(false);
											onPreview(clip);
										}}
									>
										<StreamThumbnail src={clip.thumbnailUrl} className='w-16' />
										<span className='min-w-0'>
											<span className='line-clamp-2 block text-sm font-medium'>{clip.title || "Untitled clip"}</span>
											<span className='mt-1 block text-xs text-muted'>
												{clip.views.toLocaleString()} views{index === 0 ? " (most viewed)" : ""}
											</span>
										</span>
									</Button>
								))}
							</div>
						</HoverCard.Content>
					</HoverCard>
				) : (
					trigger
				)}
			</Timeline.Content>
		</Timeline.Item>
	);
}
export default function StreamMoments({ creatorId, clips }: { creatorId: string; clips: Clip[] }) {
	const [preview, setPreview] = useState<Clip | null>(null);
	const [visible, setVisible] = useState(5);
	if (!clips.length) return null;
	const moments = groupStreamMoments(clips);
	return (
		<section id='stream-moments' className='min-w-0 scroll-mt-6' aria-label='Stream moments'>
			<h2 className='mb-4 font-semibold'>Stream moments</h2>
			<Timeline density='compact' size='sm' aria-label='Stream moments timeline'>
				{moments.slice(0, visible).map((moment) => (
					<Moment key={moment.id} moment={moment} previewing={!!preview} onPreview={setPreview} />
				))}
			</Timeline>
			{moments.length > visible ? (
				<Button variant='tertiary' size='sm' className='mt-3' onPress={() => setVisible((value) => value + 10)}>
					Show more moments
				</Button>
			) : null}
			{preview ? <ClipPreview creatorId={creatorId} clip={preview} onClose={() => setPreview(null)} /> : null}
		</section>
	);
}
