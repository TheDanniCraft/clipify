"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getRunner, getStreamSessionsForRunner, upsertStreamSession, setStreamDesiredState } from "@actions/runner";
import { getAllOverlays } from "@actions/database";
import { Button, Card, Label, Select, Spinner, TextField, ListBox, Input, Chip, Separator } from "@heroui/react";
import { IconCopy, IconCheck, IconPlayerPlay, IconPlayerStop, IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { notify } from "@lib/toast";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import { runnersTable, streamSessionsTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import DashboardNavbar from "@components/dashboardNavbar";
import { AuthenticatedUser, Overlay, StreamMode, StreamState, RunnerStatus } from "@types";

type Runner = InferSelectModel<typeof runnersTable>;
type StreamSession = InferSelectModel<typeof streamSessionsTable>;

export default function RunnerPage() {
	const params = useParams() as { id: string };
	const router = useRouter();

	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [runner, setRunner] = useState<Runner | null>(null);
	const [streamSessions, setStreamSessions] = useState<StreamSession[]>([]);
	const [overlays, setOverlays] = useState<Overlay[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [clearStreamKey, setClearStreamKey] = useState<boolean>(false);
	const [copied, setCopied] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const [previewImage, setPreviewImage] = useState<string | null>(null);
	const [nextUpdateIn, setNextUpdateIn] = useState<number>(0);
	const [previewLoading, setPreviewLoading] = useState(true);

	const [preset, setPreset] = useState<string>("custom");
	const [rtmpUrl, setRtmpUrl] = useState("");
	const [streamKey, setStreamKey] = useState("");
	const [overlayId, setOverlayId] = useState("");
	const [mode, setMode] = useState<StreamMode>(StreamMode.AlwaysOn);
	const hasMounted = useRef(false);

	useEffect(() => {
		if (!user) return;

		const pollData = async () => {
			try {
				const [fetchedRunner, fetchedSessions] = await Promise.all([getRunner(params.id, user.id), getStreamSessionsForRunner(params.id, user.id)]);

				if (fetchedRunner) setRunner(fetchedRunner);
				if (fetchedSessions) setStreamSessions(fetchedSessions);

				if (fetchedRunner?.status === "online" && fetchedSessions[0]?.actualState === "running" && fetchedSessions[0]?.overlayId) {
					const res = await fetch(`/api/runner/preview?overlayId=${fetchedSessions[0].overlayId}`);
					if (res.ok) {
						const data = await res.json();
						if (data.image) setPreviewImage(data.image);
						else setPreviewImage(null);
					}
					setPreviewLoading(false);
				} else {
					setPreviewImage(null);
					setPreviewLoading(false);
				}
			} catch (e) {
				console.error("Polling error", e);
			}
		};

		const interval = setInterval(() => {
			pollData();
			setNextUpdateIn(2);
		}, 2000);

		const countdown = setInterval(() => {
			setNextUpdateIn((prev) => Math.max(0, prev - 1));
		}, 1000);

		return () => {
			clearInterval(interval);
			clearInterval(countdown);
		};
	}, [params.id, user]);

	useEffect(() => {
		async function init() {
			const authUser = await validateAuth();
			if (!authUser) {
				router.push("/login");
				return;
			}
			setUser(authUser);

			const [fetchedRunner, fetchedSessions, fetchedOverlays] = await Promise.all([getRunner(params.id, authUser.id), getStreamSessionsForRunner(params.id, authUser.id), getAllOverlays(authUser.id)]);

			if (!fetchedRunner) {
				router.push("/dashboard");
				return;
			}

			setRunner(fetchedRunner);
			setStreamSessions(fetchedSessions);
			setOverlays(fetchedOverlays || []);

			const session = fetchedSessions[0];
			if (session) {
				setRtmpUrl(session.rtmpUrl);
				setOverlayId(session.overlayId);
				setMode(session.mode as StreamMode);

				if (session.rtmpUrl === "rtmp://live.twitch.tv/app") setPreset("twitch");
				else if (session.rtmpUrl === "rtmp://a.rtmp.youtube.com/live2") setPreset("youtube");
				else setPreset("custom");
			} else if (fetchedOverlays && fetchedOverlays.length > 0) {
				setOverlayId(fetchedOverlays[0].id);
				setRtmpUrl("rtmp://live.twitch.tv/app");
				setPreset("twitch");
			}

			setIsLoading(false);
		}

		if (!hasMounted.current) {
			hasMounted.current = true;
			init();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params.id]);

	if (isLoading || !runner || !user) {
		return <FullscreenLoadingState message='Loading runner configuration' />;
	}

	const copyToken = () => {
		navigator.clipboard.writeText(runner.token);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handlePresetChange = (value: string) => {
		setPreset(value);
		setStreamKey(""); // Clear stream key when preset changes for security
		setClearStreamKey(true);
		if (value === "twitch") {
			setRtmpUrl("rtmp://live.twitch.tv/app");
		} else if (value === "youtube") {
			setRtmpUrl("rtmp://a.rtmp.youtube.com/live2");
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		const res = await upsertStreamSession({
			id: streamSessions[0]?.id,
			ownerId: runner.ownerId,
			runnerId: runner.id,
			overlayId,
			mode,
			rtmpUrl,
			streamKey,
			clearStreamKey,
		});

		setIsSaving(false);
		if (res.success) {
			notify({ title: "Saved", description: "Stream session configuration saved.", color: "success" });
			const fetchedSessions = await getStreamSessionsForRunner(params.id, user.id);
			setStreamSessions(fetchedSessions);
		} else {
			notify({ title: "Error", description: "Failed to save stream session.", color: "danger" });
		}
	};

	const handleAction = async (state: "started" | "stopped") => {
		if (!streamSessions[0]?.id) return;
		const res = await setStreamDesiredState(streamSessions[0].id, state === "started" ? StreamState.Running : StreamState.Stopped);
		if (res.success) {
			notify({ title: "Action sent", description: `Stream state set to ${state}.`, color: "success" });
			const fetchedSessions = await getStreamSessionsForRunner(params.id, user.id);
			setStreamSessions(fetchedSessions);
		}
	};

	return (
		<DashboardNavbar user={user} title='Runner Settings' tagline='Configure hardware streaming'>
			<div className='flex flex-col items-center justify-center w-full p-4'>
				<Card className='w-full max-w-5xl'>
					<Card.Header className='flex w-full flex-row items-center justify-between gap-4 p-6'>
						<div className='flex min-w-0 items-center gap-3'>
							<Button isIconOnly variant='tertiary' onPress={() => router.push("/dashboard")}>
								<IconArrowLeft />
							</Button>
							<h1 className='text-xl font-bold'>Runner Settings</h1>
						</div>
						<div className='flex items-center gap-2'>
							{runner.status === "online" ? (
								streamSessions[0]?.actualState === "running" ? (
									<Chip color='danger' variant='soft'>
										Streaming (LIVE)
									</Chip>
								) : (
									<Chip color='success' variant='soft'>
										Online
									</Chip>
								)
							) : (
								<Chip color='default' variant='soft'>
									Offline
								</Chip>
							)}
						</div>
					</Card.Header>
					<Separator />

					<Card.Content className='grid grid-cols-1 md:grid-cols-2 gap-8 p-6'>
						{/* Installation Instructions for New Runners */}
						{!runner.lastHeartbeatAt && (
							<div className='col-span-1 md:col-span-2 bg-primary/10 border border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-4 mb-4'>
								<h2 className='text-2xl font-bold text-primary'>Setup Your Runner</h2>
								<p className='text-muted-foreground max-w-2xl text-sm'>This runner has not been connected yet. To get started, download the runner executable for your operating system. Once downloaded, start it in your terminal and provide the runner token shown in the authentication section below.</p>
								<div className='flex flex-wrap gap-4 mt-2'>
									<Button
										variant='primary'
										onPress={() => {
											window.location.href = "/downloads/runner/clipify-runner-windows.exe";
										}}
									>
										Download for Windows (.exe)
									</Button>
									<Button
										variant='secondary'
										onPress={() => {
											window.location.href = "/downloads/runner/clipify-runner-linux";
										}}
									>
										Download for Linux
									</Button>
								</div>
							</div>
						)}

						{/* Left Column: Status Details */}
						<div className='flex flex-col gap-6'>
							<div className='flex flex-col gap-2'>
								<div className='flex items-center justify-between'>
									<h2 className='text-lg font-semibold'>Runner Telemetry</h2>
									<span className='text-xs text-muted font-mono'>Refreshing in {nextUpdateIn}s...</span>
								</div>

								<div className='flex flex-col gap-2 text-sm mt-2'>
									<div className='flex justify-between border-b border-divider pb-2'>
										<span className='text-muted'>Hardware Node</span>
										<span className='font-medium'>{runner.name}</span>
									</div>
									<div className='flex justify-between border-b border-divider pb-2'>
										<span className='text-muted'>Runner Version</span>
										<span>{runner.version || "Unknown"}</span>
									</div>
									<div className='flex justify-between border-b border-divider pb-2'>
										<span className='text-muted'>OS</span>
										<span>{runner.osInfo || "Unknown"}</span>
									</div>
									<div className='flex justify-between border-b border-divider pb-2'>
										<span className='text-muted'>Last Ping</span>
										<span>{runner.lastHeartbeatAt ? new Date(runner.lastHeartbeatAt).toLocaleTimeString() : "Never"}</span>
									</div>
									{streamSessions[0] && (
										<div className='flex justify-between border-b border-divider pb-2'>
											<span className='text-muted'>Quality</span>
											<span>
												{streamSessions[0].resolution} @ {streamSessions[0].fps} FPS
											</span>
										</div>
									)}
									{streamSessions[0]?.lastError && (
										<div className='bg-danger/10 border border-danger/20 p-3 rounded-md mt-2 text-danger'>
											<strong>Error:</strong> {streamSessions[0].lastError}
										</div>
									)}
								</div>
							</div>

							<div className='flex flex-col gap-2 mt-4'>
								<h2 className='text-lg font-semibold'>Live Stream Preview</h2>

								<div className='w-full aspect-video bg-neutral-900 rounded-lg border border-divider overflow-hidden flex items-center justify-center'>
									{streamSessions[0]?.actualState !== "running" ? (
										<span className='text-muted text-sm'>Stream is offline</span>
									) : previewLoading ? (
										<Spinner size='md' />
									) : previewImage ? (
										/* eslint-disable-next-line @next/next/no-img-element */
										<img src={previewImage} alt='Live Stream Preview' className='w-full h-full object-contain' />
									) : (
										<span className='text-muted text-sm'>Waiting for first frame...</span>
									)}
								</div>
								<p className='text-xs text-muted text-center mt-1'>Livestream Preview Snapshot</p>
							</div>
						</div>

						{/* Right Column: Configuration */}
						<div className='flex flex-col gap-8'>
							<div className='flex flex-col gap-4'>
								<h2 className='text-lg font-semibold'>Authentication</h2>
								<TextField variant='secondary'>
									<Label>Runner Token</Label>
									<div className='flex gap-2'>
										<Input readOnly value={runner.token} type='password' className='font-mono text-sm flex-1' />
										<Button isIconOnly variant='secondary' onPress={copyToken}>
											{copied ? <IconCheck size={18} className='text-success' /> : <IconCopy size={18} />}
										</Button>
									</div>
								</TextField>
								<p className='text-xs text-muted -mt-2'>Use this token when starting your local runner binary.</p>
							</div>

							<div className='flex flex-col gap-5'>
								<h3 className='text-lg font-semibold'>Stream Configuration</h3>

								<Select value={overlayId || null} onChange={(selected) => setOverlayId(String(selected ?? ""))} variant='secondary'>
									<Label>Target Overlay</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{overlays.map((overlay) => (
												<ListBox.Item id={overlay.id} key={overlay.id} textValue={overlay.name}>
													<ListBox.ItemIndicator />
													<Label>{overlay.name}</Label>
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>

								<Select value={mode || null} onChange={(selected) => setMode(String(selected ?? "") as StreamMode)} variant='secondary'>
									<Label>Engine Mode</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{[
												{ id: StreamMode.AlwaysOn, name: "24/7 Cloud Loop (Puppeteer)" },
												{ id: StreamMode.Failsafe, name: "Failsafe Mode (Local OBS Fallback)" },
											].map((item) => (
												<ListBox.Item id={item.id} key={item.id} textValue={item.name}>
													<ListBox.ItemIndicator />
													<Label>{item.name}</Label>
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>

								{mode === StreamMode.Failsafe && (
									<div className='bg-warning/10 border border-warning/20 p-4 rounded-md text-sm text-warning-600 dark:text-warning-400 leading-relaxed'>
										<strong>Failsafe Mode Active:</strong> Direct your local OBS to stream to <code>rtmp://localhost:1935/live</code> (the Stream Key in OBS can be left empty). If your OBS connection drops, the local Runner will instantly fallback to the 24/7 Cloud Loop.
									</div>
								)}

								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<Select value={preset || null} onChange={(selected) => handlePresetChange(String(selected ?? ""))} variant='secondary'>
										<Label>Stream Target Preset</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												{[
													{ id: "twitch", name: "Twitch" },
													{ id: "youtube", name: "YouTube" },
													{ id: "custom", name: "Custom RTMP" },
												].map((item) => (
													<ListBox.Item id={item.id} key={item.id} textValue={item.name}>
														<ListBox.ItemIndicator />
														<Label>{item.name}</Label>
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
								</div>

								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<TextField variant='secondary'>
										<Label>RTMP URL</Label>
										<Input value={rtmpUrl} onChange={(e) => setRtmpUrl(e.target.value)} readOnly={preset !== "custom"} />
									</TextField>

									<TextField variant='secondary'>
										<Label>Stream Key (Optional)</Label>
										<div className='relative w-full'>
											<Input
												type='password'
												value={streamKey}
												onChange={(e) => {
													setStreamKey(e.target.value);
													setClearStreamKey(e.target.value === "");
												}}
												placeholder={streamSessions[0]?.encryptedStreamKey && !clearStreamKey ? "******** (Saved)" : "live_xxx_..."}
												className='w-full pr-10'
											/>
											{streamSessions[0]?.encryptedStreamKey && !clearStreamKey && (
												<Button
													isIconOnly
													variant='ghost'
													size='sm'
													className='absolute right-1 top-1/2 -translate-y-1/2 min-w-8 w-8 h-8'
													onPress={() => {
														setStreamKey("");
														setClearStreamKey(true);
													}}
												>
													<IconTrash size={16} className='text-danger' />
												</Button>
											)}
										</div>
										<p className='text-xs text-muted mt-1'>Leave blank if embedded in the custom RTMP URL.</p>
									</TextField>
								</div>

								<div className='flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-divider'>
									<Button variant='primary' onPress={handleSave} isPending={isSaving} className='sm:w-auto w-full'>
										{isSaving ? <Spinner size='sm' color='current' /> : "Save Configuration"}
									</Button>

									{runner.lastHeartbeatAt && (
										<Button
											variant='secondary'
											onPress={() => {
												const isWindows = navigator.userAgent.toLowerCase().includes("win");
												window.location.href = `/downloads/runner/clipify-runner-${isWindows ? "windows.exe" : "linux"}`;
											}}
											className='sm:w-auto w-full'
										>
											Download Latest Runner
										</Button>
									)}

									{streamSessions[0]?.id && (
										<div className='flex gap-3 sm:ml-auto w-full sm:w-auto'>
											<Button className='bg-success text-success-foreground' onPress={() => handleAction("started")} isDisabled={runner?.status !== RunnerStatus.Online || streamSessions[0]?.desiredState === StreamState.Running}>
												<IconPlayerPlay size={18} /> Start
											</Button>
											<Button className='bg-danger text-danger-foreground' onPress={() => handleAction("stopped")} isDisabled={streamSessions[0]?.desiredState === StreamState.Stopped}>
												<IconPlayerStop size={18} /> Stop
											</Button>
										</div>
									)}
								</div>
							</div>
						</div>
					</Card.Content>
				</Card>
			</div>
		</DashboardNavbar>
	);
}
