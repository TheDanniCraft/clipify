"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Chip, Link, Popover } from "@heroui/react";
import { IconBrandTwitch } from "@tabler/icons-react";
import { getPublicCommunityCreatorStatsAction } from "@actions/community";
import { getCommunityAvatarTone } from "@lib/communityAvatarTone";
import type { CommunityCreatorStats, CommunityPageStreamer } from "@lib/community-types";

export default function CreatorAvatar({ streamer, isOpen, pinned, onOpenChange }: { streamer: CommunityPageStreamer; isOpen: boolean; pinned: boolean; onOpenChange: (open: boolean, pinned?: boolean) => void }) {
	const tone = getCommunityAvatarTone(streamer);
	const membership = streamer.partner ? "Partner" : streamer.plan === "pro" ? "Pro" : "Free";
	const status = streamer.status === "live_with_overlay" ? "Live with Clipify" : streamer.status === "live" ? "Live on Twitch" : "Offline";
	const [stats, setStats] = useState<CommunityCreatorStats | null>(null);
	const [attempt, setAttempt] = useState(0);
	const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const pressing = useRef(false);
	const suppressHover = useRef(false);
	const dialogRef = useRef<HTMLElement | null>(null);
	const ProfileDialog = pinned ? Popover.Dialog : "div";
	const clearTimers = () => {
		clearTimeout(openTimer.current);
		clearTimeout(closeTimer.current);
	};
	const changeOpen = (open: boolean, pin = false) => {
		clearTimers();
		if (open && !isOpen) setStats(null);
		onOpenChange(open, pin);
	};
	const closePreview = () => {
		clearTimers();
		if (!pinned) closeTimer.current = setTimeout(() => onOpenChange(false), 250);
	};
	useEffect(
		() => () => {
			clearTimeout(openTimer.current);
			clearTimeout(closeTimer.current);
		},
		[],
	);
	useEffect(() => {
		if (isOpen && pinned) dialogRef.current?.focus({ preventScroll: true });
	}, [isOpen, pinned]);
	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		void getPublicCommunityCreatorStatsAction(streamer.id)
			.then((result) => {
				if (!cancelled) setStats(result);
			})
			.catch(() => {
				if (!cancelled) setStats({ status: "unavailable" });
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen, streamer.id, attempt]);
	return (
		<Popover
			isOpen={isOpen}
			onOpenChange={(open) => {
				const nextOpen = open || (pressing.current && isOpen && !pinned);
				suppressHover.current = !nextOpen;
				changeOpen(nextOpen, true);
			}}
		>
			<Button
				isIconOnly
				variant='ghost'
				aria-label={`${streamer.displayName} creator`}
				className='size-11 min-w-11 overflow-visible rounded-full p-0'
				onHoverStart={() => {
					if (suppressHover.current) return;
					clearTimers();
					openTimer.current = setTimeout(() => changeOpen(true), 150);
				}}
				onHoverEnd={() => {
					suppressHover.current = false;
					closePreview();
				}}
				onBlur={(event) => {
					if (!dialogRef.current?.contains(event.relatedTarget)) closePreview();
				}}
				onPressStart={() => {
					clearTimers();
					pressing.current = true;
				}}
				onPressEnd={() =>
					queueMicrotask(() => {
						pressing.current = false;
					})
				}
			>
				<Avatar size='sm' role='img' aria-label={`${streamer.displayName}: ${tone.label}`} color={tone.color} variant='soft' className={`rounded-full ring-2 ring-offset-2 ring-offset-background ${tone.color === "default" ? "ring-muted" : tone.ringClass}`}>
					<Avatar.Image alt='' src={streamer.avatar} />
					<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
				</Avatar>
			</Button>
			<Popover.Content placement='bottom start' offset={10} isNonModal={!pinned} trigger={pinned ? "DialogTrigger" : "PreviewTrigger"} className='w-72 max-w-[calc(100vw-2rem)]'>
				<ProfileDialog
					ref={(node: HTMLElement | null) => {
						dialogRef.current = node;
					}}
					role='dialog'
					aria-label={`${streamer.displayName} profile`}
					className='p-4 outline-none'
				>
					<div
						className='space-y-4'
						onPointerEnter={clearTimers}
						onPointerLeave={closePreview}
						onFocusCapture={clearTimers}
						onBlurCapture={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget)) closePreview();
						}}
					>
						<div className='flex items-start gap-3'>
							<Avatar className='size-12 shrink-0' color={tone.color} variant='soft'>
								<Avatar.Image alt='' src={streamer.avatar} />
								<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
							</Avatar>
							<div className='min-w-0'>
								<Popover.Heading className='break-words text-base font-semibold'>{streamer.displayName}</Popover.Heading>
								<p className='mt-1 break-all text-sm text-muted'>@{streamer.username}</p>
							</div>
						</div>
						<div className='flex flex-wrap items-center gap-2'>
							<Chip size='sm' variant='tertiary' color={streamer.partner || streamer.plan === "pro" ? "accent" : "default"}>
								{membership}
							</Chip>
							<span className='text-sm text-muted'>{status}</span>
						</div>
						{stats?.status === "ready" ? (
							<p className='text-sm text-muted'>
								<span className='font-semibold text-foreground'>{stats.clipCount.toLocaleString()}</span> {stats.clipCount === 1 ? "clip" : "clips"} on Clipify
							</p>
						) : stats?.status === "unavailable" ? (
							<div className='flex flex-wrap items-center gap-2'>
								<p role='status' className='text-sm text-muted'>
									Clip count unavailable
								</p>
								<Button
									size='sm'
									variant='secondary'
									onPress={() => {
										setStats(null);
										setAttempt((value) => value + 1);
									}}
								>
									Retry
								</Button>
							</div>
						) : (
							<p role='status' className='text-sm text-muted'>
								Loading clip count…
							</p>
						)}
						<div className='flex flex-wrap items-center gap-x-5 gap-y-3'>
							{streamer.profileUrl ? (
								<Link href={streamer.profileUrl} className='text-sm'>
									Creator Page <Link.Icon />
								</Link>
							) : null}
							{streamer.partner || streamer.plan === "pro" ? (
								<Link href={streamer.twitchUrl} target='_blank' rel='noreferrer' className='gap-2 text-sm text-foreground'>
									<IconBrandTwitch className='size-4' aria-hidden='true' />
									Open Twitch
								</Link>
							) : null}
						</div>
					</div>
				</ProfileDialog>
			</Popover.Content>
		</Popover>
	);
}
