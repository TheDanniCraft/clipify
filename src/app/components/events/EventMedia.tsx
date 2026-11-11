"use client";
import { animate, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button, Checkbox, Link, ProgressBar } from "@heroui/react";
import type { EventCandidateContent } from "@lib/eventCandidates";
export function EventMedia({ content }: { content: EventCandidateContent }) {
	const [failed, setFailed] = useState<string | null>(null),
		identity = content.mediaUrl ?? content.thumbnailUrl ?? content.reference;
	if (failed === identity)
		return (
			<div role='status' className='flex min-h-64 flex-col items-center justify-center gap-5 p-8 text-center'>
				<h2 className='text-2xl font-semibold'>{content.title}</h2>
				<p className='text-muted'>This media could not load. You can retry or return to the show.</p>
				<Button variant='secondary' onPress={() => setFailed(null)}>
					Retry media
				</Button>
			</div>
		);
	const onError = () => setFailed(identity);

	if (content.kind === "clip" && /^[A-Za-z0-9_-]{1,200}$/.test(content.reference)) return <iframe title={content.title} referrerPolicy='strict-origin-when-cross-origin' className='aspect-video h-full w-full border-0' src={`https://clips.twitch.tv/embed?clip=${encodeURIComponent(content.reference)}&parent=${encodeURIComponent(window.location.hostname)}&autoplay=true`} allow='autoplay; fullscreen' allowFullScreen />;
	if (content.kind === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(content.reference)) return <iframe title={content.title} referrerPolicy='strict-origin-when-cross-origin' className='aspect-video h-full w-full border-0' src={`https://www.youtube-nocookie.com/embed/${content.reference}?autoplay=1`} allow='autoplay; fullscreen' allowFullScreen />;
	if (content.kind === "video" && content.mediaUrl) return <video onError={onError} aria-label={content.title} src={content.mediaUrl} className='max-h-full w-full' controls autoPlay playsInline />;
	if (content.kind === "audio" && content.mediaUrl)
		return (
			<div className='flex h-full flex-col items-center justify-center gap-6 p-6'>
				<h2 className='text-2xl font-semibold'>{content.title}</h2>
				<audio onError={onError} aria-label={content.title} src={content.mediaUrl} controls autoPlay className='w-full' />
			</div>
		);
	if ((content.kind === "image" || content.kind === "game") && (content.mediaUrl || content.thumbnailUrl))
		return (
			<div className='relative aspect-video h-full w-full'>
				<Image onError={onError} src={(content.mediaUrl || content.thumbnailUrl)!} unoptimized fill alt={content.title} className='object-contain' />
			</div>
		);
	return (
		<div className='flex min-h-64 flex-col items-center justify-center gap-5 p-8 text-center'>
			<h2 className='break-words text-3xl font-semibold'>{content.title}</h2>
			{content.description ? <p className='max-w-3xl whitespace-pre-wrap break-words text-xl text-muted'>{content.description}</p> : null}
			{content.kind === "link" && /^https:\/\//.test(content.reference) ? (
				<Link href={content.reference} target='_blank' rel='noopener noreferrer'>
					Open submitted link
				</Link>
			) : null}
			{content.kind === "person" ? (
				<Link href={`https://twitch.tv/${encodeURIComponent(content.reference)}`} target='_blank' rel='noopener noreferrer'>
					Open Twitch profile
				</Link>
			) : null}
		</div>
	);
}
function EventVoteShare({ percentage, votes, delay, label }: { percentage: number; votes?: number; delay?: number; label: string }) {
	const reduceMotion = useReducedMotion();
	const [shown, setShown] = useState(delay !== undefined && !reduceMotion ? 0 : percentage);
	useEffect(() => {
		if (delay === undefined || reduceMotion) return;
		const controls = animate(0, percentage, { delay, duration: 1.1, ease: "easeOut", onUpdate: setShown });
		return () => controls.stop();
	}, [percentage, delay, reduceMotion]);
	const value = delay === undefined || reduceMotion ? percentage : shown;
	return (
		<div>
			<ProgressBar size='sm' aria-label={`Vote share for ${label}`} value={Math.max(0, Math.min(100, value))}>
				<ProgressBar.Track>
					<ProgressBar.Fill />
				</ProgressBar.Track>
			</ProgressBar>
			<p className='mt-1 text-sm tabular-nums text-muted'>
				{new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}%{votes !== undefined ? ` (${new Intl.NumberFormat().format(votes)} ${votes === 1 ? "vote" : "votes"})` : ""}
			</p>
		</div>
	);
}
export function EventNomineeCard({ candidate, selected = false, disabled = false, onSelect, onOpen, result, resultDelay, compact = false, rank }: { candidate: { id: string; content: EventCandidateContent }; selected?: boolean; disabled?: boolean; onSelect?: (selected: boolean) => void; onOpen: () => void; resultDelay?: number; compact?: boolean; rank?: number; result?: { percentage?: number; winner: boolean; votes?: number } }) {
	const label = candidate.content.title;
	const winner = result?.winner;
	return (
		<div className={`overflow-hidden rounded-2xl border ${winner ? "border-accent bg-surface ring-2 ring-accent" : selected ? "border-accent bg-accent/5" : "border-separator bg-surface"}`}>
			<div className='relative aspect-video'>
				<Button data-award-candidate={candidate.id} aria-label={`View ${candidate.content.title}`} variant='tertiary' className='relative h-full w-full overflow-hidden rounded-none p-0' onPress={onOpen}>
					{candidate.content.thumbnailUrl || (candidate.content.kind === "image" && candidate.content.mediaUrl) ? (
						<Image src={(candidate.content.thumbnailUrl || candidate.content.mediaUrl)!} alt='' unoptimized fill loading='eager' className='object-cover' />
					) : (
						<motion.span layout='position' className='line-clamp-3 max-w-full whitespace-normal break-words px-5 text-center text-lg font-medium'>
							{candidate.content.title}
						</motion.span>
					)}
				</Button>
				{winner || rank ? <span className='pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground'>{winner ? "Winner" : `#${rank}`}</span> : null}
			</div>
			<motion.div layout='position' className={`space-y-2 ${compact ? "p-2 text-sm" : "p-4"}`}>
				{onSelect ? (
					<Checkbox aria-label={`Vote for ${candidate.content.title}`} isSelected={selected} isDisabled={disabled} onChange={onSelect} className='w-full'>
						<Checkbox.Content>
							<Checkbox.Control>
								<Checkbox.Indicator />
							</Checkbox.Control>
							<span className='break-words font-medium'>{candidate.content.title}</span>
						</Checkbox.Content>
					</Checkbox>
				) : (
					<div className='space-y-2'>
						<h3 className={`line-clamp-2 break-words font-medium ${compact ? "min-h-10" : result?.percentage !== undefined ? "min-h-12" : ""}`}>{label}</h3>
						{selected ? <p className='text-sm font-medium text-accent'>Your selection</p> : null}
					</div>
				)}
				{result?.percentage !== undefined || compact ? <div className={compact ? "h-9" : undefined}>{result?.percentage !== undefined ? <EventVoteShare percentage={result.percentage} votes={result.votes} delay={resultDelay} label={label} /> : null}</div> : null}
			</motion.div>
		</div>
	);
}
