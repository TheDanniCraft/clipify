"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipQueueItem, ModQueueItem, Overlay, TwitchClip, TwitchClipGqlData, TwitchClipGqlResponse, TwitchClipVideoQuality, VideoClip } from "@types";
import { getAvatar, getDemoClip, getGameDetails, getTwitchClip, subscribeToChat } from "@actions/twitch";
import PlayerOverlay from "@components/playerOverlay";
import { Avatar, Button, Link } from "@heroui/react";
import { motion } from "framer-motion";
import axios from "axios";
import { getFirstFromClipQueue, getFirstFromModQueue, removeFromClipQueue, removeFromModQueue } from "@actions/database";
import Logo from "@components/logo";
import { IconPlayerPlayFilled, IconVolume, IconVolumeOff } from "@tabler/icons-react";

type VideoQualityWithNumeric = TwitchClipVideoQuality & { numericQuality: number };

async function getRawMediaUrl(clipId: string): Promise<string | undefined> {
	const query = [
		{
			operationName: "VideoAccessToken_Clip",
			variables: {
				platform: "web",
				slug: clipId,
			},
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash: "993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5",
				},
			},
		},
	];

	try {
		const res = await axios.post<TwitchClipGqlResponse>("https://gql.twitch.tv/gql", query, {
			headers: {
				"Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
				"Content-Type": "application/json",
			},
		});

		const clipData = res.data[0]?.data?.clip as TwitchClipGqlData | undefined;

		if (!clipData || !clipData.videoQualities || clipData.videoQualities.length === 0) {
			console.error("Invalid clip data or no video qualities available.");
			return undefined;
		}

		const videoQualities: TwitchClipVideoQuality[] = clipData.videoQualities;

		const sortedByQuality: VideoQualityWithNumeric[] = videoQualities
			.map((v) => ({
				...v,
				numericQuality: parseInt(v.quality, 10),
			}))
			.sort((a, b) => b.numericQuality - a.numericQuality);

		const bestQuality = sortedByQuality[0];
		if (!bestQuality) return undefined;

		const clipsVideoSource = bestQuality.sourceURL;
		const clipsSignature = clipData.playbackAccessToken.signature;
		const clipsToken = encodeURIComponent(clipData.playbackAccessToken.value);

		return `${clipsVideoSource}?sig=${clipsSignature}&token=${clipsToken}`;
	} catch (error) {
		console.error("Error fetching raw media URL", error);
		return undefined;
	}
}

function isInIframe() {
	return window.self !== window.top;
}

/**
 * Fetch everything needed to play a clip, in parallel where possible.
 */
async function buildVideoClip(randomClip: TwitchClip, isDemoPlayer: boolean): Promise<VideoClip | null> {
	const mediaUrlPromise = getRawMediaUrl(randomClip.id);

	const avatarPromise = isDemoPlayer ? Promise.resolve("") : getAvatar(randomClip.broadcaster_id, randomClip.broadcaster_id);

	const gamePromise = isDemoPlayer
		? Promise.resolve({
				id: "",
				name: "Demo Mode",
				box_art_url: "",
				igdb_id: "",
			})
		: getGameDetails(randomClip.game_id, randomClip.broadcaster_id);

	const [mediaUrl, brodcasterAvatar, game] = await Promise.all([mediaUrlPromise, avatarPromise, gamePromise]);

	if (!mediaUrl) return null;

	return {
		...randomClip,
		mediaUrl,
		brodcasterAvatar: brodcasterAvatar ?? "",
		game: game ?? {
			id: "",
			name: isDemoPlayer ? "Demo Mode" : "Unknown Game",
			box_art_url: "",
			igdb_id: "",
		},
	};
}

/**
 * Warm up browser buffering a bit by preloading the media URL.
 */
function preloadVideo(url: string) {
	try {
		const link = document.createElement("link");
		link.rel = "preload";
		link.as = "video";
		link.href = url;
		document.head.appendChild(link);
		setTimeout(() => link.remove(), 10_000);
	} catch {
		// ignore
	}
}

export default function OverlayPlayer({
	clips,
	overlay,
	isEmbed,
	showBanner,
	isDemoPlayer,
	embedMuted,
	embedAutoplay,
	overlaySecret,
}: {
	clips: TwitchClip[];
	overlay: Overlay;
	isEmbed?: boolean;
	showBanner?: boolean;
	isDemoPlayer?: boolean;
	embedMuted?: boolean;
	embedAutoplay?: boolean;
	overlaySecret?: string;
}) {
	const CROSSFADE_SECONDS = 0.7;
	const CROSSFADE_MS = Math.round(CROSSFADE_SECONDS * 1000);
	const SHOW_FADE_SECONDS = 0.6;

	const [videoClip, setVideoClip] = useState<VideoClip | null>(null);
	const [nextClip, setNextClip] = useState<VideoClip | null>(null);
	const [incomingClip, setIncomingClip] = useState<VideoClip | null>(null);
	const [isCrossfading, setIsCrossfading] = useState<boolean>(false);
	const [activeSlot, setActiveSlot] = useState<"a" | "b">("a");
	const [clipA, setClipA] = useState<VideoClip | null>(null);
	const [clipB, setClipB] = useState<VideoClip | null>(null);

	const [playedClips, setPlayedClips] = useState<string[]>([]);
	const playedClipsRef = useRef<string[]>([]);
	useEffect(() => {
		playedClipsRef.current = playedClips;
	}, [playedClips]);

	const nextClipRef = useRef<VideoClip | null>(null);
	useEffect(() => {
		nextClipRef.current = nextClip;
	}, [nextClip]);

	const [showOverlay, setShowOverlay] = useState<boolean>(false);
	const [showPlayer, setShowPlayer] = useState<boolean>(true);
	const embedBehaviorEnabled = !!isEmbed && !isDemoPlayer;
	const [paused, setPaused] = useState<boolean>(embedBehaviorEnabled ? !embedAutoplay : false);
	const [isMuted, setIsMuted] = useState<boolean>(embedBehaviorEnabled ? !!embedMuted : false);
	const [hasUserStarted, setHasUserStarted] = useState<boolean>(!embedBehaviorEnabled || !!embedAutoplay);
	const [, setWebsocket] = useState<WebSocket | null>(null);

	const videoARef = useRef<HTMLVideoElement | null>(null);
	const videoBRef = useRef<HTMLVideoElement | null>(null);
	const clipRef = useRef<VideoClip | null>(null);

	// Demo queue support
	const [demoQueue, setDemoQueue] = useState<string[]>([]);

	// Prevent overlapping "advance" calls + stale async overwrites
	const advanceLockRef = useRef(false);
	const requestIdRef = useRef(0);

	// Prevent overlapping prefetches / stale updates
	const prefetchAbortRef = useRef<AbortController | null>(null);
	const crossfadeLockRef = useRef(false);

	const getFirstFromDemoQueue = useCallback(async () => {
		// NOTE: we read state via closure here; that’s fine, demo mode is explicit
		if (demoQueue.length === 0) return null;

		const raw = demoQueue[0].trim();
		let nextClipId = raw;

		try {
			const url = new URL(raw);
			const host = url.hostname.toLowerCase();

			if (!host.includes("twitch.tv") && !host.includes("clips.twitch.tv")) {
				setDemoQueue((prevQueue) => prevQueue.slice(1));
				return null;
			}

			const clipMatch = url.pathname.match(/\/clip\/([^\/\?]+)/);
			if (clipMatch && clipMatch[1]) {
				nextClipId = clipMatch[1];
			} else {
				const parts = url.pathname.split("/").filter(Boolean);
				if (parts.length > 0) nextClipId = parts[parts.length - 1];
			}
		} catch {
			if (!/^[A-Za-z0-9_-]+$/.test(raw)) {
				setDemoQueue((prevQueue) => prevQueue.slice(1));
				return null;
			}
			nextClipId = raw;
		}

		setDemoQueue((prevQueue) => prevQueue.slice(1));

		const clip = await getDemoClip(nextClipId);
		return clip ?? null;
	}, [demoQueue]);

	const getFirstQueClip = useCallback(async (): Promise<ModQueueItem | ClipQueueItem | null> => {
		if (isEmbed || isDemoPlayer) return null;

		const modClip = await getFirstFromModQueue(overlay.id, overlaySecret);
		if (modClip) return modClip;

		const queClip = await getFirstFromClipQueue(overlay.id, overlaySecret);
		return queClip ?? null;
	}, [isEmbed, isDemoPlayer, overlay.id, overlaySecret]);

	const getRandomClip = useCallback(async (): Promise<TwitchClip | null> => {
		if (isDemoPlayer) {
			const demoClip = await getFirstFromDemoQueue();
			if (demoClip) return demoClip;
		}

		const queClip = await getFirstQueClip();
		if (queClip) {
			const clip = await getTwitchClip(queClip.clipId, overlay.ownerId);
			if (clip != null) {
				removeFromModQueue(queClip.id, overlay.id, overlaySecret).catch((error) => {
					console.error("Failed to remove from mod queue:", error);
				});
				removeFromClipQueue(queClip.id, overlay.id, overlaySecret).catch((error) => {
					console.error("Failed to remove from clip queue:", error);
				});
				return clip;
			}
		}

		if (!clips || clips.length === 0) return null;

		const played = playedClipsRef.current;
		const nextId = nextClipRef.current?.id;
		const currentId = clipRef.current?.id;

		let candidates = clips.filter((c) => !played.includes(c.id) && c.id !== currentId && c.id !== nextId);

		if (candidates.length === 0) {
			setPlayedClips([]);
			playedClipsRef.current = [];

			candidates = clips.filter((c) => c.id !== currentId && c.id !== nextId);
		}

		if (candidates.length === 0 && clips.length === 1) {
			return clips[0];
		}

		if (candidates.length === 0 && clips.length === 2) {
			if (!currentId) return clips[Math.floor(Math.random() * 2)];
			return clips.find((c) => c.id !== currentId) ?? clips[0];
		}

		if (candidates.length === 0) {
			return clips[Math.floor(Math.random() * clips.length)];
		}

		return candidates[Math.floor(Math.random() * candidates.length)];
	}, [clips, getFirstQueClip, getFirstFromDemoQueue, isDemoPlayer, overlay.ownerId]);

	/**
	 * The ONLY function that advances the currently playing clip.
	 * Uses prefetched clip if available, otherwise fetch/build a new one.
	 * Guards against concurrent calls + stale async overwrites.
	 */
	const advanceClip = useCallback(async () => {
		if (advanceLockRef.current) return;
		advanceLockRef.current = true;

		try {
			crossfadeLockRef.current = false;
			setIncomingClip(null);
			setIsCrossfading(false);

			const prefetched = nextClipRef.current;
			if (prefetched) {
				nextClipRef.current = null;
				setNextClip(null);
				if (activeSlot === "a") {
					setClipA(prefetched);
					setClipB(null);
					if (videoBRef.current) {
						videoBRef.current.pause();
						videoBRef.current.currentTime = 0;
					}
				} else {
					setClipB(prefetched);
					setClipA(null);
					if (videoARef.current) {
						videoARef.current.pause();
						videoARef.current.currentTime = 0;
					}
				}
				setVideoClip(prefetched);
				return;
			}

			const candidate = await getRandomClip();
			if (!candidate) {
				setVideoClip(null);
				return;
			}

			const myReqId = ++requestIdRef.current;
			const built = await buildVideoClip(candidate, !!isDemoPlayer);

			// ignore stale result if something newer already advanced
			if (myReqId !== requestIdRef.current) return;

			if (built) {
				if (activeSlot === "a") {
					setClipA(built);
					setClipB(null);
					if (videoBRef.current) {
						videoBRef.current.pause();
						videoBRef.current.currentTime = 0;
					}
				} else {
					setClipB(built);
					setClipA(null);
					if (videoARef.current) {
						videoARef.current.pause();
						videoARef.current.currentTime = 0;
					}
				}
				setVideoClip(built);
			}
		} finally {
			advanceLockRef.current = false;
		}
	}, [activeSlot, getRandomClip, isDemoPlayer]);

	const resetPrefetch = useCallback(() => {
		prefetchAbortRef.current?.abort();
		prefetchAbortRef.current = null;
		nextClipRef.current = null;
		setNextClip(null);
	}, []);

	async function handleCommand(name: string, data: string) {
		switch (name) {
			case "play": {
				if (data) {
					resetPrefetch();

					if (isDemoPlayer) {
						setDemoQueue((prevQueue) => [...prevQueue, data]);
					}

					// Only start immediately if nothing is currently playing.
					if (!clipRef.current) {
						await advanceClip();
					}
				} else {
					setPaused(false);
				}
				break;
			}

			case "pause": {
				setPaused(true);
				break;
			}

			case "skip": {
				await advanceClip();
				break;
			}

			case "hide": {
				setShowPlayer(false);
				(activeSlot === "a" ? videoARef.current : videoBRef.current)?.pause();
				break;
			}

			case "show": {
				setShowPlayer(true);
				(activeSlot === "a" ? videoARef.current : videoBRef.current)?.play().catch((error) => console.error("Error playing the video:", error));
				break;
			}
		}
	}

	useEffect(() => {
		clipRef.current = videoClip;
	}, [videoClip]);

	useEffect(() => {
		const activeVideo = activeSlot === "a" ? videoARef.current : videoBRef.current;
		if (!activeVideo) return;
		if (!showPlayer) {
			activeVideo.pause();
			return;
		}
		if (paused) activeVideo.pause();
		else activeVideo.play().catch((error) => console.error("Error playing the video:", error));
	}, [activeSlot, paused, showPlayer]);

	useEffect(() => {
		const activeVideo = activeSlot === "a" ? videoARef.current : videoBRef.current;
		if (!activeVideo) return;
		if (!showPlayer) return;
		if (paused) return;
		activeVideo.play().catch((error) => {
			console.error("Error playing the video:", error);
			// If autoplay is blocked, fall back to click-to-play in embed mode.
			if (embedBehaviorEnabled) {
				setHasUserStarted(false);
				setPaused(true);
			}
		});
	}, [activeSlot, embedBehaviorEnabled, paused, showPlayer, videoClip?.id]);

	useEffect(() => {
		const mutedValue = !!isDemoPlayer || (embedBehaviorEnabled ? isMuted : false);
		if (videoARef.current) videoARef.current.muted = mutedValue;
		if (videoBRef.current) videoBRef.current.muted = mutedValue;
	}, [embedBehaviorEnabled, isDemoPlayer, isMuted, videoClip?.id]);

	/**
	 * WebSocket / postMessage wiring
	 * (NOTE: your original code didn't cleanup listeners; that's also a possible "double trigger" in dev StrictMode)
	 */
	useEffect(() => {
		let ws: WebSocket | null = null;

		const onWindowMessage = async (event: MessageEvent) => {
			if (event.origin !== window.location.origin) return;

			const data = event.data;
			if (!data || typeof data !== "object") return;

			const { name, data: payload } = data as { name?: string; data?: unknown };
			if (typeof name !== "string" || name.length === 0) return;

			await handleCommand(name, typeof payload === "string" ? payload : "");
		};

		function setupWebSocket() {
			ws = new WebSocket("/ws");
			setWebsocket(ws);

			ws.addEventListener("open", () => {
				ws?.send(JSON.stringify({ type: "subscribe", data: { overlayId: overlay.id, secret: overlaySecret } }));
			});

			ws.addEventListener("message", async (event) => {
				if (event.data === `subscribed ${overlay.ownerId}`) return;

				try {
					const message = JSON.parse(event.data);

					switch (message.type) {
						case "new_clip_redemption":
							resetPrefetch();
							if (!clipRef.current) {
								await advanceClip();
							}
							break;
						case "command": {
							const { name, data } = message.data;
							await handleCommand(name, data);
							break;
						}
					}
				} catch (error) {
					console.error("Error handling WebSocket message:", error);
				}
			});

			ws.addEventListener("error", (event) => {
				const details = {
					readyState: ws?.readyState,
					url: ws?.url,
					type: event.type,
				};
				console.error("WebSocket error", details);
				ws?.close();
			});
		}

		if (!isEmbed && !isDemoPlayer) setupWebSocket();
		if (isDemoPlayer) window.addEventListener("message", onWindowMessage);

		return () => {
			ws?.close();
			window.removeEventListener("message", onWindowMessage);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * Twitch chat subscription
	 */
	useEffect(() => {
		async function setupChat() {
			if (!overlay.ownerId) return;
			try {
				await subscribeToChat(overlay.ownerId);
			} catch (error) {
				console.error("Error subscribing to chat", error);
			}
		}

		if (!isEmbed) setupChat();
	}, [isEmbed, overlay.ownerId]);

	/**
	 * Initial clip load (RUNS ONCE).
	 */
	const didInitRef = useRef(false);
	useEffect(() => {
		if (didInitRef.current) return;
		didInitRef.current = true;

		(async () => {
			const candidate = await getRandomClip();
			if (!candidate) return;

			const myReqId = ++requestIdRef.current;
			const built = await buildVideoClip(candidate, !!isDemoPlayer);
			if (myReqId !== requestIdRef.current) return;

			if (built) {
				if (activeSlot === "a") {
					setClipA(built);
					setClipB(null);
					if (videoBRef.current) {
						videoBRef.current.pause();
						videoBRef.current.currentTime = 0;
					}
				} else {
					setClipB(built);
					setClipA(null);
					if (videoARef.current) {
						videoARef.current.pause();
						videoARef.current.currentTime = 0;
					}
				}
				setVideoClip(built);
			}
		})();
	}, [activeSlot, getRandomClip, isDemoPlayer]);

	/**
	 * Prefetch next clip while current plays.
	 */
	useEffect(() => {
		if (!videoClip) return;

		let cancelled = false;

		async function prefetchNext() {
			prefetchAbortRef.current?.abort();
			const controller = new AbortController();
			prefetchAbortRef.current = controller;

			const candidate = await getRandomClip();
			if (!candidate || cancelled || controller.signal.aborted) return;

			const built = await buildVideoClip(candidate, !!isDemoPlayer);
			if (!built || cancelled || controller.signal.aborted) return;

			preloadVideo(built.mediaUrl);
			setNextClip(built);
		}

		prefetchNext();

		return () => {
			cancelled = true;
			prefetchAbortRef.current?.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [videoClip?.id, getRandomClip, isDemoPlayer]);

	const startCrossfade = useCallback(() => {
		if (crossfadeLockRef.current || isCrossfading) return;
		const prefetched = nextClipRef.current;
		if (!prefetched) return;

		crossfadeLockRef.current = true;
		setIsCrossfading(true);
		nextClipRef.current = null;
		setNextClip(null);
		setIncomingClip(prefetched);
		if (activeSlot === "a") setClipB(prefetched);
		else setClipA(prefetched);

		if (clipRef.current) {
			playedClipsRef.current = [...playedClipsRef.current, clipRef.current.id];
			setPlayedClips(playedClipsRef.current);
		}
	}, [activeSlot, isCrossfading]);

	useEffect(() => {
		if (!nextClipRef.current || isCrossfading || !showPlayer) return;
		const activeVideo = activeSlot === "a" ? videoARef.current : videoBRef.current;
		if (!activeVideo) return;
		const duration = activeVideo.duration;
		if (!Number.isFinite(duration) || duration <= 0) return;
		const remaining = duration - activeVideo.currentTime;
		if (remaining <= CROSSFADE_SECONDS) startCrossfade();
	}, [activeSlot, isCrossfading, showPlayer, nextClip, startCrossfade]);

	useEffect(() => {
		if (!incomingClip || !isCrossfading) return;

		const inactiveSlot = activeSlot === "a" ? "b" : "a";
		const inactiveVideo = inactiveSlot === "a" ? videoARef.current : videoBRef.current;
		const activeVideo = activeSlot === "a" ? videoARef.current : videoBRef.current;

		if (inactiveVideo && showPlayer) {
			inactiveVideo.currentTime = 0;
			inactiveVideo.play().catch((error) => console.error("Error playing the video:", error));
		}

		const timeout = setTimeout(() => {
			setActiveSlot(inactiveSlot);
			setVideoClip(incomingClip);
			setIncomingClip(null);
			setIsCrossfading(false);
			crossfadeLockRef.current = false;
			if (activeVideo) {
				activeVideo.pause();
				activeVideo.currentTime = 0;
			}
		}, CROSSFADE_MS);

		return () => clearTimeout(timeout);
	}, [CROSSFADE_MS, activeSlot, incomingClip, isCrossfading, showPlayer]);

	if (!videoClip) return null;

	if (isEmbed || isDemoPlayer || !isInIframe()) {
		const effectiveMuted = !!isDemoPlayer || (embedBehaviorEnabled ? isMuted : false);
		const allowAutoplay = embedBehaviorEnabled ? hasUserStarted : true;
		const showClickToPlay = embedBehaviorEnabled && paused;
		return (
			<div
				className='relative w-screen h-screen group'
				role={showClickToPlay ? "button" : undefined}
				tabIndex={showClickToPlay ? 0 : -1}
				aria-label={showClickToPlay ? "Play clips" : undefined}
				onClick={() => {
					if (showClickToPlay) {
						setHasUserStarted(true);
						setPaused(false);
					}
				}}
				onKeyDown={(event) => {
					if (!showClickToPlay) return;
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setHasUserStarted(true);
						setPaused(false);
					}
				}}
			>
				{(clipA?.mediaUrl || clipB?.mediaUrl) && (
					<>
						<motion.video
							key='slot-a'
							autoPlay={allowAutoplay}
							src={clipA?.mediaUrl}
							initial={{ opacity: 0 }}
							animate={{
								opacity: showPlayer
									? activeSlot === "a"
										? isCrossfading
											? 0
											: 1
										: isCrossfading
											? 1
											: 0
									: 0,
							}}
							transition={{ duration: isCrossfading ? CROSSFADE_SECONDS : SHOW_FADE_SECONDS, ease: "easeInOut" }}
							ref={videoARef}
							onTimeUpdate={(event) => {
								if (event.currentTarget !== videoARef.current) return;
								if (activeSlot !== "a") return;
								if (isCrossfading || !nextClipRef.current) return;
								const duration = event.currentTarget.duration;
								if (!Number.isFinite(duration) || duration <= 0) return;
								const remaining = duration - event.currentTarget.currentTime;
								if (remaining <= CROSSFADE_SECONDS) startCrossfade();
							}}
							onEnded={(event) => {
								if (event.currentTarget !== videoARef.current) return;
								if (activeSlot !== "a") return;
								if (isCrossfading) return;
								setShowOverlay(false);

								// sync update so next pick can't choose the same clip
								if (clipA) playedClipsRef.current = [...playedClipsRef.current, clipA.id];
								setPlayedClips(playedClipsRef.current);

								advanceClip();
							}}
							onPlay={() => setShowOverlay(true)}
							style={{
								width: "100vw",
								height: "100vh",
								aspectRatio: "19 / 9",
								pointerEvents: showPlayer ? "auto" : "none",
							}}
							className='block absolute inset-0'
							muted={effectiveMuted}
						>
							Your browser does not support the video tag.
						</motion.video>

						{clipB?.mediaUrl && (
							<motion.video
								key='slot-b'
								autoPlay={allowAutoplay}
								src={clipB.mediaUrl}
								initial={{ opacity: 0 }}
								animate={{
									opacity: showPlayer
										? activeSlot === "b"
											? isCrossfading
												? 0
												: 1
											: isCrossfading
												? 1
												: 0
										: 0,
								}}
								transition={{ duration: isCrossfading ? CROSSFADE_SECONDS : SHOW_FADE_SECONDS, ease: "easeInOut" }}
								ref={videoBRef}
								onTimeUpdate={(event) => {
									if (event.currentTarget !== videoBRef.current) return;
									if (activeSlot !== "b") return;
									if (isCrossfading || !nextClipRef.current) return;
									const duration = event.currentTarget.duration;
									if (!Number.isFinite(duration) || duration <= 0) return;
									const remaining = duration - event.currentTarget.currentTime;
									if (remaining <= CROSSFADE_SECONDS) startCrossfade();
								}}
								onEnded={(event) => {
									if (event.currentTarget !== videoBRef.current) return;
									if (activeSlot !== "b") return;
									if (isCrossfading) return;
									setShowOverlay(false);

									if (clipB) playedClipsRef.current = [...playedClipsRef.current, clipB.id];
									setPlayedClips(playedClipsRef.current);

									advanceClip();
								}}
								onPlay={() => setShowOverlay(true)}
								style={{
									width: "100vw",
									height: "100vh",
									aspectRatio: "19 / 9",
									pointerEvents: showPlayer ? "auto" : "none",
								}}
								className='block absolute inset-0'
								muted={effectiveMuted}
							>
								Your browser does not support the video tag.
							</motion.video>
						)}
					</>
				)}

				{embedBehaviorEnabled && (
					<>
						<div className='absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'>
							<button
								type='button'
								onClick={(event) => {
									event.stopPropagation();
									setIsMuted((prev) => !prev);
								}}
								className='h-10 w-10 rounded-full bg-primary text-white shadow-md hover:bg-primary-600 transition flex items-center justify-center'
								aria-pressed={isMuted}
								aria-label={isMuted ? "Unmute overlay" : "Mute overlay"}
							>
								{isMuted ? <IconVolumeOff className='h-5 w-5 text-zinc-200' /> : <IconVolume className='h-5 w-5 text-white' />}
							</button>
						</div>

						{showClickToPlay && (
							<div className='absolute inset-0 flex items-center justify-center'>
								<div
									className='rounded-full bg-primary text-white text-sm sm:text-base px-5 py-2.5 shadow-lg flex items-center gap-2'
								>
									<span className='inline-flex items-center justify-center h-7 w-7 rounded-full bg-white'>
										<IconPlayerPlayFilled className='h-4 w-4 text-primary' />
									</span>
									<span>Play clips</span>
								</div>
							</div>
						)}
					</>
				)}

				{isEmbed ? (
					showBanner ? (
						<div className='absolute left-4 bottom-4'>
							<Button as={Link} href='https://clipify.us?utm_source=embed&utm_medium=overlay&utm_campaign=webembed' target='_blank' rel='noopener noreferrer' color='primary' className='inline-flex items-center gap-1 px-3 py-1.5 text-white text-xs sm:text-sm rounded-full shadow-md hover:bg-opacity-80 transition' aria-label='Powered by Clipify'>
								<Logo className='w-4 h-4 sm:w-6 sm:h-6' />
								<span>Powered by Clipify</span>
							</Button>
						</div>
					) : null
				) : (
					<div className='absolute inset-0 flex flex-col justify-between text-xs sm:text-sm md:text-base lg:text-lg'>
						{showOverlay && (
							<>
								<PlayerOverlay left='2%' top='2%' scale={isDemoPlayer ? 1 : undefined}>
									<div className='flex items-center'>
										<Avatar size='md' src={videoClip.brodcasterAvatar} />
										<div className='flex flex-col justify-center ml-2 text-xs'>
											<span className='font-semibold'>{videoClip.broadcaster_name}</span>
											<span className='text-xs text-gray-400'>Playing {videoClip.game?.name}</span>
										</div>
									</div>
								</PlayerOverlay>

								<PlayerOverlay right='2%' bottom='2%' scale={isDemoPlayer ? 1 : undefined}>
									<div className='flex flex-col items-end text-right'>
										<span className='font-bold'>{videoClip.title}</span>
										<span className='text-xs text-gray-400 mt-1'>clipped by {videoClip.creator_name}</span>
									</div>
								</PlayerOverlay>
							</>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className='w-screen h-screen flex items-center justify-center bg-black text-white p-6'>
			<div className='max-w-xl text-center'>
				<h2 className='text-2xl font-bold mb-2'>Using overlay in non-embed mode isn&apos;t allowed.</h2>
				<p className='text-base text-gray-300'>Please use the embed URL (check your overlay dashboard for the link).</p>
			</div>
		</div>
	);
}
