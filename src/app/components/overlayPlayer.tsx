"use client";

import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type RefObject, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipQueueItem, ModQueueItem, Overlay, TwitchClip, TwitchClipGqlData, TwitchClipGqlResponse, TwitchClipVideoQuality, VideoClip } from "@types";
import { getAvatar, getDemoClip, getGameDetails, getTwitchClip, getTwitchClipBatch, resolvePlayableClip, subscribeToChat } from "@actions/twitch";
import PlayerOverlay from "@components/playerOverlay";
import { Avatar, Button, Link } from "@heroui/react";
import { motion } from "framer-motion";
import axios from "axios";
import { getFirstFromClipQueue, getFirstFromModQueue, removeFromClipQueue, removeFromModQueue } from "@actions/database";
import Logo from "@components/logo";
import { IconPlayerPlayFilled, IconVolume, IconVolumeOff } from "@tabler/icons-react";

type VideoQualityWithNumeric = TwitchClipVideoQuality & { numericQuality: number };

const CACHE_MAX = 200;
const FONT_URL_DELIMITER = "||url||";

function trimCache(map: Map<string, unknown>) {
	if (map.size <= CACHE_MAX) return;
	const firstKey = map.keys().next().value as string | undefined;
	if (firstKey) map.delete(firstKey);
}

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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function parseThemeFontSetting(value?: string) {
	const raw = (value ?? "").trim();
	if (!raw) return { fontFamily: "inherit", fontUrl: "" };
	if (raw.includes(FONT_URL_DELIMITER)) {
		const [family, url] = raw.split(FONT_URL_DELIMITER);
		return {
			fontFamily: family?.trim() || "inherit",
			fontUrl: url?.trim() || "",
		};
	}
	return { fontFamily: raw, fontUrl: "" };
}

function sanitizeFontCssUrl(value?: string) {
	const raw = (value ?? "").trim();
	if (!raw) return "";
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== "https:") return "";
		if (parsed.hostname.toLowerCase() !== "fonts.googleapis.com") return "";
		return parsed.toString();
	} catch {
		return "";
	}
}

const POWERED_BY_URL = "https://clipify.us?utm_source=embed&utm_medium=overlay&utm_campaign=webembed";

function getSlotOpacity(slot: "a" | "b", activeSlot: "a" | "b", isCrossfading: boolean, showPlayer: boolean) {
	if (!showPlayer) return 0;
	if (activeSlot === slot) return isCrossfading ? 0 : 1;
	return isCrossfading ? 1 : 0;
}

function PoweredByBadge({ className }: { className: string }) {
	return (
		<Button as={Link} href={POWERED_BY_URL} target='_blank' rel='noopener noreferrer' color='primary' className={className} aria-label='Powered by Clipify'>
			<Logo className='w-4 h-4 sm:w-6 sm:h-6' />
			<span>Powered by Clipify</span>
		</Button>
	);
}

type OverlayViewportProps = {
	clipA: VideoClip | null;
	clipB: VideoClip | null;
	activeSlot: "a" | "b";
	isCrossfading: boolean;
	showPlayer: boolean;
	crossfadeSeconds: number;
	showFadeSeconds: number;
	videoARef: RefObject<HTMLVideoElement | null>;
	videoBRef: RefObject<HTMLVideoElement | null>;
	effectiveMuted: boolean;
	onCanPlayA: () => void;
	onCanPlayB: () => void;
	onErrorA: () => void;
	onErrorB: () => void;
	onTimeUpdateA: (event: SyntheticEvent<HTMLVideoElement>) => void;
	onTimeUpdateB: (event: SyntheticEvent<HTMLVideoElement>) => void;
	onEndedA: (event: SyntheticEvent<HTMLVideoElement>) => void;
	onEndedB: (event: SyntheticEvent<HTMLVideoElement>) => void;
	onSlotPlay: () => void;
	showClickToPlay: boolean;
	onStartRequested: () => void;
	onStartKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
	overlay: Overlay;
	embedBehaviorEnabled: boolean;
	isMuted: boolean;
	onToggleMuted: () => void;
	isEmbed?: boolean;
	showEmbedOverlay?: boolean;
	showBanner?: boolean;
	showOverlay: boolean;
	canShowOverlay: boolean;
	videoClip: VideoClip;
	channelAnchoredRight: boolean;
	channelAnchoredBottom: boolean;
	channelInfoPos: { x: number; y: number };
	channelMirrored: boolean;
	overlayScale: number;
	channelScale: number;
	overlayFadeOutSeconds: number;
	themeStyle: CSSProperties;
	ownerAvatar: string;
	clipAnchoredRight: boolean;
	clipAnchoredBottom: boolean;
	clipInfoPos: { x: number; y: number };
	clipScale: number;
	timerAnchoredRight: boolean;
	timerAnchoredBottom: boolean;
	timerPos: { x: number; y: number };
	timerScale: number;
	remainingSeconds: number;
	progressBarHeight: number;
	progress: number;
	progressBarStartColor?: string;
	progressBarEndColor?: string;
};

function OverlayViewport({
	clipA,
	clipB,
	activeSlot,
	isCrossfading,
	showPlayer,
	crossfadeSeconds,
	showFadeSeconds,
	videoARef,
	videoBRef,
	effectiveMuted,
	onCanPlayA,
	onCanPlayB,
	onErrorA,
	onErrorB,
	onTimeUpdateA,
	onTimeUpdateB,
	onEndedA,
	onEndedB,
	onSlotPlay,
	showClickToPlay,
	onStartRequested,
	onStartKeyDown,
	overlay,
	embedBehaviorEnabled,
	isMuted,
	onToggleMuted,
	isEmbed,
	showEmbedOverlay,
	showBanner,
	showOverlay,
	canShowOverlay,
	videoClip,
	channelAnchoredRight,
	channelAnchoredBottom,
	channelInfoPos,
	channelMirrored,
	overlayScale,
	channelScale,
	overlayFadeOutSeconds,
	themeStyle,
	ownerAvatar,
	clipAnchoredRight,
	clipAnchoredBottom,
	clipInfoPos,
	clipScale,
	timerAnchoredRight,
	timerAnchoredBottom,
	timerPos,
	timerScale,
	remainingSeconds,
	progressBarHeight,
	progress,
	progressBarStartColor,
	progressBarEndColor,
}: OverlayViewportProps) {
	return (
		<div
			className='relative w-screen h-screen group'
			role={showClickToPlay ? "button" : undefined}
			tabIndex={showClickToPlay ? 0 : -1}
			aria-label={showClickToPlay ? "Play clips" : undefined}
			onClick={showClickToPlay ? onStartRequested : undefined}
			onKeyDown={onStartKeyDown}
		>
			{(clipA?.mediaUrl || clipB?.mediaUrl) && (
				<>
					<motion.video
						key='slot-a'
						autoPlay={false}
						src={clipA?.mediaUrl}
						preload='auto'
						initial={{ opacity: 0 }}
						animate={{ opacity: getSlotOpacity("a", activeSlot, isCrossfading, showPlayer) }}
						transition={{ duration: isCrossfading ? crossfadeSeconds : showFadeSeconds, ease: "easeInOut" }}
						ref={videoARef}
						onCanPlay={onCanPlayA}
						onError={onErrorA}
						onTimeUpdate={onTimeUpdateA}
						onEnded={onEndedA}
						onPlay={onSlotPlay}
						style={{
							width: "100vw",
							height: "100vh",
							aspectRatio: "19 / 9",
							pointerEvents: showPlayer ? "auto" : "none",
						}}
						className='block absolute inset-0 z-0'
						muted={effectiveMuted}
					>
						Your browser does not support the video tag.
					</motion.video>

					{clipB?.mediaUrl && (
						<motion.video
							key='slot-b'
							autoPlay={false}
							src={clipB.mediaUrl}
							preload='auto'
							initial={{ opacity: 0 }}
							animate={{ opacity: getSlotOpacity("b", activeSlot, isCrossfading, showPlayer) }}
							transition={{ duration: isCrossfading ? crossfadeSeconds : showFadeSeconds, ease: "easeInOut" }}
							ref={videoBRef}
							onCanPlay={onCanPlayB}
							onError={onErrorB}
							onTimeUpdate={onTimeUpdateB}
							onEnded={onEndedB}
							onPlay={onSlotPlay}
							style={{
								width: "100vw",
								height: "100vh",
								aspectRatio: "19 / 9",
								pointerEvents: showPlayer ? "auto" : "none",
							}}
							className='block absolute inset-0 z-0'
							muted={effectiveMuted}
						>
							Your browser does not support the video tag.
						</motion.video>
					)}
				</>
			)}

			{overlay.effectScanlines && <div className='pointer-events-none absolute inset-0 z-[5] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_2px,transparent_4px)]' />}
			{overlay.effectStatic && <div className='pointer-events-none absolute inset-0 z-[5] animate-pulse bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.04),transparent_40%)]' />}
			{overlay.effectCrt && <div className='pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(circle_at_center,transparent_52%,rgba(0,0,0,0.38)_100%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,255,0.04))] mix-blend-screen' />}

			{embedBehaviorEnabled && (
				<>
					<div className='absolute right-4 top-4 z-20 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'>
						<button type='button' onClick={(event) => {
							event.stopPropagation();
							onToggleMuted();
						}} className='h-10 w-10 rounded-full bg-primary text-white shadow-md hover:bg-primary-600 transition flex items-center justify-center' aria-pressed={isMuted} aria-label={isMuted ? "Unmute overlay" : "Mute overlay"}>
							{isMuted ? <IconVolumeOff className='h-5 w-5 text-zinc-200' /> : <IconVolume className='h-5 w-5 text-white' />}
						</button>
					</div>

					{showClickToPlay && (
						<div className='absolute inset-0 flex items-center justify-center'>
							<div className='rounded-full bg-primary text-white text-sm sm:text-base px-5 py-2.5 shadow-lg flex items-center gap-2'>
								<span className='inline-flex items-center justify-center h-7 w-7 rounded-full bg-white'>
									<IconPlayerPlayFilled className='h-4 w-4 text-primary' />
								</span>
								<span>Play clips</span>
							</div>
						</div>
					)}
				</>
			)}

			{isEmbed && !showEmbedOverlay ? (
				showBanner ? (
					<div className='absolute left-4 bottom-4'>
						<PoweredByBadge className='inline-flex items-center gap-1 px-3 py-1.5 text-white text-xs sm:text-sm rounded-full shadow-md hover:bg-opacity-80 transition' />
					</div>
				) : null
			) : (
				<div className='absolute inset-0 z-10 pointer-events-none flex flex-col justify-between text-xs'>
					{showOverlay && canShowOverlay && !showClickToPlay && (
						<>
							{overlay.showChannelInfo && (
								<PlayerOverlay key={`${videoClip.id}-channel`} left={channelAnchoredRight ? undefined : `${channelInfoPos.x}%`} right={channelAnchoredRight ? `${100 - channelInfoPos.x}%` : undefined} top={channelAnchoredBottom ? undefined : `${channelInfoPos.y}%`} bottom={channelAnchoredBottom ? `${100 - channelInfoPos.y}%` : undefined} scale={overlayScale * channelScale} fadeOutSeconds={overlayFadeOutSeconds} className='w-fit p-2 shadow-lg backdrop-blur-sm' style={themeStyle}>
									<div className={`flex items-center ${channelMirrored ? "flex-row-reverse" : ""}`}>
										<Avatar size='md' src={videoClip.brodcasterAvatar || ownerAvatar} />
										<div className={`flex flex-col justify-center text-xs ${channelMirrored ? "mr-2 items-end text-right" : "ml-2 items-start text-left"}`}>
											<span className='font-semibold'>{videoClip.broadcaster_name}</span>
											<span className='text-xs opacity-80'>Playing {videoClip.game?.name}</span>
										</div>
									</div>
								</PlayerOverlay>
							)}

							{overlay.showClipInfo && (
								<PlayerOverlay
									key={`${videoClip.id}-clip`}
									left={clipAnchoredRight ? undefined : `${clipInfoPos.x}%`}
									right={clipAnchoredRight ? `${100 - clipInfoPos.x}%` : undefined}
									top={clipAnchoredBottom ? undefined : `${clipInfoPos.y}%`}
									bottom={clipAnchoredBottom ? `${100 - clipInfoPos.y}%` : undefined}
									scale={overlayScale * clipScale}
									fadeOutSeconds={overlayFadeOutSeconds}
									className='w-fit p-2 shadow-lg backdrop-blur-sm max-w-[min(360px,42vw)]'
									style={themeStyle}
								>
									<div className={`flex flex-col break-normal ${clipAnchoredRight ? "items-end text-right" : "items-start text-left"}`}>
										<span className='font-bold'>{videoClip.title}</span>
										<span className='text-xs opacity-80 mt-1'>clipped by {videoClip.creator_name}</span>
									</div>
								</PlayerOverlay>
							)}

							{overlay.showTimer && (
								<PlayerOverlay
									key={`${videoClip.id}-timer`}
									left={timerAnchoredRight ? undefined : `${timerPos.x}%`}
									right={timerAnchoredRight ? `${100 - timerPos.x}%` : undefined}
									top={timerAnchoredBottom ? undefined : `${timerPos.y}%`}
									bottom={timerAnchoredBottom ? `${100 - timerPos.y}%` : undefined}
									scale={overlayScale * timerScale}
									fadeOutSeconds={0}
									className='shadow-lg backdrop-blur-sm !rounded-full !p-0 h-12 w-12 min-h-12 min-w-12 aspect-square flex items-center justify-center text-sm font-bold leading-none tabular-nums'
									style={{ ...themeStyle, borderRadius: "9999px", padding: 0 }}
								>
									<span>{remainingSeconds}</span>
								</PlayerOverlay>
							)}
						</>
					)}
					{overlay.showProgressBar && canShowOverlay && !showClickToPlay && (
						<div className='absolute left-0 right-0 bottom-0 overflow-hidden' style={{ backgroundColor: "rgba(0, 0, 0, 0.35)", height: `${progressBarHeight}px` }}>
							<div
								className='h-full transition-[width] duration-150 ease-linear'
								style={{
									width: `${progress}%`,
									background: `linear-gradient(90deg, ${progressBarStartColor || "#26018E"}, ${progressBarEndColor || "#8D42F9"})`,
								}}
							/>
						</div>
					)}
					{isEmbed && showBanner ? (
						<div className='absolute left-4 bottom-4 pointer-events-auto'>
							<PoweredByBadge className='inline-flex items-center gap-1 px-3 py-1.5 text-white text-xs sm:text-sm rounded-full shadow-md hover:bg-opacity-80 transition' />
						</div>
					) : null}
				</div>
			)}
		</div>
	);
}

export default function OverlayPlayer({
	overlay,
	isEmbed,
	showBanner,
	showEmbedOverlay,
	isDemoPlayer,
	embedMuted,
	embedAutoplay,
	overlaySecret,
}: {
	overlay: Overlay;
	isEmbed?: boolean;
	showBanner?: boolean;
	showEmbedOverlay?: boolean;
	isDemoPlayer?: boolean;
	embedMuted?: boolean;
	embedAutoplay?: boolean;
	overlaySecret?: string;
}) {
	const CROSSFADE_SECONDS = 0.7;
	const CROSSFADE_MS = Math.round(CROSSFADE_SECONDS * 1000);
	const SHOW_FADE_SECONDS = 0.6;
	const HOLD_FRAME_SECONDS = 0.08;
	const HOLD_TIMEOUT_MS = 1500;

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
	const nextQueueItemRef = useRef<ModQueueItem | ClipQueueItem | null>(null);
	useEffect(() => {
		nextClipRef.current = nextClip;
	}, [nextClip]);

	const [showOverlay, setShowOverlay] = useState<boolean>(false);
	const [showPlayer, setShowPlayer] = useState<boolean>(true);
	const embedBehaviorEnabled = !!isEmbed && !isDemoPlayer;
	const [paused, setPaused] = useState<boolean>(embedBehaviorEnabled ? !embedAutoplay : false);
	const [isMuted, setIsMuted] = useState<boolean>(embedBehaviorEnabled ? !!embedMuted : false);
	const [runtimeVolume, setRuntimeVolume] = useState<number>(overlay.playerVolume ?? 50);
	const [ownerAvatar, setOwnerAvatar] = useState<string>("");
	const [hasUserStarted, setHasUserStarted] = useState<boolean>(!embedBehaviorEnabled || !!embedAutoplay);
	const [, setWebsocket] = useState<WebSocket | null>(null);
	const [clipPool, setClipPool] = useState<TwitchClip[]>([]);
	const clipPoolRef = useRef<TwitchClip[]>([]);

	const videoARef = useRef<HTMLVideoElement | null>(null);
	const videoBRef = useRef<HTMLVideoElement | null>(null);
	const clipRef = useRef<VideoClip | null>(null);
	const [activeDuration, setActiveDuration] = useState(0);
	const [activeCurrentTime, setActiveCurrentTime] = useState(0);

	const playbackMode = overlay.playbackMode ?? "random";
	const channelInfoPos = {
		x: clamp(overlay.channelInfoX ?? 0, 0, 100),
		y: clamp(overlay.channelInfoY ?? 0, 0, 100),
	};
	const channelMirrored = channelInfoPos.x > 50;
	const channelAnchoredRight = channelInfoPos.x > 50;
	const channelAnchoredBottom = channelInfoPos.y > 50;
	const clipInfoPos = {
		x: clamp(overlay.clipInfoX ?? 100, 0, 100),
		y: clamp(overlay.clipInfoY ?? 100, 0, 100),
	};
	const clipAnchoredRight = clipInfoPos.x > 50;
	const clipAnchoredBottom = clipInfoPos.y > 50;
	const overlayScale = isEmbed || isDemoPlayer ? 1 : 2;
	const progressBarHeight = Math.max(8, Math.round(10 * overlayScale));
	const channelScale = clamp((overlay.channelScale ?? 100) / 100, 0.5, 2.5);
	const clipScale = clamp((overlay.clipScale ?? 100) / 100, 0.5, 2.5);
	const timerScale = clamp((overlay.timerScale ?? 100) / 100, 0.5, 2.5);
	const overlayFadeOutSeconds = clamp(overlay.overlayInfoFadeOutSeconds ?? 6, 0, 30);
	const timerPos = {
		x: clamp(overlay.timerX ?? 100, 0, 100),
		y: clamp(overlay.timerY ?? 0, 0, 100),
	};
	const timerAnchoredRight = timerPos.x > 50;
	const timerAnchoredBottom = timerPos.y > 50;
	const clipPackSize = clamp(Math.round(overlay.clipPackSize ?? 100), 10, 500);
	const clipPoolTargetSize = Math.max(clipPackSize * 4, 120);
	const { fontFamily: resolvedThemeFontFamily, fontUrl: resolvedThemeFontUrl } = useMemo(() => parseThemeFontSetting(overlay.themeFontFamily), [overlay.themeFontFamily]);
	const safeThemeFontUrl = useMemo(() => sanitizeFontCssUrl(resolvedThemeFontUrl), [resolvedThemeFontUrl]);
	const themeStyle = {
		color: overlay.themeTextColor || "#FFFFFF",
		backgroundColor: overlay.themeBackgroundColor || "rgba(10,10,10,0.65)",
		borderColor: overlay.themeAccentColor || "#7C3AED",
		borderStyle: "solid",
		borderWidth: `${Math.max(0, overlay.borderSize ?? 0)}px`,
		borderRadius: `${Math.max(0, overlay.borderRadius ?? 10)}px`,
		fontFamily: resolvedThemeFontFamily || "inherit",
	};

	// Demo queue support
	type DemoQueueItem = { id: string; clip?: TwitchClip };
	const [demoQueue, setDemoQueue] = useState<DemoQueueItem[]>([]);

	useEffect(() => {
		clipPoolRef.current = clipPool;
	}, [clipPool]);

	const refreshClipPool = useCallback(async () => {
		try {
			const excludeIds = Array.from(
				new Set([
					...playedClipsRef.current,
					...(clipRef.current?.id ? [clipRef.current.id] : []),
					...(nextClipRef.current?.id ? [nextClipRef.current.id] : []),
					...clipPoolRef.current.map((clip) => clip.id),
				]),
			);
			const fetched = await getTwitchClipBatch(overlay, overlay.type, excludeIds, clipPackSize);
			if (!Array.isArray(fetched)) return fetched;
			const deduped = new Map<string, TwitchClip>();
			for (const clip of fetched) {
				if (!clip?.id) continue;
				deduped.set(clip.id, clip);
			}
			const next = Array.from(deduped.values());
			setClipPool((prev) => {
				const merged = new Map<string, TwitchClip>();
				for (const clip of prev) merged.set(clip.id, clip);
				for (const clip of next) merged.set(clip.id, clip);
				const pruned = Array.from(merged.values()).filter((clip) => !playedClipsRef.current.includes(clip.id));
				return pruned.slice(0, clipPoolTargetSize);
			});
			return next;
		} catch (error) {
			console.error("Error refreshing clip pool:", error);
			return clipPoolRef.current;
		}
	}, [clipPackSize, clipPoolTargetSize, overlay]);

	const parseDemoClipId = useCallback((rawInput: string) => {
		const raw = rawInput.trim();
		if (!raw) return null;

		try {
			const url = new URL(raw);
			const host = url.hostname.toLowerCase();
			const isTwitchHost =
				host === "twitch.tv" ||
				host === "www.twitch.tv" ||
				host === "clips.twitch.tv" ||
				host.endsWith(".twitch.tv") ||
				host.endsWith(".clips.twitch.tv");
			if (!isTwitchHost) return null;

			const clipMatch = url.pathname.match(/\/clip\/([^\/\?]+)/);
			if (clipMatch && clipMatch[1]) return clipMatch[1];

			if (host === "clips.twitch.tv" || host.endsWith(".clips.twitch.tv")) {
				const parts = url.pathname.split("/").filter(Boolean);
				const candidate = parts[0];
				if (candidate && /^[A-Za-z0-9_-]+$/.test(candidate)) return candidate;
			}

			return null;
		} catch {
			if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;
			return raw;
		}
	}, []);

	// Prevent overlapping "advance" calls + stale async overwrites
	const advanceLockRef = useRef(false);
	const requestIdRef = useRef(0);
	const pendingSkipRef = useRef(0);

	// Prevent overlapping prefetches / stale updates
	const prefetchAbortRef = useRef<AbortController | null>(null);
	const crossfadeLockRef = useRef(false);
	const holdLastFrameRef = useRef(false);
	const holdSlotRef = useRef<"a" | "b" | null>(null);
	const readyARef = useRef(false);
	const readyBRef = useRef(false);
	const mediaUrlCacheRef = useRef<Map<string, string>>(new Map());
	const mediaUrlInFlightRef = useRef<Map<string, Promise<string | undefined>>>(new Map());
	const avatarCacheRef = useRef<Map<string, string>>(new Map());
	const avatarInFlightRef = useRef<Map<string, Promise<string>>>(new Map());
	const gameCacheRef = useRef<Map<string, NonNullable<VideoClip["game"]> | null>>(new Map());
	const gameInFlightRef = useRef<Map<string, Promise<NonNullable<VideoClip["game"]> | null>>>(new Map());
	const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const getMediaUrlCached = useCallback(async (clipId: string) => {
		const cached = mediaUrlCacheRef.current.get(clipId);
		if (cached) return cached;

		const inflight = mediaUrlInFlightRef.current.get(clipId);
		if (inflight) return inflight;

		const promise = getRawMediaUrl(clipId)
			.then((url) => {
				if (url) {
					mediaUrlCacheRef.current.set(clipId, url);
					trimCache(mediaUrlCacheRef.current);
				}
				return url;
			})
			.catch((error) => {
				console.error("Error fetching raw media URL", error);
				return undefined;
			})
			.finally(() => {
				mediaUrlInFlightRef.current.delete(clipId);
			});

		mediaUrlInFlightRef.current.set(clipId, promise);
		return promise;
	}, []);

	const getAvatarCached = useCallback(async (broadcasterId: string) => {
		if (avatarCacheRef.current.has(broadcasterId)) {
			return avatarCacheRef.current.get(broadcasterId) ?? "";
		}

		const inflight = avatarInFlightRef.current.get(broadcasterId);
		if (inflight) return inflight;

		const promise = getAvatar(broadcasterId, broadcasterId)
			.then((avatar) => {
				const value = avatar ?? "";
				avatarCacheRef.current.set(broadcasterId, value);
				trimCache(avatarCacheRef.current);
				return value;
			})
			.catch(() => "")
			.finally(() => {
				avatarInFlightRef.current.delete(broadcasterId);
			});

		avatarInFlightRef.current.set(broadcasterId, promise);
		return promise;
	}, []);

	const getGameCached = useCallback(async (gameId: string, broadcasterId: string) => {
		const cacheKey = gameId;
		if (gameCacheRef.current.has(cacheKey)) {
			return gameCacheRef.current.get(cacheKey) ?? null;
		}

		const inflight = gameInFlightRef.current.get(cacheKey);
		if (inflight) return inflight;

		const promise = getGameDetails(gameId, broadcasterId)
			.then((game) => {
				const value = game ?? null;
				gameCacheRef.current.set(cacheKey, value);
				trimCache(gameCacheRef.current);
				return value;
			})
			.catch(() => null)
			.finally(() => {
				gameInFlightRef.current.delete(cacheKey);
			});

		gameInFlightRef.current.set(cacheKey, promise);
		return promise;
	}, []);

	const prefetchMetadata = useCallback(
		(randomClip: TwitchClip) => {
			getAvatarCached(randomClip.broadcaster_id).catch(() => "");
			getGameCached(randomClip.game_id, randomClip.broadcaster_id).catch(() => null);
		},
		[getAvatarCached, getGameCached]
	);

	const patchClipById = useCallback((id: string, patch: Partial<VideoClip>) => {
		setVideoClip((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
		setNextClip((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
		setClipA((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
		setClipB((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
	}, []);

	const buildVideoClipFast = useCallback(
		async (randomClip: TwitchClip): Promise<VideoClip | null> => {
			prefetchMetadata(randomClip);

			const mediaUrl = await getMediaUrlCached(randomClip.id);
			if (!mediaUrl) return null;

			const baseGame = isDemoPlayer
				? {
						id: "",
						name: "Demo Mode",
						box_art_url: "",
						igdb_id: "",
					}
				: {
						id: "",
						name: "Unknown Game",
						box_art_url: "",
						igdb_id: "",
					};

			const cachedAvatar = avatarCacheRef.current.has(randomClip.broadcaster_id)
				? avatarCacheRef.current.get(randomClip.broadcaster_id) ?? ""
				: "";
			const cachedGame =
				(gameCacheRef.current.has(randomClip.game_id) ? gameCacheRef.current.get(randomClip.game_id) : null) ??
				(isDemoPlayer
					? {
							id: "",
							name: "Demo Mode",
							box_art_url: "",
							igdb_id: "",
						}
					: baseGame);

			const baseClip: VideoClip = {
				...randomClip,
				mediaUrl,
				brodcasterAvatar: cachedAvatar,
				game: cachedGame,
			};

			const avatarPromise = getAvatarCached(randomClip.broadcaster_id);
			const gamePromise = getGameCached(randomClip.game_id, randomClip.broadcaster_id);

			Promise.all([avatarPromise, gamePromise]).then(([avatar, game]) => {
				patchClipById(baseClip.id, {
					brodcasterAvatar: avatar ?? "",
					game: game ?? baseGame,
				});
			});

			return baseClip;
		},
		[getMediaUrlCached, getAvatarCached, getGameCached, isDemoPlayer, patchClipById, prefetchMetadata]
	);

	const getFirstFromDemoQueue = useCallback(async () => {
		// NOTE: we read state via closure here; that's fine, demo mode is explicit
		if (demoQueue.length === 0) return null;

		let consumed = 0;

		while (consumed < demoQueue.length) {
			const item = demoQueue[consumed];
			consumed += 1;

			if (!item.id) continue;

			const clip = item.clip ?? (await getDemoClip(item.id));
			if (clip) {
				setDemoQueue((prevQueue) => prevQueue.slice(consumed));
				return clip;
			}
		}

		if (consumed > 0) {
			setDemoQueue((prevQueue) => prevQueue.slice(consumed));
		}
		return null;
	}, [demoQueue]);

	const getFirstQueClip = useCallback(async (): Promise<ModQueueItem | ClipQueueItem | null> => {
		if (isEmbed || isDemoPlayer) return null;

		const modClip = await getFirstFromModQueue(overlay.id, overlaySecret);
		if (modClip) return modClip;

		const queClip = await getFirstFromClipQueue(overlay.id, overlaySecret);
		return queClip ?? null;
	}, [isEmbed, isDemoPlayer, overlay.id, overlaySecret]);

	type ClipCandidate = { clip: TwitchClip; queueItem?: ModQueueItem | ClipQueueItem };

	const getRandomClip = useCallback(async (): Promise<ClipCandidate | null> => {
		if (isDemoPlayer) {
			const demoClip = await getFirstFromDemoQueue();
			if (demoClip) return { clip: demoClip };
		}

		const queClip = await getFirstQueClip();
		if (queClip) {
			const clip = await getTwitchClip(queClip.clipId, overlay.ownerId);
			if (clip != null) return { clip, queueItem: queClip };
		}

		let availableClips = clipPoolRef.current;
		if (!availableClips || availableClips.length === 0) {
			availableClips = await refreshClipPool();
		}
		if (!availableClips || availableClips.length === 0) return null;

		const played = playedClipsRef.current;
		const nextId = nextClipRef.current?.id;
		const currentId = clipRef.current?.id;

		let candidates = availableClips.filter((c) => !played.includes(c.id) && c.id !== currentId && c.id !== nextId);

		if (candidates.length === 0) {
			setPlayedClips([]);
			playedClipsRef.current = [];

			candidates = availableClips.filter((c) => c.id !== currentId && c.id !== nextId);
		}

		if (candidates.length === 0 && availableClips.length === 1) return { clip: availableClips[0] };

		if (candidates.length === 0 && availableClips.length === 2) {
			if (!currentId) return { clip: availableClips[Math.floor(Math.random() * 2)] };
			return { clip: availableClips.find((c) => c.id !== currentId) ?? availableClips[0] };
		}

		if (candidates.length === 0) {
			candidates = [...availableClips];
		}

		if (playbackMode === "top") {
			const topClip = [...candidates].sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at))[0];
			if (!topClip) return null;
			const playable = await resolvePlayableClip(overlay.ownerId, topClip);
			return playable ? { clip: playable } : null;
		}

		if (playbackMode === "smart_shuffle") {
			const qualityPool = (() => {
				if (candidates.length <= 12) return candidates;
				const sortedByViews = [...candidates].sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at));
				const keepCount = Math.max(12, Math.ceil(sortedByViews.length * 0.65));
				return sortedByViews.slice(0, keepCount);
			})();

			const idToClip = new Map(availableClips.map((clip) => [clip.id, clip]));
			const recentClips = played
				.slice(-20)
				.map((id) => idToClip.get(id))
				.filter((clip): clip is TwitchClip => !!clip);

			const recentCreatorCounts = new Map<string, number>();
			const recentGameCounts = new Map<string, number>();
			for (const clip of recentClips) {
				const creatorKey = clip.creator_id || clip.creator_name;
				recentCreatorCounts.set(creatorKey, (recentCreatorCounts.get(creatorKey) ?? 0) + 1);
				recentGameCounts.set(clip.game_id, (recentGameCounts.get(clip.game_id) ?? 0) + 1);
			}

			const sortedViews = [...qualityPool].map((clip) => clip.view_count).sort((a, b) => a - b);
			const medianViews = sortedViews.length > 0 ? sortedViews[Math.floor(sortedViews.length / 2)] : 0;
			const maxLogViews = Math.log1p(Math.max(1, ...sortedViews));

			const scored = qualityPool.map((clip) => {
				const creatorKey = clip.creator_id || clip.creator_name;
				const creatorPenalty = (recentCreatorCounts.get(creatorKey) ?? 0) * 0.12;
				const gamePenalty = (recentGameCounts.get(clip.game_id) ?? 0) * 0.1;
				const viewScore = Math.log1p(clip.view_count) / maxLogViews;
				const exploreBoost = clip.view_count <= medianViews ? 0.12 : 0;
				const jitter = Math.random() * 0.25;
				const score = Math.max(0.05, 0.58 * viewScore + 0.25 * jitter + exploreBoost - creatorPenalty - gamePenalty);
				return { clip, score };
			});

			const totalWeight = scored.reduce((sum, entry) => sum + entry.score, 0);
			let pick = Math.random() * totalWeight;
			for (const entry of scored) {
				pick -= entry.score;
				if (pick <= 0) {
					const playable = await resolvePlayableClip(overlay.ownerId, entry.clip);
					return playable ? { clip: playable } : null;
				}
			}
			if (!scored[0]) return null;
			const playable = await resolvePlayableClip(overlay.ownerId, scored[0].clip);
			return playable ? { clip: playable } : null;
		}

		const randomClip = candidates[Math.floor(Math.random() * candidates.length)];
		if (!randomClip) return null;
		const playable = await resolvePlayableClip(overlay.ownerId, randomClip);
		return playable ? { clip: playable } : null;
	}, [getFirstQueClip, getFirstFromDemoQueue, isDemoPlayer, overlay.ownerId, playbackMode, refreshClipPool]);

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
			holdLastFrameRef.current = false;
			holdSlotRef.current = null;
			if (holdTimeoutRef.current) {
				clearTimeout(holdTimeoutRef.current);
				holdTimeoutRef.current = null;
			}
			setIncomingClip(null);
			setIsCrossfading(false);

			const prefetched = nextClipRef.current;
			if (prefetched) {
				nextClipRef.current = null;
				setNextClip(null);
				if (nextQueueItemRef.current) {
					removeFromModQueue(nextQueueItemRef.current.id, overlay.id, overlaySecret).catch((error) => {
						console.error("Failed to remove from mod queue:", error);
					});
					removeFromClipQueue(nextQueueItemRef.current.id, overlay.id, overlaySecret).catch((error) => {
						console.error("Failed to remove from clip queue:", error);
					});
					nextQueueItemRef.current = null;
				}
				if (activeSlot === "a") {
					readyARef.current = false;
					setClipA(prefetched);
					readyBRef.current = false;
					setClipB(null);
					if (videoBRef.current) {
						videoBRef.current.pause();
						videoBRef.current.currentTime = 0;
					}
				} else {
					readyBRef.current = false;
					setClipB(prefetched);
					readyARef.current = false;
					setClipA(null);
					if (videoARef.current) {
						videoARef.current.pause();
						videoARef.current.currentTime = 0;
					}
				}
				setVideoClip(prefetched);
				setShowOverlay(true);
				return;
			}

			const candidate = await getRandomClip();
			if (!candidate) {
				// Keep current clip if we can't fetch a new one (avoid blank background on skip).
				return;
			}

			const myReqId = ++requestIdRef.current;
			const built = await buildVideoClipFast(candidate.clip);

			// ignore stale result if something newer already advanced
			if (myReqId !== requestIdRef.current) return;

			if (built) {
				if (candidate.queueItem) {
					removeFromModQueue(candidate.queueItem.id, overlay.id, overlaySecret).catch((error) => {
						console.error("Failed to remove from mod queue:", error);
					});
					removeFromClipQueue(candidate.queueItem.id, overlay.id, overlaySecret).catch((error) => {
						console.error("Failed to remove from clip queue:", error);
					});
				}
				if (activeSlot === "a") {
					readyARef.current = false;
					setClipA(built);
					readyBRef.current = false;
					setClipB(null);
					if (videoBRef.current) {
						videoBRef.current.pause();
						videoBRef.current.currentTime = 0;
					}
				} else {
					readyBRef.current = false;
					setClipB(built);
					readyARef.current = false;
					setClipA(null);
					if (videoARef.current) {
						videoARef.current.pause();
						videoARef.current.currentTime = 0;
					}
				}
				setVideoClip(built);
				setShowOverlay(true);
			}
		} finally {
			advanceLockRef.current = false;
			if (pendingSkipRef.current > 0) {
				pendingSkipRef.current -= 1;
				advanceClip().catch((error) => console.error("Error advancing clip after pending skip:", error));
			}
		}
	}, [activeSlot, buildVideoClipFast, getRandomClip, isDemoPlayer, overlay.id, overlaySecret]);

	const resetPrefetch = useCallback(() => {
		prefetchAbortRef.current?.abort();
		prefetchAbortRef.current = null;
		nextClipRef.current = null;
		nextQueueItemRef.current = null;
		setNextClip(null);
	}, []);

	async function handleCommand(name: string, data: string) {
		switch (name) {
			case "play": {
				if (data) {
					resetPrefetch();

					if (isDemoPlayer) {
						const demoId = parseDemoClipId(data);
						if (!demoId) {
							return;
						}

						const demoClip = await getDemoClip(demoId);
						if (!demoClip) {
							return;
						}

					setDemoQueue((prevQueue) => [...prevQueue, { id: demoId, clip: demoClip }]);
				}

					// Only start immediately if nothing is currently playing.
					if (!clipRef.current) {
						await advanceClip();
					}
				} else {
					setHasUserStarted(true);
					setPaused(false);
					if (showPlayer) {
						(activeSlot === "a" ? videoARef.current : videoBRef.current)?.play().catch((error) => {
							console.error("Error playing the video:", error);
						});
					}
				}

				break;
			}

			case "pause": {
				setPaused(true);
				(activeSlot === "a" ? videoARef.current : videoBRef.current)?.pause();
				break;
			}

			case "skip": {
				if (advanceLockRef.current) {
					pendingSkipRef.current += 1;
					break;
				}
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

			case "volume": {
				const next = Number.parseInt((data || "").trim(), 10);
				if (!Number.isFinite(next)) break;
				setRuntimeVolume(clamp(next, 0, 100));
				break;
			}
		}
	}

	useEffect(() => {
		clipRef.current = videoClip;
	}, [videoClip]);

	useEffect(() => {
		setActiveCurrentTime(0);
		setActiveDuration(0);
	}, [videoClip?.id]);

	useEffect(() => {
		let rafId = 0;
		let lastCommitAt = 0;
		const tick = () => {
			const activeVideo = activeSlot === "a" ? videoARef.current : videoBRef.current;
			if (activeVideo) {
				const duration = activeVideo.duration;
				if (Number.isFinite(duration) && duration > 0) {
					const now = performance.now();
					if (now - lastCommitAt >= 66) {
						setActiveDuration(duration);
						setActiveCurrentTime(activeVideo.currentTime);
						lastCommitAt = now;
					}
				}
			}
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [activeSlot, videoClip?.id]);

	useEffect(() => {
		if (!showPlayer) {
			setShowOverlay(false);
			return;
		}
		if (videoClip) setShowOverlay(true);
	}, [showPlayer, videoClip?.id]);

	useEffect(() => {
		let cancelled = false;
		getAvatar(overlay.ownerId, overlay.ownerId)
			.then((avatar) => {
				if (!cancelled) setOwnerAvatar(avatar ?? "");
			})
			.catch(() => {
				if (!cancelled) setOwnerAvatar("");
			});
		return () => {
			cancelled = true;
		};
	}, [overlay.ownerId]);

	useEffect(() => {
		const activeVideo = activeSlot === "a" ? videoARef.current : videoBRef.current;
		if (!activeVideo) return;
		if (holdLastFrameRef.current && holdSlotRef.current === activeSlot) return;
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
		if (holdLastFrameRef.current && holdSlotRef.current === activeSlot) return;
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

	useEffect(() => {
		const volume = clamp(runtimeVolume / 100, 0, 1);
		if (videoARef.current) videoARef.current.volume = volume;
		if (videoBRef.current) videoBRef.current.volume = volume;
	}, [runtimeVolume, videoClip?.id]);

	useEffect(() => {
		setRuntimeVolume(overlay.playerVolume ?? 50);
	}, [overlay.playerVolume]);

	useEffect(() => {
		if (!safeThemeFontUrl) return;
		if (typeof document === "undefined") return;
		const id = `overlay-font-${btoa(safeThemeFontUrl).replace(/=/g, "")}`;
		if (document.getElementById(id)) return;
		const link = document.createElement("link");
		link.id = id;
		link.rel = "stylesheet";
		link.href = safeThemeFontUrl;
		document.head.appendChild(link);
	}, [safeThemeFontUrl]);

	useEffect(() => {
		return () => {
			if (holdTimeoutRef.current) {
				clearTimeout(holdTimeoutRef.current);
				holdTimeoutRef.current = null;
			}
			holdLastFrameRef.current = false;
			holdSlotRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!nextClip) return;
		if (isCrossfading) return;
		const inactiveSlot = activeSlot === "a" ? "b" : "a";

		if (inactiveSlot === "a") {
			if (clipA?.id !== nextClip.id) {
				readyARef.current = false;
				setClipA(nextClip);
			}
		} else {
			if (clipB?.id !== nextClip.id) {
				readyBRef.current = false;
				setClipB(nextClip);
			}
		}
	}, [activeSlot, clipA?.id, clipB?.id, isCrossfading, nextClip]);

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
				console.error("Error subscribing to EventSub", error);
			}
		}

		if (!isEmbed) setupChat();
	}, [isEmbed, overlay.ownerId]);

	useEffect(() => {
		let cancelled = false;
		let delayMs = 30_000;
		const maxDelayMs = 5 * 60_000;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const scheduleNext = () => {
			if (cancelled) return;
			timeoutId = setTimeout(run, delayMs);
		};

		const run = async () => {
			if (cancelled) return;
			if (typeof document !== "undefined" && document.visibilityState === "hidden") {
				delayMs = Math.min(delayMs * 2, maxDelayMs);
				scheduleNext();
				return;
			}

			try {
				const next = await refreshClipPool();
				if (cancelled) return;
				if (!Array.isArray(next) || next.length === 0) {
					delayMs = Math.min(delayMs * 2, maxDelayMs);
				} else {
					delayMs = 30_000;
				}
			} catch {
				delayMs = Math.min(delayMs * 2, maxDelayMs);
			}

			scheduleNext();
		};

		void run();
		return () => {
			cancelled = true;
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [refreshClipPool]);

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
			const built = await buildVideoClipFast(candidate.clip);
			if (myReqId !== requestIdRef.current) return;

			if (built) {
				if (candidate.queueItem) {
					removeFromModQueue(candidate.queueItem.id, overlay.id, overlaySecret).catch((error) => {
						console.error("Failed to remove from mod queue:", error);
					});
					removeFromClipQueue(candidate.queueItem.id, overlay.id, overlaySecret).catch((error) => {
						console.error("Failed to remove from clip queue:", error);
					});
				}
				if (activeSlot === "a") {
					readyARef.current = false;
					setClipA(built);
					readyBRef.current = false;
					setClipB(null);
					if (videoBRef.current) {
						videoBRef.current.pause();
						videoBRef.current.currentTime = 0;
					}
				} else {
					readyBRef.current = false;
					setClipB(built);
					readyARef.current = false;
					setClipA(null);
					if (videoARef.current) {
						videoARef.current.pause();
						videoARef.current.currentTime = 0;
					}
				}
				setVideoClip(built);
				setShowOverlay(true);
			}
		})();
	}, [activeSlot, buildVideoClipFast, getRandomClip, isDemoPlayer, overlay.id, overlaySecret]);

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

			const built = await buildVideoClipFast(candidate.clip);
			if (!built || cancelled || controller.signal.aborted) return;

			preloadVideo(built.mediaUrl);
			setNextClip(built);
			nextQueueItemRef.current = candidate.queueItem ?? null;
		}

		prefetchNext();

		return () => {
			cancelled = true;
			prefetchAbortRef.current?.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [buildVideoClipFast, videoClip?.id, getRandomClip, isDemoPlayer, overlay.id, overlaySecret]);

	const startCrossfade = useCallback(() => {
		if (crossfadeLockRef.current || isCrossfading) return;
		const prefetched = nextClipRef.current;
		if (!prefetched) return;

		const inactiveSlot = activeSlot === "a" ? "b" : "a";
		const incomingReady = inactiveSlot === "a" ? readyARef.current : readyBRef.current;
		if (!incomingReady) return;

		crossfadeLockRef.current = true;
		holdLastFrameRef.current = false;
		holdSlotRef.current = null;
		if (holdTimeoutRef.current) {
			clearTimeout(holdTimeoutRef.current);
			holdTimeoutRef.current = null;
		}
		if (nextQueueItemRef.current) {
			removeFromModQueue(nextQueueItemRef.current.id, overlay.id, overlaySecret).catch((error) => {
				console.error("Failed to remove from mod queue:", error);
			});
			removeFromClipQueue(nextQueueItemRef.current.id, overlay.id, overlaySecret).catch((error) => {
				console.error("Failed to remove from clip queue:", error);
			});
			nextQueueItemRef.current = null;
		}
		setIsCrossfading(true);
		nextClipRef.current = null;
		setNextClip(null);
		setIncomingClip(prefetched);
		if (inactiveSlot === "a") {
			readyARef.current = false;
			setClipA(prefetched);
		} else {
			readyBRef.current = false;
			setClipB(prefetched);
		}

		if (clipRef.current) {
			playedClipsRef.current = [...playedClipsRef.current, clipRef.current.id];
			setPlayedClips(playedClipsRef.current);
		}
	}, [activeSlot, isCrossfading, overlay.id, overlaySecret]);

		const handleTimeUpdate = useCallback(
			(slot: "a" | "b", video: HTMLVideoElement | null) => {
				if (!video) return;
				if (activeSlot !== slot) return;
				if (isCrossfading) return;
				const duration = video.duration;
				if (!Number.isFinite(duration) || duration <= 0) return;

				const remaining = duration - video.currentTime;
			// Only engage crossfade/hold logic when a next clip is available.
			if (!nextClipRef.current) return;

			const inactiveSlot = slot === "a" ? "b" : "a";
			const incomingReady = inactiveSlot === "a" ? readyARef.current : readyBRef.current;
			if (remaining <= CROSSFADE_SECONDS) {
				if (incomingReady) startCrossfade();
				else if (!holdLastFrameRef.current) {
					holdLastFrameRef.current = true;
					holdSlotRef.current = slot;
					video.currentTime = Math.max(0, duration - HOLD_FRAME_SECONDS);
					video.pause();
					if (!holdTimeoutRef.current) {
						holdTimeoutRef.current = setTimeout(() => {
							if (!holdLastFrameRef.current) return;
							holdLastFrameRef.current = false;
							holdSlotRef.current = null;
							if (holdTimeoutRef.current) {
								clearTimeout(holdTimeoutRef.current);
								holdTimeoutRef.current = null;
							}
							if (!crossfadeLockRef.current) advanceClip();
						}, HOLD_TIMEOUT_MS);
					}
				}
			}
		},
		[activeSlot, advanceClip, isCrossfading, startCrossfade, CROSSFADE_SECONDS, HOLD_FRAME_SECONDS, HOLD_TIMEOUT_MS]
	);

	useEffect(() => {
		if (!holdLastFrameRef.current || !nextClipRef.current || isCrossfading) return;
		if (paused || !showPlayer) return;
		const inactiveSlot = activeSlot === "a" ? "b" : "a";
		const incomingReady = inactiveSlot === "a" ? readyARef.current : readyBRef.current;
		if (!incomingReady) return;
		startCrossfade();
	}, [activeSlot, isCrossfading, nextClip, paused, showPlayer, startCrossfade]);

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
			setShowOverlay(true);
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
		const showClickToPlay = embedBehaviorEnabled && paused && !hasUserStarted;
		const canShowOverlay = showPlayer && !!videoClip && (!embedBehaviorEnabled || hasUserStarted);
			const displayDuration = activeDuration;
		const displayCurrentTime = Math.min(activeCurrentTime, Math.max(displayDuration, 0));
		const remainingSeconds = Math.max(0, Math.ceil(displayDuration - displayCurrentTime));
		const progress = displayDuration > 0 ? clamp((displayCurrentTime / displayDuration) * 100, 0, 100) : 0;
		const handleStartRequested = () => {
			if (!showClickToPlay) return;
			setHasUserStarted(true);
			setPaused(false);
		};

		const handleStartKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
			if (!showClickToPlay) return;
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				setHasUserStarted(true);
				setPaused(false);
			}
		};

		const handleSlotAError = () => {
			if (activeSlot === "a") {
				holdLastFrameRef.current = false;
				holdSlotRef.current = null;
				if (holdTimeoutRef.current) {
					clearTimeout(holdTimeoutRef.current);
					holdTimeoutRef.current = null;
				}
				advanceClip();
				return;
			}
			if (nextClipRef.current?.id === clipA?.id) {
				nextClipRef.current = null;
				setNextClip(null);
				readyARef.current = false;
			}
		};

		const handleSlotBError = () => {
			if (activeSlot === "b") {
				holdLastFrameRef.current = false;
				holdSlotRef.current = null;
				if (holdTimeoutRef.current) {
					clearTimeout(holdTimeoutRef.current);
					holdTimeoutRef.current = null;
				}
				advanceClip();
				return;
			}
			if (nextClipRef.current?.id === clipB?.id) {
				nextClipRef.current = null;
				setNextClip(null);
				readyBRef.current = false;
			}
		};

		const handleSlotAEnded = (event: SyntheticEvent<HTMLVideoElement>) => {
			if (event.currentTarget !== videoARef.current) return;
			if (activeSlot !== "a") return;
			if (isCrossfading) return;
			if (holdLastFrameRef.current) return;
			setShowOverlay(false);
			if (clipA) playedClipsRef.current = [...playedClipsRef.current, clipA.id];
			setPlayedClips(playedClipsRef.current);
			advanceClip();
		};

		const handleSlotBEnded = (event: SyntheticEvent<HTMLVideoElement>) => {
			if (event.currentTarget !== videoBRef.current) return;
			if (activeSlot !== "b") return;
			if (isCrossfading) return;
			if (holdLastFrameRef.current) return;
			setShowOverlay(false);
			if (clipB) playedClipsRef.current = [...playedClipsRef.current, clipB.id];
			setPlayedClips(playedClipsRef.current);
			advanceClip();
		};

		return (
			<OverlayViewport
				clipA={clipA}
				clipB={clipB}
				activeSlot={activeSlot}
				isCrossfading={isCrossfading}
				showPlayer={showPlayer}
				crossfadeSeconds={CROSSFADE_SECONDS}
				showFadeSeconds={SHOW_FADE_SECONDS}
				videoARef={videoARef}
				videoBRef={videoBRef}
				effectiveMuted={effectiveMuted}
				onCanPlayA={() => {
					readyARef.current = true;
					if (holdLastFrameRef.current) startCrossfade();
				}}
				onCanPlayB={() => {
					readyBRef.current = true;
					if (holdLastFrameRef.current) startCrossfade();
				}}
				onErrorA={handleSlotAError}
				onErrorB={handleSlotBError}
				onTimeUpdateA={(event) => {
					if (event.currentTarget !== videoARef.current) return;
					handleTimeUpdate("a", videoARef.current);
				}}
				onTimeUpdateB={(event) => {
					if (event.currentTarget !== videoBRef.current) return;
					handleTimeUpdate("b", videoBRef.current);
				}}
				onEndedA={handleSlotAEnded}
				onEndedB={handleSlotBEnded}
				onSlotPlay={() => setShowOverlay(true)}
				showClickToPlay={showClickToPlay}
				onStartRequested={handleStartRequested}
				onStartKeyDown={handleStartKeyDown}
				overlay={overlay}
				embedBehaviorEnabled={embedBehaviorEnabled}
				isMuted={isMuted}
				onToggleMuted={() => setIsMuted((prev) => !prev)}
				isEmbed={isEmbed}
				showEmbedOverlay={showEmbedOverlay}
				showBanner={showBanner}
				showOverlay={showOverlay}
				canShowOverlay={canShowOverlay}
				videoClip={videoClip}
				channelAnchoredRight={channelAnchoredRight}
				channelAnchoredBottom={channelAnchoredBottom}
				channelInfoPos={channelInfoPos}
				channelMirrored={channelMirrored}
				overlayScale={overlayScale}
				channelScale={channelScale}
				overlayFadeOutSeconds={overlayFadeOutSeconds}
				themeStyle={themeStyle}
				ownerAvatar={ownerAvatar}
				clipAnchoredRight={clipAnchoredRight}
				clipAnchoredBottom={clipAnchoredBottom}
				clipInfoPos={clipInfoPos}
				clipScale={clipScale}
				timerAnchoredRight={timerAnchoredRight}
				timerAnchoredBottom={timerAnchoredBottom}
				timerPos={timerPos}
				timerScale={timerScale}
				remainingSeconds={remainingSeconds}
				progressBarHeight={progressBarHeight}
				progress={progress}
				progressBarStartColor={overlay.progressBarStartColor}
				progressBarEndColor={overlay.progressBarEndColor}
			/>
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
