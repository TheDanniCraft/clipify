"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipQueueItem, ModQueueItem, Overlay, TwitchClip, TwitchClipGqlData, TwitchClipGqlResponse, TwitchClipVideoQuality, VideoClip } from "@types";
import { getAvatar, getDemoClip, getGameDetails, getTwitchClip, logTwitchError, subscribeToChat } from "@actions/twitch";
import PlayerOverlay from "@components/playerOverlay";
import { Avatar, Button, Link } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { getFirstFromClipQueue, getFirstFromModQueue, removeFromClipQueue, removeFromModQueue } from "@actions/database";
import Logo from "@components/logo";

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

		if (!bestQuality) {
			console.error("No valid video quality found.");
			return undefined;
		}

		const clipsVideoSource = bestQuality.sourceURL;
		const clipsSignature = clipData.playbackAccessToken.signature;
		const clipsToken = encodeURIComponent(clipData.playbackAccessToken.value);

		const mp4Url = `${clipsVideoSource}?sig=${clipsSignature}&token=${clipsToken}`;

		return mp4Url;
	} catch (error) {
		logTwitchError("Error fetching raw media URL", error);
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
 * (Not guaranteed in all browsers, but helps a lot in practice.)
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

export default function OverlayPlayer({ clips, overlay, isEmbed, showBanner, isDemoPlayer }: { clips: TwitchClip[]; overlay: Overlay; isEmbed?: boolean; showBanner?: boolean; isDemoPlayer?: boolean }) {
	const [videoClip, setVideoClip] = useState<VideoClip | null>(null);
	const [nextClip, setNextClip] = useState<VideoClip | null>(null);

	const [playedClips, setPlayedClips] = useState<string[]>([]);
	const [showOverlay, setShowOverlay] = useState<boolean>(false);
	const [showPlayer, setShowPlayer] = useState<boolean>(true);
	const [paused, setPaused] = useState<boolean>(false);
	const [, setWebsocket] = useState<WebSocket | null>(null);

	const playerRef = useRef<HTMLVideoElement | null>(null);
	const clipRef = useRef<VideoClip | null>(null);

	// Demo queue support
	const [demoQueue, setDemoQueue] = useState<string[]>([]);

	// Prevent overlapping prefetches / stale updates
	const prefetchAbortRef = useRef<AbortController | null>(null);

	const getFirstFromDemoQueue = useCallback(async () => {
		if (demoQueue.length === 0) {
			return null;
		}
		const raw = demoQueue[0].trim();

		let nextClipId = raw;

		try {
			const url = new URL(raw);
			const host = url.hostname.toLowerCase();

			// Only accept twitch hosts
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
		if (!clip) {
			return null;
		}

		return clip;
	}, [demoQueue]);

	async function handleCommand(name: string, data: string) {
		switch (name) {
			case "play": {
				if (data) {
					if (isDemoPlayer) {
						setDemoQueue((prevQueue) => [...prevQueue, data]);
					}
					if (!clipRef.current) return;

					await playNextClip();
					break;
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
				await playNextClip();
				break;
			}

			case "hide": {
				setShowPlayer(false);
				if (playerRef.current) {
					playerRef.current.pause();
				}
				break;
			}

			case "show": {
				setShowPlayer(true);
				if (playerRef.current) {
					playerRef.current.play().catch((error) => {
						console.error("Error playing the video:", error);
					});
				}
				break;
			}
		}
	}

	const getFirstQueClip = useCallback(async (): Promise<ModQueueItem | ClipQueueItem | null> => {
		if (isEmbed || isDemoPlayer) return null;

		const modClip = await getFirstFromModQueue(overlay.ownerId);
		if (modClip) {
			return modClip;
		}
		const queClip = await getFirstFromClipQueue(overlay.id);

		if (!queClip) {
			return null;
		}

		return queClip;
	}, [isEmbed, isDemoPlayer, overlay.id, overlay.ownerId]);

	const getRandomClip = useCallback(async (): Promise<TwitchClip> => {
		if (isDemoPlayer) {
			const demoClip = await getFirstFromDemoQueue();
			if (demoClip) {
				return demoClip;
			}
		}

		const queClip = await getFirstQueClip();

		if (queClip) {
			const clip = await getTwitchClip(queClip.clipId, overlay.ownerId);

			if (clip != null) {
				// Fire and forget; don't block playback
				removeFromModQueue(queClip.id);
				removeFromClipQueue(queClip.id);
				return clip;
			}
		}

		let unplayedClips = clips.filter((clip) => !playedClips.includes(clip.id));

		if (unplayedClips.length === 0 && clips.length > 0) {
			setPlayedClips([]);
			unplayedClips = clips;
		}

		const randomIndex = Math.floor(Math.random() * unplayedClips.length);
		return unplayedClips[randomIndex];
	}, [isDemoPlayer, getFirstQueClip, clips, getFirstFromDemoQueue, overlay.ownerId, playedClips]);

	/**
	 * Immediate playback (used by commands or when we didn't have a prefetched clip).
	 */
	const playNextClip = useCallback(async () => {
		const randomClip = await getRandomClip();
		if (!randomClip) return;

		const built = await buildVideoClip(randomClip, !!isDemoPlayer);
		if (built) setVideoClip(built);
	}, [getRandomClip, isDemoPlayer]);

	useEffect(() => {
		clipRef.current = videoClip;
	}, [videoClip]);

	useEffect(() => {
		if (!isEmbed) console.log("Paused state changed:", paused);
		if (playerRef.current) {
			if (paused) {
				playerRef.current.pause();
			} else {
				playerRef.current.play().catch((error) => {
					console.error("Error playing the video:", error);
				});
			}
		}
	}, [paused, isEmbed]);

	/**
	 * WebSocket / postMessage wiring
	 */
	useEffect(() => {
		async function setupWebSocket() {
			const ws = new WebSocket("/ws");
			setWebsocket(ws);

			ws.addEventListener("open", () => {
				ws.send(
					JSON.stringify({
						type: "subscribe",
						data: overlay.id,
					})
				);
			});

			ws.addEventListener("error", (event) => {
				console.error("WebSocket error:", event);
				console.log("Reconnecting in 5 seconds...");
				ws.close();

				setTimeout(() => {
					console.log("Reconnecting to WebSocket...");
					setupWebSocket();
				}, 5000);
			});

			ws.addEventListener("message", async (event) => {
				if (event.data === `subscribed ${overlay.ownerId}`) {
					console.log("WebSocket subscribed successfully.");
					return;
				} else {
					try {
						const message = JSON.parse(event.data);

						switch (message.type) {
							case "new_clip_redemption": {
								if (!clipRef.current) return;
								await playNextClip();
								break;
							}
							case "command": {
								const { name, data } = message.data;
								console.log("Received command via WebSocket:", name);

								await handleCommand(name, data);
								break;
							}
						}
					} catch (error) {
						console.error("Error handling WebSocket message:", error);
					}
				}
			});

			return () => {
				ws.close();
			};
		}

		async function setupMessaging() {
			window.addEventListener("message", async (event) => {
				if (event.origin !== window.location.origin) {
					return;
				}

				const data = event.data;
				if (!data || typeof data !== "object") return;

				const { name, data: payload } = data as { name?: string; data?: unknown };
				if (typeof name !== "string" || name.length === 0) return;

				console.log("Received command via postMessage:", name);
				await handleCommand(name, typeof payload === "string" ? payload : "");
			});
		}

		if (!isEmbed && !isDemoPlayer) setupWebSocket();
		if (isDemoPlayer) setupMessaging();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * Twitch chat subscription
	 */
	useEffect(() => {
		async function setupChat() {
			if (overlay.ownerId) {
				try {
					await subscribeToChat(overlay.ownerId);
				} catch (error) {
					logTwitchError("Error subscribing to chat", error);
				}
			}
		}

		if (!isEmbed) setupChat();
	}, [isEmbed, overlay.ownerId]);

	/**
	 * Initial clip load
	 */
	useEffect(() => {
		let cancelled = false;

		async function fetchVideoSource() {
			const randomClip = await getRandomClip();

			if (!randomClip) {
				console.info("No clips available for overlay player.");
				return;
			}

			const built = await buildVideoClip(randomClip, !!isDemoPlayer);
			if (!cancelled && built) setVideoClip(built);
		}

		fetchVideoSource();

		return () => {
			cancelled = true;
		};
	}, [getRandomClip, isDemoPlayer]);

	/**
	 * Prefetch the next clip in the background while the current one plays.
	 * This is the main fix to remove the 1–2s "dead air" on transitions.
	 */
	useEffect(() => {
		if (!videoClip) return;

		let cancelled = false;

		async function prefetchNext() {
			// cancel any previous prefetch
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
	}, [videoClip, getRandomClip, isDemoPlayer]);

	if (!videoClip) {
		return null;
	}

	if (isEmbed || isDemoPlayer || !isInIframe()) {
		return (
			<div className='relative inline-block'>
				<AnimatePresence mode='wait'>
					{videoClip?.mediaUrl && (
						<motion.video
							key={videoClip.id}
							autoPlay
							src={videoClip.mediaUrl}
							initial={{ opacity: 0.1 }}
							animate={{ opacity: 1 }}
							hidden={!showPlayer}
							exit={{ opacity: 0.1 }}
							transition={{ duration: 0.5 }}
							ref={playerRef}
							onEnded={() => {
								setShowOverlay(false);
								setPlayedClips((prev) => [...prev, videoClip.id]);

								// Instant swap if we have a prefetched clip ready
								if (nextClip) {
									setVideoClip(nextClip);
									setNextClip(null);
									return;
								}

								// Fallback slow path
								(async () => {
									const randomClip = await getRandomClip();
									if (!randomClip) return setVideoClip(null);

									const built = await buildVideoClip(randomClip, !!isDemoPlayer);
									if (built) setVideoClip(built);
								})();
							}}
							onPlay={() => {
								setShowOverlay(true);
							}}
							style={{
								width: "100vw",
								height: "100vh",
								aspectRatio: "19 / 9",
							}}
							className='block'
							muted={isDemoPlayer}
						>
							Your browser does not support the video tag.
						</motion.video>
					)}
				</AnimatePresence>

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
										<Avatar size='md' src={videoClip?.brodcasterAvatar} />
										<div className='flex flex-col justify-center ml-2 text-xs'>
											<span className='font-semibold'>{videoClip?.broadcaster_name}</span>
											<span className='text-xs text-gray-400'>Playing {videoClip?.game?.name}</span>
										</div>
									</div>
								</PlayerOverlay>
								<PlayerOverlay right='2%' bottom='2%' scale={isDemoPlayer ? 1 : undefined}>
									<div className='flex flex-col items-end text-right'>
										<span className='font-bold'>{videoClip?.title}</span>
										<span className='text-xs text-gray-400 mt-1'>clipped by {videoClip?.creator_name}</span>
									</div>
								</PlayerOverlay>
							</>
						)}
					</div>
				)}
			</div>
		);
	} else {
		return (
			<div className='w-screen h-screen flex items-center justify-center bg-black text-white p-6'>
				<div className='max-w-xl text-center'>
					<h2 className='text-2xl font-bold mb-2'>Using overlay in non-embed mode isn&apos;t allowed.</h2>
					<p className='text-base text-gray-300'>Please use the embed URL (check your overlay dashboard for the link).</p>
				</div>
			</div>
		);
	}
}
