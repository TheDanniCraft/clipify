"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconBroadcast, IconLock, IconLockOpen2, IconEye, IconEyeOff, IconLayoutSidebarRightExpand, IconPlayerSkipForward, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlus, IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { Button, Chip, Image, Progress, Slider } from "@heroui/react";
import { getControllerQueuesAction, runControllerAction, type ControllerQueueResponse } from "@actions/controller";

type PlaybackState = {
	paused: boolean;
	showPlayer: boolean;
	volume: number;
	muted: boolean;
};

type ClipSummary = {
	clipId: string;
	title: string;
	creatorName: string;
	duration: number;
	currentTime?: number;
	thumbnailUrl: string | null;
};

function formatDuration(seconds?: number | null) {
	if (seconds == null || !Number.isFinite(seconds)) return "--:--";
	const total = Math.max(0, Math.floor(seconds));
	const min = Math.floor(total / 60);
	const sec = total % 60;
	return `${min}:${String(sec).padStart(2, "0")}`;
}

function getWebSocketUrl() {
	if (typeof window === "undefined") return null;
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/ws`;
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <section className={`rounded-[28px] border border-default-200 bg-content1 shadow-sm ${className}`}>{children}</section>;
}

function PanelLabel({ children }: { children: ReactNode }) {
	return <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-primary'>{children}</p>;
}

function QueueRow({ clip, accent }: { clip: ClipSummary; accent?: boolean }) {
	return (
		<div className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 ${accent ? "bg-primary/10" : "bg-transparent hover:bg-default-100"}`}>
			<div className='flex h-11 w-[52px] items-center justify-center overflow-hidden rounded-xl bg-default-100'>{clip.thumbnailUrl ? <Image src={clip.thumbnailUrl} alt='' width={52} height={44} radius='none' className='h-11 w-[52px] object-cover' /> : <span className='text-[10px] font-semibold uppercase tracking-[0.18em] text-default-400'>Clip</span>}</div>
			<div className='min-w-0'>
				<div className='truncate text-sm font-medium text-foreground'>{clip.title}</div>
				<div className='truncate text-xs text-default-500'>{clip.creatorName}</div>
			</div>
			<div className='text-xs text-default-500'>{formatDuration(clip.duration)}</div>
		</div>
	);
}

export default function ControllerClient({ overlayId, controllerToken }: { overlayId: string; controllerToken: string }) {
	const wsRef = useRef<WebSocket | null>(null);
	const queueRefreshAtRef = useRef(0);
	const [socketConnected, setSocketConnected] = useState(false);
	const [playback, setPlayback] = useState<PlaybackState>({ paused: false, showPlayer: true, volume: 50, muted: false });
	const [nowPlaying, setNowPlaying] = useState<ClipSummary | null>(null);
	const [nextClips, setNextClips] = useState<ClipSummary[]>([]);
	const [modQueue, setModQueue] = useState<ClipSummary[]>([]);
	const [viewerQueue, setViewerQueue] = useState<ClipSummary[]>([]);
	const [lastEventAt, setLastEventAt] = useState<number | null>(null);
	const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
	const [playerAttached, setPlayerAttached] = useState(false);
	const [nowPlayingUpdatedAt, setNowPlayingUpdatedAt] = useState<number>(0);
	const [volumeDraft, setVolumeDraft] = useState<number>(50);
	const [isApplyingVolume, setIsApplyingVolume] = useState(false);
	const [queueRefreshKey, setQueueRefreshKey] = useState(0);
	const [controlsUnlocked, setControlsUnlocked] = useState(false);
	const [modClipUrl, setModClipUrl] = useState("");
	const [isSubmittingModClip, setIsSubmittingModClip] = useState(false);
	const [modClipFeedback, setModClipFeedback] = useState<{ tone: "default" | "danger" | "success"; text: string } | null>(null);
	const [mounted, setMounted] = useState(false);
	const [, setClock] = useState(0);

	const refreshQueues = () => setQueueRefreshKey((value) => value + 1);
	const refreshQueuesSoon = useCallback(() => {
		const now = Date.now();
		if (now - queueRefreshAtRef.current < 1000) return;
		queueRefreshAtRef.current = now;
		refreshQueues();
	}, []);

	useEffect(() => {
		setMounted(true);
		const timer = setInterval(() => setClock((v) => v + 1), 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		let cancelled = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let removeLoadListener: (() => void) | null = null;

		const connect = () => {
			const wsUrl = getWebSocketUrl();
			if (!wsUrl || cancelled) return;
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.addEventListener("open", () => {
				if (wsRef.current !== ws) return;
				setSocketConnected(true);
				ws.send(JSON.stringify({ type: "subscribe", data: { overlayId, controllerToken, role: "controller" } }));
			});

			ws.addEventListener("close", () => {
				if (wsRef.current !== ws) return;
				setSocketConnected(false);
				if (!cancelled) reconnectTimer = setTimeout(connect, 1500);
			});

			ws.addEventListener("error", () => {
				if (wsRef.current !== ws) return;
				setSocketConnected(false);
				ws.close();
			});

			ws.addEventListener("message", (event) => {
				if (event.data === `subscribed ${overlayId}`) return;
				try {
					const message = JSON.parse(event.data) as { type?: string; data?: Record<string, unknown> };
					if (message.type !== "overlay_state" || !message.data) return;
					if (wsRef.current === ws) setSocketConnected(true);
					const payload = message.data;
					const kind = payload.kind;
					if (kind === "playback_state") {
						setPlayback((prev) => ({
							paused: Boolean(payload.paused ?? prev.paused),
							showPlayer: Boolean(payload.showPlayer ?? prev.showPlayer),
							volume: typeof payload.volume === "number" ? payload.volume : prev.volume,
							muted: Boolean(payload.muted ?? prev.muted),
						}));
					}
					if (kind === "heartbeat") {
						setPlayerAttached(Boolean(payload.playerAttached));
						setLastHeartbeatAt(Date.now());
					}
					if (kind === "now_playing") {
						setNowPlaying(
							typeof payload.clipId === "string"
								? {
										clipId: payload.clipId,
										title: typeof payload.title === "string" ? payload.title : payload.clipId,
										creatorName: typeof payload.creatorName === "string" ? payload.creatorName : "unknown",
										duration: typeof payload.duration === "number" ? payload.duration : 0,
										currentTime: typeof payload.currentTime === "number" ? payload.currentTime : 0,
										thumbnailUrl: typeof payload.thumbnailUrl === "string" ? payload.thumbnailUrl : null,
									}
								: null,
						);
						setNowPlayingUpdatedAt(Date.now());
					}
					if (kind === "queue_preview" && Array.isArray(payload.items)) {
						const parsed = payload.items
							.map((item) => {
								if (!item || typeof item !== "object") return null;
								const obj = item as Record<string, unknown>;
								if (typeof obj.clipId !== "string") return null;
								return {
									clipId: obj.clipId,
									title: typeof obj.title === "string" ? obj.title : obj.clipId,
									creatorName: typeof obj.creatorName === "string" ? obj.creatorName : "unknown",
									duration: typeof obj.duration === "number" ? obj.duration : 0,
									thumbnailUrl: typeof obj.thumbnailUrl === "string" ? obj.thumbnailUrl : null,
								} satisfies ClipSummary;
							})
							.filter((entry): entry is ClipSummary => Boolean(entry));
						setNextClips(parsed);
						refreshQueuesSoon();
					}
					setLastEventAt(Date.now());
				} catch {
					// noop
				}
			});
		};

		if (typeof document !== "undefined" && document.readyState === "complete") {
			connect();
		} else if (typeof window !== "undefined") {
			const handleLoad = () => connect();
			window.addEventListener("load", handleLoad, { once: true });
			removeLoadListener = () => window.removeEventListener("load", handleLoad);
		}

		return () => {
			cancelled = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (removeLoadListener) removeLoadListener();
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [controllerToken, overlayId, refreshQueuesSoon]);

	useEffect(() => {
		setVolumeDraft(playback.volume);
	}, [playback.volume]);

	const executeControllerAction = async (action: "set_volume" | "clear_mod_queue" | "clear_viewer_queue" | "clear_all_queues" | "add_mod_clip", options?: { volume?: number; clipUrl?: string }) => {
		const response = await runControllerAction(overlayId, { action, volume: options?.volume, clipUrl: options?.clipUrl });
		if (response.ok && action !== "set_volume") refreshQueues();
		return response;
	};

	useEffect(() => {
		let active = true;
		let timer: ReturnType<typeof setTimeout> | null = null;

		const loadQueues = async () => {
			try {
				if (typeof document !== "undefined" && document.visibilityState === "hidden") {
					if (active) timer = setTimeout(loadQueues, 30000);
					return;
				}
				const response = await getControllerQueuesAction(overlayId);
				if (!active || "ok" in response) return;
				const data = response as ControllerQueueResponse;
				if (!active) return;
				setModQueue(
					(data.modQueue ?? []).map((item) => ({
						clipId: item.clipId,
						title: item.title,
						creatorName: item.creatorName,
						duration: item.duration,
						thumbnailUrl: item.thumbnailUrl ?? null,
					})),
				);
				setViewerQueue(
					(data.viewerQueue ?? []).map((item) => ({
						clipId: item.clipId,
						title: item.title,
						creatorName: item.creatorName,
						duration: item.duration,
						thumbnailUrl: item.thumbnailUrl ?? null,
					})),
				);
			} finally {
				if (active) timer = setTimeout(loadQueues, 15000);
			}
		};

		void loadQueues();
		return () => {
			active = false;
			if (timer) clearTimeout(timer);
		};
	}, [overlayId, queueRefreshKey]);

	const sendCommand = (name: string, data: string | null = null) => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "command", data: { name, data, overlayId } }));
	};

	const lastStateAt = Math.max(lastEventAt ?? 0, nowPlayingUpdatedAt ?? 0, lastHeartbeatAt ?? 0);
	const isStateFresh = lastStateAt > 0 && Date.now() - lastStateAt < 15_000;
	const isHeartbeatFresh = lastHeartbeatAt != null && Date.now() - lastHeartbeatAt < 3_500;
	const isLive = isHeartbeatFresh || socketConnected || isStateFresh;
	const controllerHealth = !isHeartbeatFresh ? "disconnected" : !playerAttached ? "player_missing" : "healthy";
	const statusText = useMemo(() => {
		if (controllerHealth === "disconnected") return "Disconnected";
		if (controllerHealth === "player_missing") return "No player";
		if (!lastEventAt) return "Connected";
		return `Live ${Math.max(0, Math.floor((Date.now() - lastEventAt) / 1000))}s ago`;
	}, [controllerHealth, lastEventAt]);

	const syncedCurrentTime = useMemo(() => {
		if (!nowPlaying) return 0;
		const base = nowPlaying.currentTime ?? 0;
		if (playback.paused) return base;
		const elapsed = Math.max(0, (Date.now() - nowPlayingUpdatedAt) / 1000);
		return Math.min(nowPlaying.duration || 0, base + elapsed);
	}, [nowPlaying, nowPlayingUpdatedAt, playback.paused]);

	const progressRatio = nowPlaying?.duration ? Math.max(0, Math.min(1, syncedCurrentTime / nowPlaying.duration)) : 0;
	const queueTotal = modQueue.length + viewerQueue.length;
	const stateLabel = controllerHealth !== "healthy" ? "Offline" : playback.paused ? "Paused" : "Playing";
	const upcomingCount = nextClips.length;
	const controlsDisabled = !controlsUnlocked;
	const interactiveControlsDisabled = mounted ? controlsDisabled : false;

	const setVolume = async (nextVolume: number) => {
		setIsApplyingVolume(true);
		try {
			await executeControllerAction("set_volume", { volume: nextVolume });
		} finally {
			setIsApplyingVolume(false);
		}
	};

	const submitModClip = async () => {
		const clipUrl = modClipUrl.trim();
		if (!clipUrl || controlsDisabled) return;

		setIsSubmittingModClip(true);
		setModClipFeedback(null);
		try {
			const response = await executeControllerAction("add_mod_clip", { clipUrl });
			if (!response.ok) {
				setModClipFeedback({ tone: "danger", text: response.error ?? "Unable to add clip to mod queue." });
				return;
			}
			setModClipUrl("");
			setModClipFeedback({ tone: "success", text: "Clip added to mod queue." });
		} finally {
			setIsSubmittingModClip(false);
		}
	};

	return (
		<main className='min-h-screen bg-background text-foreground'>
			<div className='mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 py-3 lg:px-4 lg:py-4'>
				<Surface className='px-4 py-4 sm:px-5'>
					<div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
						<div className='flex min-w-0 items-center gap-4'>
							<div className='flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-default-100'>{nowPlaying?.thumbnailUrl ? <Image src={nowPlaying.thumbnailUrl} alt={nowPlaying.title} width={64} height={64} radius='none' className='h-16 w-16 object-cover' /> : <span className='text-[10px] font-semibold uppercase tracking-[0.18em] text-default-400'>Clip</span>}</div>
							<div className='min-w-0'>
								<h1 className='truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl'>{nowPlaying?.title ?? "No active clip"}</h1>
								<p className='mt-1 truncate text-sm text-default-500'>{nowPlaying ? `by ${nowPlaying.creatorName}` : `Overlay ${overlayId}`}</p>
								<div className='mt-2 flex flex-wrap gap-2'>
									<Chip startContent={controlsUnlocked ? <IconLockOpen2 size={12} /> : <IconLock size={12} />} size='sm' classNames={{ base: controlsUnlocked ? "bg-success/15 text-success-700" : "bg-warning/15 text-warning-700" }}>
										{controlsUnlocked ? "Controls unlocked" : "Controls locked"}
									</Chip>
									<Chip startContent={<IconBroadcast size={12} />} size='sm' classNames={{ base: "bg-default-100 text-foreground" }}>
										{statusText}
									</Chip>
									<Chip startContent={<IconPlayerPlayFilled size={12} />} size='sm' classNames={{ base: "bg-default-100 text-foreground" }}>
										{stateLabel}
									</Chip>
									<Chip startContent={<IconLayoutSidebarRightExpand size={12} />} size='sm' classNames={{ base: "bg-default-100 text-foreground" }}>
										{playback.showPlayer ? "Visible" : "Hidden"}
									</Chip>
									<Chip size='sm' classNames={{ base: "bg-default-100 text-foreground" }}>
										{queueTotal} queued
									</Chip>
									<Chip size='sm' classNames={{ base: "bg-default-100 text-foreground" }}>
										{upcomingCount} preloaded
									</Chip>
								</div>
							</div>
						</div>
						<div className='rounded-[24px] bg-default-50 px-4 py-3 xl:min-w-[420px]'>
							<div className='flex items-center justify-between gap-4 text-xs text-default-500'>
								<span>{formatDuration(syncedCurrentTime)}</span>
								<span>{formatDuration(nowPlaying?.duration ?? 0)}</span>
							</div>
							<Progress className='mt-3' value={Math.round(progressRatio * 100)} size='sm' color='primary' aria-label='Header playback progress' />
							{controllerHealth === "disconnected" ? <p className='mt-3 text-xs font-medium text-danger'>Disconnected stream. No live heartbeat from the overlay player.</p> : null}
							{controllerHealth === "player_missing" ? <p className='mt-3 text-xs font-medium text-warning-700'>Connected, but no running player is publishing state.</p> : null}
						</div>
					</div>
				</Surface>

				<div className='grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]'>
					<Surface className='overflow-hidden'>
						<div className='p-4 sm:p-5'>
							<div className='grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]'>
								<div className='flex min-h-[520px] flex-col gap-5'>
									<div className='rounded-[24px] bg-default-50 p-4'>
										<div className='flex items-center justify-between gap-4 text-xs text-default-500'>
											<span>{formatDuration(syncedCurrentTime)}</span>
											<span>{formatDuration(nowPlaying?.duration ?? 0)}</span>
										</div>
										<Progress className='mt-3' value={Math.round(progressRatio * 100)} size='sm' color='primary' aria-label='Playback progress' />
										<div className='mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
											<div>
												<div className='truncate text-sm font-semibold text-foreground'>{nowPlaying?.title ?? "No active clip"}</div>
												<div className='truncate text-xs text-default-500'>{nowPlaying?.creatorName ?? "Waiting for overlay state"}</div>
											</div>
											<div className='flex items-center gap-2 rounded-full bg-content1 px-3 py-2'>
												<Button isIconOnly radius='full' variant='light' className={controlsUnlocked ? "bg-success/15 text-success-600" : "bg-warning/15 text-warning-600"} onPress={() => setControlsUnlocked((value) => !value)}>
													{controlsUnlocked ? <IconLockOpen2 size={18} /> : <IconLock size={18} />}
												</Button>
												<Button isIconOnly radius='full' variant='light' className='bg-default-200 text-foreground' onPress={() => sendCommand(playback.showPlayer ? "hide" : "show")} isDisabled={interactiveControlsDisabled}>
													{playback.showPlayer ? <IconEyeOff size={18} /> : <IconEye size={18} />}
												</Button>
												<Button
													isIconOnly
													radius='full'
													variant='light'
													className='bg-default-200 text-foreground'
													onPress={async () => {
														if (controlsDisabled) return;
														if (playback.muted) {
															if ((playback.volume ?? 0) <= 0) {
																await setVolume(1);
															}
															sendCommand("unmute");
															return;
														}
														sendCommand("mute");
													}}
													isDisabled={interactiveControlsDisabled}
												>
													{playback.muted ? <IconVolumeOff size={18} className='text-danger' /> : <IconVolume size={18} />}
												</Button>
												<Button isIconOnly radius='full' variant='light' className='bg-primary text-white' onPress={() => sendCommand(playback.paused ? "play" : "pause")} isDisabled={interactiveControlsDisabled}>
													{playback.paused ? <IconPlayerPlayFilled size={18} /> : <IconPlayerPauseFilled size={18} />}
												</Button>
												<Button isIconOnly radius='full' variant='light' className='bg-default-200 text-foreground' onPress={() => sendCommand("skip")} isDisabled={interactiveControlsDisabled}>
													<IconPlayerSkipForward size={18} />
												</Button>
											</div>
										</div>
									</div>

									<div className='flex flex-1 flex-col rounded-[24px] bg-default-50 p-4'>
										<div className='flex items-center justify-between gap-3'>
											<div>
												<div className='text-sm font-semibold text-foreground'>Volume</div>
											</div>
											<div className='text-sm font-semibold text-default-500'>{volumeDraft}%</div>
										</div>
										<div className='mt-4 flex items-center gap-3'>
											{playback.muted ? <IconVolumeOff size={18} className='shrink-0 text-danger' /> : <IconVolume size={18} className='shrink-0 text-default-500' />}
											<Slider
												size='sm'
												minValue={0}
												maxValue={100}
												step={1}
												value={volumeDraft}
												onChange={(value) => setVolumeDraft(Number(Array.isArray(value) ? value[0] : value))}
												onChangeEnd={async (value) => {
													const final = Number(Array.isArray(value) ? value[0] : value);
													await setVolume(final);
												}}
												color='primary'
												isDisabled={mounted ? isApplyingVolume || interactiveControlsDisabled : false}
												aria-label='Set volume'
												className='flex-1'
											/>
										</div>
										{controlsDisabled ? <p className='mt-3 text-xs text-warning-700'>Unlock controls to change volume or mute.</p> : null}
									</div>
								</div>

								<div className='rounded-[24px] bg-default-50 p-4'>
									<div className='flex items-center justify-between gap-3'>
										<div>
											<div className='text-sm font-semibold text-foreground'>Add to mod queue</div>
										</div>
										<Button isIconOnly radius='full' variant='flat' className='bg-content1 text-foreground' isDisabled>
											<IconPlus size={16} />
										</Button>
									</div>
									<div className='mt-4 flex flex-col gap-3 sm:flex-row'>
										<input type='url' value={modClipUrl} onChange={(event) => setModClipUrl(event.target.value)} aria-label='Mod queue clip URL' placeholder='https://clips.twitch.tv/...' className='h-11 flex-1 rounded-full border border-default-200 bg-content1 px-4 text-sm text-foreground outline-none transition focus:border-primary' disabled={interactiveControlsDisabled || isSubmittingModClip} />
										<Button radius='full' color='primary' className='h-11 px-5 font-semibold' onPress={() => void submitModClip()} isDisabled={interactiveControlsDisabled || isSubmittingModClip || modClipUrl.trim().length === 0}>
											Add clip
										</Button>
									</div>
									{controlsDisabled ? <p className='mt-3 text-xs text-warning-700'>Unlock controls before queue edits.</p> : null}
									{modClipFeedback ? <p className={`mt-3 text-sm ${modClipFeedback.tone === "danger" ? "text-danger" : modClipFeedback.tone === "success" ? "text-success-600" : "text-default-500"}`}>{modClipFeedback.text}</p> : null}
								</div>
							</div>
						</div>
					</Surface>

					<Surface className='overflow-hidden'>
						<div className='border-b border-default-200 px-5 py-4'>
							<PanelLabel>Queue</PanelLabel>
							<h2 className='mt-1 text-xl font-bold text-foreground'>Up next</h2>
							<p className='mt-1 text-sm text-default-500'>
								{upcomingCount} clip{upcomingCount === 1 ? "" : "s"} ready to go.
							</p>
						</div>
						<div className='p-3'>
							<div className='rounded-[24px] bg-default-50 p-3'>
								<div className='mb-2 px-2 text-xs font-medium uppercase tracking-[0.2em] text-default-500'>Current</div>
								{nowPlaying ? <QueueRow clip={nowPlaying} accent /> : <div className='rounded-2xl bg-content1 px-4 py-6 text-center text-sm text-default-500'>Nothing playing.</div>}
								<div className='mb-2 mt-4 px-2 text-xs font-medium uppercase tracking-[0.2em] text-default-500'>Upcoming</div>
								{nextClips.length > 0 ? (
									<div className='grid gap-1'>
										{nextClips.slice(0, 4).map((clip, idx) => (
											<QueueRow key={`preloaded-${clip.clipId}-${idx}`} clip={clip} />
										))}
									</div>
								) : (
									<div className='rounded-2xl bg-content1 px-4 py-6 text-center text-sm text-default-500'>{isLive ? "No preloaded clip yet." : "Player disconnected."}</div>
								)}
							</div>
							<div className='rounded-[24px] bg-default-50 p-3'>
								<div className='mb-2 px-2 text-xs font-medium uppercase tracking-[0.2em] text-default-500'>Mod Queue</div>
								<div className='grid gap-1'>{modQueue.length > 0 ? modQueue.slice(0, 6).map((clip, idx) => <QueueRow key={`mod-${clip.clipId}-${idx}`} clip={clip} />) : <div className='rounded-2xl bg-content1 px-4 py-6 text-center text-sm text-default-500'>No mod clips queued.</div>}</div>
							</div>
							<div className='mt-3 rounded-[24px] bg-default-50 p-3'>
								<div className='mb-2 px-2 text-xs font-medium uppercase tracking-[0.2em] text-default-500'>Viewer Queue</div>
								<div className='grid gap-1'>{viewerQueue.length > 0 ? viewerQueue.slice(0, 6).map((clip, idx) => <QueueRow key={`viewer-${clip.clipId}-${idx}`} clip={clip} />) : <div className='rounded-2xl bg-content1 px-4 py-6 text-center text-sm text-default-500'>No viewer clips queued.</div>}</div>
							</div>
							<div className='mt-3 rounded-[24px] bg-default-50 p-3'>
								<div className='mb-2 flex flex-wrap gap-2 px-2'>
									<Button size='sm' variant='flat' className='rounded-full bg-content1 text-foreground' onPress={() => void executeControllerAction("clear_mod_queue")} isDisabled={interactiveControlsDisabled}>
										Clear mods
									</Button>
									<Button size='sm' variant='flat' className='rounded-full bg-content1 text-foreground' onPress={() => void executeControllerAction("clear_viewer_queue")} isDisabled={interactiveControlsDisabled}>
										Clear viewers
									</Button>
									<Button size='sm' variant='solid' color='danger' className='rounded-full' onPress={() => void executeControllerAction("clear_all_queues")} isDisabled={interactiveControlsDisabled}>
										Clear all
									</Button>
								</div>
							</div>
						</div>
					</Surface>
				</div>
			</div>
		</main>
	);
}
