"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import Image from "next/image";
import landingPlayback from "../../../../public/landing-playback.png";
import { trackEvent, trackProductEvent } from "@lib/analytics";
import { IconPlayerPlayFilled, IconPlayerPause, IconRefresh, IconVolumeOff, IconPlayerSkipForward } from "@tabler/icons-react";

type DemoStatus = "idle" | "loading" | "playing" | "paused" | "error";

export default function DemoPlayer() {
	const containerRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const documentCleanup = useRef<(() => void) | null>(null);
	const [status, setStatus] = useState<DemoStatus>("idle");
	const active = status === "loading" || status === "playing";

	useEffect(() => {
		const pause = () => setStatus((current) => (current === "loading" || current === "playing" ? "paused" : current));
		const onVisibilityChange = () => {
			if (document.hidden) pause();
		};
		const observer = new IntersectionObserver((entries) => {
			const entry = entries.at(-1);
			if (entry && !entry.isIntersecting) pause();
		});
		if (containerRef.current) observer.observe(containerRef.current);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	useEffect(() => {
		if (status !== "loading") return;
		const timeout = window.setTimeout(() => setStatus("error"), 20_000);
		return () => window.clearTimeout(timeout);
	}, [status]);

	useEffect(
		() => () => {
			documentCleanup.current?.();
		},
		[active],
	);

	useEffect(() => {
		if (status === "error") trackProductEvent("demo_failed", { placement: "hero" });
	}, [status]);

	const onPlayerLoad = () => {
		documentCleanup.current?.();
		const playerDocument = iframeRef.current?.contentDocument;
		if (!playerDocument || /Overlay not found|Overlay paused/.test(playerDocument.body?.textContent ?? "")) {
			setStatus("error");
			return;
		}
		let tracked = false;
		const onPlaying = () => {
			if (!tracked) {
				tracked = true;
				trackProductEvent("demo_playing", { placement: "hero" });
			}
			setStatus("playing");
		};
		playerDocument.addEventListener("playing", onPlaying, true);
		documentCleanup.current = () => playerDocument.removeEventListener("playing", onPlaying, true);
		if (Array.from(playerDocument.querySelectorAll("video")).some((video) => !video.paused && video.readyState >= 2)) onPlaying();
	};

	return (
		<div ref={containerRef} id='demo' className='min-w-0 scroll-mt-24'>
			<div className='overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl shadow-black/25'>
				<div className='flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-xs text-zinc-300'>
					<span className='flex items-center gap-2'>
						<span className='h-2 w-2 rounded-full bg-violet-400' aria-hidden='true' />
						Your BRB scene
					</span>
					<span className='rounded-md bg-white/5 px-2 py-1 text-zinc-300'>Browser source</span>
				</div>
				<div className='relative aspect-video overflow-hidden bg-zinc-950'>
					<Image src={landingPlayback} alt='A Twitch gaming highlight playing through Clipify' fill sizes='(max-width: 1024px) 100vw, 650px' loading='eager' className='object-cover' />
					{active ? <iframe ref={iframeRef} src='/demoPlayer' title='Clipify playback demo' referrerPolicy='strict-origin-when-cross-origin' allow='autoplay' onLoad={onPlayerLoad} className='absolute inset-0 h-full w-full border-0' /> : null}
					{status !== "playing" ? (
						<div className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-5 text-center text-white'>
							{status === "loading" ? (
								<>
									<Spinner className='text-white' />
									<p role='status' className='text-sm'>
										Loading your clip preview…
									</p>
								</>
							) : (
								<>
									<p className='text-xl font-semibold sm:text-2xl'>{status === "error" ? "The demo couldn't load" : status === "paused" ? "Ready when you are" : "Your highlights. Still on stream."}</p>
									<Button
										variant='primary'
										size='lg'
										onPress={() => {
											trackEvent("demo_requested", { placement: "hero", action: status === "idle" ? "start" : status === "error" ? "retry" : "resume" });
											setStatus("loading");
										}}
										className='bg-white text-violet-950 hover:bg-violet-100'
									>
										{status === "error" ? <IconRefresh size={18} /> : <IconPlayerPlayFilled size={18} />}
										{status === "error" ? "Try demo again" : status === "paused" ? "Resume demo" : "Watch the demo"}
									</Button>
								</>
							)}
						</div>
					) : null}
				</div>
				<div className='flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-zinc-300'>
					<span className='flex items-center gap-2'>
						<IconVolumeOff size={16} aria-hidden='true' />
						Demo plays without sound
					</span>
					{active ? (
						<div className='ml-auto flex flex-wrap items-center gap-1'>
							{status === "playing" ? (
								<Button variant='ghost' size='sm' onPress={() => iframeRef.current?.contentWindow?.postMessage({ name: "skip", data: null }, window.location.origin)} className='text-white'>
									<IconPlayerSkipForward size={16} />
									Skip clip
								</Button>
							) : null}
							<Button autoFocus variant='ghost' size='sm' onPress={() => setStatus("paused")} className='text-white'>
								<IconPlayerPause size={16} />
								Pause demo
							</Button>
						</div>
					) : (
						<span className='text-zinc-400'>OBS scene preview</span>
					)}
				</div>
			</div>

			{status === "error" ? (
				<p role='alert' className='mt-2 text-center text-xs leading-relaxed text-violet-100'>
					Please try again. You can still explore Clipify and start free.
				</p>
			) : null}
			{status === "paused" ? (
				<p role='status' className='mt-1 text-center text-xs text-violet-100/80'>
					Demo paused to save bandwidth. Resume starts a new clip.
				</p>
			) : null}
		</div>
	);
}
