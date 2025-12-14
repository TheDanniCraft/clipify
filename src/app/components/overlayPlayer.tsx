"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipQueueItem, ModQueueItem, Overlay, TwitchClip, TwitchClipGqlData, TwitchClipGqlResponse, TwitchClipVideoQuality, VideoClip } from "@types";
import { getAvatar, getGameDetails, getTwitchClip, logTwitchError, subscribeToChat } from "@actions/twitch";
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
					sha256Hash: "6fd3af2b22989506269b9ac02dd87eb4a6688392d67d94e41a6886f1e9f5c00f",
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

export default function OverlayPlayer({ clips, overlay, isEmbed, showBanner }: { clips: TwitchClip[]; overlay: Overlay; isEmbed?: boolean; showBanner?: boolean }) {
	const [videoClip, setVideoClip] = useState<VideoClip | null>(null);
	const [playedClips, setPlayedClips] = useState<string[]>([]);
	const [showOverlay, setShowOverlay] = useState<boolean>(false);
	const [showPlayer, setShowPlayer] = useState<boolean>(true);
	const [paused, setPaused] = useState<boolean>(false);
	const [, setWebsocket] = useState<WebSocket | null>(null);
	const playerRef = useRef<HTMLVideoElement | null>(null);
	const clipRef = useRef<VideoClip | null>(null);

	const getFirstQueClip = useCallback(async (): Promise<ModQueueItem | ClipQueueItem | null> => {
		if (isEmbed) return null;

		const modClip = await getFirstFromModQueue(overlay.ownerId);
		if (modClip) {
			return modClip;
		}
		const queClip = await getFirstFromClipQueue(overlay.id);

		if (!queClip) {
			return null;
		}

		return queClip;
	}, [isEmbed, overlay.id, overlay.ownerId]);

	const getRandomClip = useCallback(async (): Promise<TwitchClip> => {
		const queClip = await getFirstQueClip();

		if (queClip) {
			const clip = await getTwitchClip(queClip.clipId, overlay.ownerId);

			if (clip != null) {
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
	}, [clips, overlay, playedClips, getFirstQueClip]);

	const playNextClip = useCallback(async () => {
		const randomClip = await getRandomClip();

		if (!randomClip) return;

		const mediaUrl = await getRawMediaUrl(randomClip?.id);

		const brodcasterAvatar = await getAvatar(randomClip?.broadcaster_id, randomClip?.broadcaster_id);
		const game = await getGameDetails(randomClip?.game_id, randomClip?.broadcaster_id);

		if (mediaUrl && randomClip)
			setVideoClip({
				...randomClip,
				mediaUrl,
				brodcasterAvatar: brodcasterAvatar ?? "",
				game: game ?? {
					id: "",
					name: "Unknown Game",
					box_art_url: "",
					igdb_id: "",
				},
			});
	}, [getRandomClip]);

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

								switch (name) {
									case "play": {
										if (data) {
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
		if (!isEmbed) setupWebSocket();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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

	useEffect(() => {
		async function fetchVideoSource() {
			const randomClip = await getRandomClip();

			if (!randomClip) {
				console.info("No clips available for overlay player.");
				return;
			}

			const mediaUrl = await getRawMediaUrl(randomClip?.id);

			const brodcasterAvatar = await getAvatar(randomClip?.broadcaster_id, randomClip?.broadcaster_id);
			const game = await getGameDetails(randomClip?.game_id, randomClip?.broadcaster_id);

			if (mediaUrl && randomClip)
				setVideoClip({
					...randomClip,
					mediaUrl,
					brodcasterAvatar: brodcasterAvatar ?? "",
					game: game ?? {
						id: "",
						name: "Unknown Game",
						box_art_url: "",
						igdb_id: "",
					},
				});
		}

		fetchVideoSource();
	}, [getRandomClip]);

	if (!videoClip) {
		return null;
	}

	if (isEmbed || !isInIframe()) {
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
								async function fetchNewClip() {
									setShowOverlay(false);
									setPlayedClips((prevPlayedClips) => [...prevPlayedClips, videoClip!.id]);

									const randomClip = await getRandomClip();
									if (!randomClip) return setVideoClip(null);
									const mediaUrl = await getRawMediaUrl(randomClip.id);

									const brodcasterAvatar = await getAvatar(randomClip?.broadcaster_id, randomClip?.broadcaster_id);
									const game = await getGameDetails(randomClip?.game_id, randomClip?.broadcaster_id);

									if (mediaUrl) {
										setVideoClip({
											...randomClip,
											mediaUrl,
											brodcasterAvatar: brodcasterAvatar ?? "",
											game: game ?? {
												id: "",
												name: "Unknown Game",
												box_art_url: "",
												igdb_id: "",
											},
										});
									}
								}
								fetchNewClip();
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
						>
							Your browser does not support the video tag.
						</motion.video>
					)}
				</AnimatePresence>
				{isEmbed ? (
					showBanner ? (
						<div className='absolute left-4 bottom-4'>
							<Button as={Link} href='https://clipify.us?utm_source=embed&utm_medium=overlay&utm_campaign=webembed' color='primary' className='inline-flex items-center gap-1 px-3 py-1.5 text-white text-xs sm:text-sm rounded-full shadow-md hover:bg-opacity-80 transition' aria-label='Powered by Clipify'>
								<Logo className='w-4 h-4 sm:w-6 sm:h-6' />
								<span>Powered by Clipify</span>
							</Button>
						</div>
					) : null
				) : (
					<div className='absolute inset-0 flex flex-col justify-between text-xs sm:text-sm md:text-base lg:text-lg'>
						{showOverlay && (
							<>
								<PlayerOverlay left='2%' top='2%'>
									<div className='flex items-center'>
										<Avatar size='md' src={videoClip?.brodcasterAvatar} />
										<div className='flex flex-col justify-center ml-2 text-xs'>
											<span className='font-semibold'>{videoClip?.broadcaster_name}</span>
											<span className='text-xs text-gray-400'>Playing {videoClip?.game?.name}</span>
										</div>
									</div>
								</PlayerOverlay>
								<PlayerOverlay right='2%' bottom='2%'>
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
	}

	if (!isEmbed && isInIframe()) {
		return (
			<div className='w-screen h-screen flex items-center justify-center bg-black text-white p-6'>
				<div className='max-w-xl text-center'>
					<h2 className='text-2xl font-bold mb-2'>Using overlay in non-embed mode isn&apos;t allowed.</h2>
					<p className='text-base text-gray-300'>Please use the embed URL (check your overlay dashboard for the link).</p>
				</div>
			</div>
		);
	}
	return null;
}
