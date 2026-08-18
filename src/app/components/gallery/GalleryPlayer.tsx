"use client";

import { Carousel } from "@heroui-pro/react/carousel";
import { Button } from "@heroui/react";
import { IconPlayerPauseFilled, IconPlayerPlayFilled, IconRefresh, IconVolume, IconVolumeOff, IconX } from "@tabler/icons-react";
import type { Gallery, TwitchClip } from "@types";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePlausible } from "next-plausible";
import { PLAUSIBLE_EVENTS } from "@lib/plausibleEvents";
import { useQualifiedPlayback } from "@/app/hooks/useQualifiedPlayback";

type CarouselApi = {
	on: (event: "select", callback: () => void) => void;
	off: (event: "select", callback: () => void) => void;
	selectedScrollSnap: () => number;
	scrollPrev: () => void;
	scrollNext: () => void;
};

type PlayerBootstrapInit = {
	data: {
		version: number;
		type: string;
		elementType: string;
		resourceId: string;
		clipId: string;
		styles?: Record<string, string>;
	};
	port: MessagePort;
};

type PlayerBootstrapState = {
	pendingInit: PlayerBootstrapInit | null;
	listenerInstalled: boolean;
};

type Props = {
	gallery: Gallery;
	clips: TwitchClip[];
	initialIndex: number;
	initialPlaybackUrl: string | null;
	ownerName: string;
	showAttribution: boolean;
};

const PROTOCOL_VERSION = 1;

export default function GalleryPlayer({ gallery, clips, initialIndex, initialPlaybackUrl, ownerName, showAttribution }: Props) {
	const [selectedIndex, setSelectedIndex] = useState(initialIndex);
	const [playbackUrls, setPlaybackUrls] = useState<Record<string, string | null>>(initialPlaybackUrl ? { [clips[initialIndex].id]: initialPlaybackUrl } : {});
	const [loading, setLoading] = useState(!initialPlaybackUrl);
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [volume, setVolume] = useState(0.8);
	const [elapsed, setElapsed] = useState(0);
	const [duration, setDuration] = useState(clips[initialIndex].duration);
	const [api, setApi] = useState<CarouselApi | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const shellRef = useRef<HTMLDivElement | null>(null);
	const portRef = useRef<MessagePort | null>(null);
	const clip = clips[selectedIndex];
	const playbackUrl = playbackUrls[clip.id];
	const plausible = usePlausible();
	const qualifiedPlayback = useQualifiedPlayback(clip.id, () => {
		plausible(PLAUSIBLE_EVENTS.clipPlayed, { props: { surface: "gallery", galleryId: gallery.id, clipId: clip.id } });
	});
	const syncPlayingState = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		setPlaying(!video.paused && !video.ended);
	}, []);
	const consumeBootstrapInit = useCallback(() => {
		const bootstrap = window as Window & { __clipifyPlayerBootstrap?: PlayerBootstrapState };
		const pendingInit = bootstrap.__clipifyPlayerBootstrap?.pendingInit;
		if (!pendingInit) return false;
		const { data, port } = pendingInit;
		if (data.version !== PROTOCOL_VERSION || data.type !== "clipify:init" || data.elementType !== "player" || data.resourceId !== gallery.id || data.clipId !== clips[initialIndex].id) return false;
		bootstrap.__clipifyPlayerBootstrap!.pendingInit = null;
		portRef.current?.close();
		portRef.current = port;
		portRef.current.start();
		portRef.current.postMessage({ version: PROTOCOL_VERSION, type: "ready", elementType: "player", resourceId: gallery.id, clipId: clips[initialIndex].id });
		window.requestAnimationFrame(() => {
			const height = Math.ceil(shellRef.current?.getBoundingClientRect().height ?? 0);
			if (height) portRef.current?.postMessage({ version: PROTOCOL_VERSION, type: "resize", elementType: "player", resourceId: gallery.id, height });
		});
		return true;
	}, [clips, gallery.id, initialIndex]);
	const closePlayer = useCallback(() => {
		portRef.current?.postMessage({ version: PROTOCOL_VERSION, type: "close", elementType: "player", resourceId: gallery.id });
	}, [gallery.id]);

	useEffect(() => {
		if (videoRef.current) videoRef.current.volume = volume;
	}, [playbackUrl, selectedIndex, volume]);

	useLayoutEffect(() => {
		syncPlayingState();
	}, [playbackUrl, selectedIndex, syncPlayingState]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		const syncPlaying = () => setPlaying(true);
		const syncPaused = () => setPlaying(false);
		video.addEventListener("play", syncPlaying);
		video.addEventListener("playing", syncPlaying);
		video.addEventListener("pause", syncPaused);
		video.addEventListener("ended", syncPaused);
		syncPlayingState();
		return () => {
			video.removeEventListener("play", syncPlaying);
			video.removeEventListener("playing", syncPlaying);
			video.removeEventListener("pause", syncPaused);
			video.removeEventListener("ended", syncPaused);
		};
	}, [playbackUrl, selectedIndex, syncPlayingState]);

	useEffect(() => {
		consumeBootstrapInit();
		const onPlayerInit = () => {
			consumeBootstrapInit();
		};
		window.addEventListener("clipify:player-init", onPlayerInit);
		return () => {
			window.removeEventListener("clipify:player-init", onPlayerInit);
			portRef.current?.close();
		};
	}, [consumeBootstrapInit]);

	useEffect(() => {
		const surface = shellRef.current;
		if (!surface || typeof ResizeObserver === "undefined") return;
		let previousHeight = 0;
		let animationFrame = 0;
		const observer = new ResizeObserver(() => {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = window.requestAnimationFrame(() => {
				const height = Math.ceil(surface.getBoundingClientRect().height);
				if (height === previousHeight) return;
				previousHeight = height;
				portRef.current?.postMessage({ version: PROTOCOL_VERSION, type: "resize", elementType: "player", resourceId: gallery.id, height });
			});
		});
		observer.observe(surface);
		return () => {
			window.cancelAnimationFrame(animationFrame);
			observer.disconnect();
		};
	}, [gallery.id]);

	useEffect(() => {
		if (!api) return;
		const select = () => {
			const nextIndex = api.selectedScrollSnap();
			videoRef.current?.pause();
			setPlaying(false);
			setElapsed(0);
			setDuration(clips[nextIndex]?.duration ?? 0);
			setSelectedIndex(nextIndex);
		};
		api.on("select", select);
		return () => api.off("select", select);
	}, [api, clips]);

	useEffect(() => {
		if (!api) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (target instanceof Element && target.matches("input, textarea, select, [contenteditable=true]")) return;
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				api.scrollPrev();
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				api.scrollNext();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [api]);

	useEffect(() => {
		const onEscape = (event: KeyboardEvent) => {
			const target = event.target;
			if (event.key !== "Escape" || (target instanceof Element && target.matches("input, textarea, select, [contenteditable=true]"))) return;
			event.preventDefault();
			closePlayer();
		};
		window.addEventListener("keydown", onEscape, true);
		return () => window.removeEventListener("keydown", onEscape, true);
	}, [clip.id, closePlayer, gallery.id]);

	const loadSelected = useCallback(
		async (force = false) => {
			if (!force && clip.id in playbackUrls) return;
			setLoading(true);
			try {
				const response = await fetch(`/api/gallery/${encodeURIComponent(gallery.id)}/clip/${encodeURIComponent(clip.id)}`, { credentials: "omit" });
				if (!response.ok) throw new Error("Playback unavailable");
				const data = (await response.json()) as { playbackUrl?: string | null };
				setPlaybackUrls((current) => ({ ...current, [clip.id]: data.playbackUrl ?? null }));
			} catch {
				setPlaybackUrls((current) => ({ ...current, [clip.id]: null }));
			} finally {
				setLoading(false);
			}
		},
		[clip.id, gallery.id, playbackUrls],
	);

	useEffect(() => {
		const loadTimer = window.setTimeout(() => void loadSelected(), 0);
		portRef.current?.postMessage({ version: PROTOCOL_VERSION, type: "clip-sequence", elementType: "player", resourceId: gallery.id, clipId: clip.id, index: selectedIndex });
		return () => window.clearTimeout(loadTimer);
	}, [clip.id, gallery.id, initialIndex, loadSelected, selectedIndex]);

	const togglePlayback = async () => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			setPlaying(true);
			try {
				await video.play();
			} catch {
				setPlaying(false);
			}
		} else {
			video.pause();
			setPlaying(false);
			syncPlayingState();
		}
	};

	return (
		<div ref={shellRef} className='flex w-full items-center justify-center bg-transparent p-0 sm:p-6'>
			<section className='flex w-full max-w-[var(--clipify-modal-width,960px)] flex-col overflow-hidden bg-zinc-950 text-white shadow-2xl sm:rounded-2xl' style={{ "--clipify-modal-width": `${gallery.desktopModalWidth}px` } as CSSProperties}>
				<header className='flex items-center justify-between gap-3 px-4 py-3'>
					<div className='min-w-0'>
						<h1 className='truncate text-sm font-semibold'>{clip.title}</h1>
						<p className='truncate text-xs text-zinc-400'>{clip.creator_name}</p>
					</div>
					<Button isIconOnly aria-label='Close player' variant='tertiary' onPress={closePlayer}>
						<IconX size={20} />
					</Button>
				</header>
				<div className='w-full shrink-0 px-0 sm:px-4'>
					<Carousel type='modal' opts={{ startIndex: initialIndex }} setApi={(nextApi: unknown) => setApi(nextApi as CarouselApi)}>
						<Carousel.Content>
							{clips.map((item, index) => (
								<Carousel.Item key={item.id}>
									<div className='flex aspect-video w-full items-center justify-center overflow-hidden bg-black sm:rounded-xl'>
										{index === selectedIndex && playbackUrl ? (
											<video
												ref={videoRef}
												src={playbackUrl}
												className='h-full w-full object-contain'
												playsInline
												autoPlay
												preload='metadata'
												muted={muted}
												onPlaying={qualifiedPlayback.onPlaying}
												onPause={qualifiedPlayback.onPause}
												onWaiting={qualifiedPlayback.onWaiting}
												onEnded={qualifiedPlayback.onEnded}
												onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
												onDurationChange={(event) => setDuration(event.currentTarget.duration || item.duration)}
												onError={() => setPlaybackUrls((current) => ({ ...current, [item.id]: null }))}
											/>
										) : null}
										{index === selectedIndex && loading ? <span className='text-sm text-zinc-400'>Loading clip…</span> : null}
										{index === selectedIndex && !loading && !playbackUrl ? (
											<div className='flex flex-col items-center gap-3'>
												<span>Playback failed.</span>
												<div className='flex gap-2'>
													<Button variant='secondary' onPress={() => void loadSelected(true)}>
														<IconRefresh size={16} />
														Retry
													</Button>
													<Button variant='primary' onPress={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
														Watch on Twitch
													</Button>
												</div>
											</div>
										) : null}
										{index !== selectedIndex && Math.abs(index - selectedIndex) <= 1 ? <img src={item.thumbnail_url} alt='' className='h-full w-full object-cover opacity-55' loading='eager' /> : null}
									</div>
								</Carousel.Item>
							))}
						</Carousel.Content>
						<Carousel.Previous />
						<Carousel.Next />
						<Carousel.Dots />
					</Carousel>
				</div>
				<div className='flex items-center gap-3 px-4 py-3'>
					<Button isIconOnly aria-label={playing ? "Pause" : "Play"} variant='secondary' onPress={() => void togglePlayback()}>
						{playing ? <IconPlayerPauseFilled size={20} /> : <IconPlayerPlayFilled size={20} />}
					</Button>
					<input
						aria-label='Seek'
						type='range'
						min={0}
						max={Math.max(duration, 1)}
						step={0.1}
						value={Math.min(elapsed, duration || 0)}
						className='min-w-0 flex-1 accent-violet-500'
						onChange={(event) => {
							const value = Number(event.currentTarget.value);
							if (videoRef.current) videoRef.current.currentTime = value;
							setElapsed(value);
						}}
					/>
					<span className='w-24 text-right text-xs text-zinc-400'>
						{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}
					</span>
					<Button
						isIconOnly
						aria-label={muted ? "Unmute" : "Mute"}
						variant='tertiary'
						onPress={() => {
							const next = !muted;
							setMuted(next);
							if (videoRef.current) videoRef.current.muted = next;
						}}
					>
						{muted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
					</Button>
					<input
						aria-label='Volume'
						type='range'
						min={0}
						max={1}
						step={0.05}
						value={volume}
						className='hidden w-24 accent-violet-500 sm:block'
						onChange={(event) => {
							const next = Number(event.currentTarget.value);
							setVolume(next);
							setMuted(next === 0);
							if (videoRef.current) {
								videoRef.current.volume = next;
								videoRef.current.muted = next === 0;
							}
						}}
					/>
				</div>
				{showAttribution ? (
					<a className='mx-auto mb-3 inline-flex rounded-full bg-accent px-3 py-1.5 text-center text-xs font-semibold text-accent-foreground hover:underline' href={`https://clipify.us/gallery?utm_source=clipify_gallery&utm_medium=attribution&utm_campaign=${encodeURIComponent(gallery.id)}`} target='_blank' rel='noreferrer'>
						Clip gallery by {ownerName} · Powered by Clipify
					</a>
				) : null}
			</section>
		</div>
	);
}
