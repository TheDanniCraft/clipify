"use client";

import { getCreatorClipPage, getCreatorClipPlayback } from "@actions/creatorPage";
import AppDateRangePicker from "@components/appDateRangePicker";
import { Button, Card, Label, ListBox, Select } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { IconArrowLeft, IconArrowRight, IconBrandTwitch, IconExternalLink, IconPlayerPlayFilled, IconX } from "@tabler/icons-react";
import type { TwitchClip } from "@types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Creator = {
	username: string;
	avatar: string;
	description: string;
	createdAt: Date | string;
	visibility: "discoverable" | "unlisted";
	twitchBadge: string | null;
	clipifyBadge: string;
	live: { title: string; game_name: string; viewer_count: number; started_at: string } | null;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const clipDateFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

function ClipDialog({ username, clips, index, onIndexChange, onClose }: { username: string; clips: TwitchClip[]; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [playbackUrl, setPlaybackUrl] = useState<string | null | undefined>();
	const clip = clips[index];
	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) dialog.showModal();
	}, []);
	useEffect(() => {
		let cancelled = false;
		void getCreatorClipPlayback(username, clip.id)
			.then((data) => {
				if (!cancelled) setPlaybackUrl(data?.playbackUrl ?? null);
			})
			.catch(() => {
				if (!cancelled) setPlaybackUrl(null);
			});
		return () => {
			cancelled = true;
		};
	}, [clip.id, username]);
	useEffect(() => {
		const keydown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.matches("input,textarea,select,[contenteditable=true]")) return;
			if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
			if (event.key === "ArrowRight" && index < clips.length - 1) onIndexChange(index + 1);
		};
		window.addEventListener("keydown", keydown);
		return () => window.removeEventListener("keydown", keydown);
	}, [clips.length, index, onIndexChange]);
	return (
		<dialog ref={dialogRef} onClose={onClose} className='m-auto h-dvh w-screen max-w-none bg-transparent p-0 backdrop:bg-black/75 sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:w-[min(960px,calc(100vw-48px))] sm:rounded-2xl'>
			<section className='flex h-full flex-col overflow-hidden bg-zinc-950 text-white sm:h-auto sm:rounded-2xl'>
				<header className='flex items-center justify-between gap-3 p-4'>
					<div className='min-w-0'>
						<h1 className='truncate font-semibold'>{clip.title}</h1>
						<p className='text-sm text-zinc-400'>{clip.creator_name}</p>
					</div>
					<Button isIconOnly variant='tertiary' aria-label='Close clip' onPress={onClose}>
						<IconX />
					</Button>
				</header>
				<div className='relative flex aspect-video w-full shrink-0 items-center justify-center bg-black'>
					{playbackUrl ? (
						<video key={clip.id} src={playbackUrl} poster={clip.thumbnail_url} controls autoPlay playsInline className='h-full w-full object-contain' />
					) : playbackUrl === undefined ? (
						<span className='text-zinc-400'>Loading clip…</span>
					) : (
						<div className='text-center'>
							<p className='mb-3'>Playback is unavailable.</p>
							<Button variant='primary' onPress={() => window.open(clip.url, "_blank", "noopener,noreferrer")}>
								Watch on Twitch
							</Button>
						</div>
					)}
				</div>
				<footer className='flex items-center gap-2 p-4'>
					<Button isIconOnly variant='secondary' aria-label='Previous clip' isDisabled={index === 0} onPress={() => onIndexChange(index - 1)}>
						<IconArrowLeft />
					</Button>
					<Button isIconOnly variant='secondary' aria-label='Next clip' isDisabled={index === clips.length - 1} onPress={() => onIndexChange(index + 1)}>
						<IconArrowRight />
					</Button>
					<span className='text-sm text-zinc-400'>
						{index + 1} / {clips.length}
					</span>
					<div className='flex-1' />
					<Button variant='tertiary' onPress={() => window.open(clip.url, "_blank", "noopener,noreferrer")}>
						Watch on Twitch <IconExternalLink size={16} />
					</Button>
				</footer>
			</section>
		</dialog>
	);
}

export default function CreatorPageClient({ creator, initialItems, initialCursor, today }: { creator: Creator; initialItems: TwitchClip[]; initialCursor: string | null; today: string }) {
	const todayDate = new Date(`${today}T00:00:00Z`);
	const date = (offsetDays: number) => parseDate(new Date(todayDate.getTime() - offsetDays * 86_400_000).toISOString().slice(0, 10));
	const [clips, setClips] = useState(initialItems);
	const [cursor, setCursor] = useState(initialCursor);
	const [sort, setSort] = useState<"most_viewed" | "newest">("most_viewed");
	const [range, setRange] = useState<{ start: ReturnType<typeof parseDate>; end: ReturnType<typeof parseDate> } | null>(() => ({ start: date(30), end: date(0) }));
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const sentinel = useRef<HTMLDivElement>(null);
	const load = useCallback(
		async (nextCursor: string | null, replace = false, nextSort = sort, nextRange = range) => {
			setLoading(true);
			try {
				const data = await getCreatorClipPage(creator.username, {
					sort: nextSort,
					start: nextRange ? new Date(`${nextRange.start.toString()}T00:00:00Z`) : null,
					end: nextRange ? new Date(`${nextRange.end.toString()}T00:00:00Z`) : null,
					cursor: nextCursor,
					pageSize: 24,
				});
				if (!data) return;
				setClips((current) => (replace ? data.items : [...current, ...data.items.filter((item) => !current.some((entry) => entry.id === item.id))]));
				setCursor(data.nextCursor);
			} finally {
				setLoading(false);
			}
		},
		[creator.username, range, sort],
	);
	const changeSort = (nextSort: "most_viewed" | "newest") => {
		setSort(nextSort);
		void load(null, true, nextSort, range);
	};
	const changeRange = (nextRange: typeof range) => {
		setRange(nextRange);
		void load(null, true, sort, nextRange);
	};
	useEffect(() => {
		if (!cursor || loading || !sentinel.current) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) void load(cursor);
			},
			{ rootMargin: "400px" },
		);
		observer.observe(sentinel.current);
		return () => observer.disconnect();
	}, [cursor, load, loading]);
	const presets = [
		{ label: "Last 7 days", value: { start: date(7), end: date(0) } },
		{ label: "Last 30 days", value: { start: date(30), end: date(0) } },
		{ label: "Last year", value: { start: date(365), end: date(0) } },
		{ label: "All time", value: null },
	];
	return (
		<main className='mx-auto min-h-dvh w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
			<div className='grid gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]'>
				<aside>
					<Card className='sticky top-6'>
						<Card.Content className='space-y-4 p-6'>
							<img src={creator.avatar} alt='' className='size-24 rounded-full object-cover' />
							<div>
								<div className='flex items-center gap-2'>
									<h1 className='text-2xl font-bold'>{creator.username}</h1>
									{creator.live ? <span className='rounded-full bg-danger px-2 py-1 text-xs font-bold text-white'>LIVE</span> : null}
								</div>
								<div className='mt-2 flex flex-wrap gap-2'>
									{creator.twitchBadge ? <span className='rounded-full bg-secondary px-2 py-1 text-xs'>{creator.twitchBadge}</span> : null}
									<span className='rounded-full bg-brand-500/15 px-2 py-1 text-xs text-brand-400'>{creator.clipifyBadge}</span>
								</div>
							</div>
							{creator.description ? <p className='text-sm text-muted'>{creator.description}</p> : null}
							{creator.live ? (
								<div className='rounded-xl bg-danger/10 p-3'>
									<p className='font-semibold'>{creator.live.title}</p>
									<p className='text-xs text-muted'>
										{creator.live.game_name} · {numberFormatter.format(creator.live.viewer_count)} viewers
									</p>
								</div>
							) : null}
							<Button variant='primary' onPress={() => window.open(`https://twitch.tv/${encodeURIComponent(creator.username)}`, "_blank", "noopener,noreferrer")}>
								<IconBrandTwitch size={18} /> Twitch profile
							</Button>
						</Card.Content>
					</Card>
				</aside>
				<section className='min-w-0'>
					<div className='mb-5 flex flex-col gap-4 sm:flex-row sm:items-end'>
						<Select className='w-[256px]' value={sort} onChange={(value) => changeSort(String(value) === "newest" ? "newest" : "most_viewed")}>
							<Label>Sort clips</Label>
							<Select.Trigger>
								<Select.Value />
								<Select.Indicator />
							</Select.Trigger>
							<Select.Popover>
								<ListBox>
									<ListBox.Item id='most_viewed' textValue='Most viewed'>
										Most viewed
										<ListBox.ItemIndicator />
									</ListBox.Item>
									<ListBox.Item id='newest' textValue='Newest'>
										Newest
										<ListBox.ItemIndicator />
									</ListBox.Item>
								</ListBox>
							</Select.Popover>
						</Select>
						<AppDateRangePicker label='Date range' value={range} onChange={(value) => changeRange(value as typeof range)} presets={presets} />
					</div>
					{clips.length ? (
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
							{clips.map((clip, index) => (
								<button key={clip.id} type='button' className='group overflow-hidden rounded-2xl border border-divider bg-surface text-left transition hover:-translate-y-0.5 hover:shadow-lg' onClick={() => setSelectedIndex(index)}>
									<div className='relative aspect-video overflow-hidden bg-black'>
										<img src={clip.thumbnail_url} alt='' loading='lazy' className='h-full w-full object-cover transition group-hover:scale-[1.02]' />
										<span className='absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100'>
											<span className='grid size-12 place-items-center rounded-full bg-black/70 text-white'>
												<IconPlayerPlayFilled />
											</span>
										</span>
									</div>
									<div className='p-4'>
										<h2 className='line-clamp-2 font-semibold'>{clip.title}</h2>
										<p className='mt-2 text-xs text-muted'>
											{numberFormatter.format(clip.view_count)} views · {clipDateFormatter.format(new Date(clip.created_at))}
										</p>
									</div>
								</button>
							))}
						</div>
					) : (
						<Card>
							<Card.Content className='p-8 text-center text-muted'>No clips match this date range.</Card.Content>
						</Card>
					)}
					<div ref={sentinel} className='h-8' />
					{loading ? <p className='text-center text-sm text-muted'>Loading more clips…</p> : null}
				</section>
			</div>
			<footer className='mt-12 border-t border-divider py-8 text-center text-sm text-muted'>
				Built with Clipify ·{" "}
				<Link href='/' className='text-primary hover:underline'>
					Create your own clip page
				</Link>
			</footer>
			{selectedIndex !== null ? <ClipDialog key={clips[selectedIndex].id} username={creator.username} clips={clips} index={selectedIndex} onIndexChange={setSelectedIndex} onClose={() => setSelectedIndex(null)} /> : null}
		</main>
	);
}
