"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getRunner, getRunnerVersionManifest, getStreamSessionsForRunner, upsertStreamSession, setStreamDesiredState, unlinkRunner } from "@actions/runner";
import { getAllOverlays } from "@actions/database";
import { Button, Card, Label, Select, Spinner, TextField, ListBox, Input, Chip, Separator, Modal, Dropdown, Tooltip } from "@heroui/react";
import { IconCopy, IconCheck, IconDownload, IconPlayerPlay, IconPlayerStop, IconArrowLeft, IconTrash, IconBrandWindows, IconTerminal2, IconBrandApple, IconAlertTriangle, IconCircleCheck, IconUnlink } from "@tabler/icons-react";
import { notify } from "@lib/toast";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import ConfirmModal from "@components/confirmModal";
import { runnersTable, streamSessionsTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import DashboardNavbar from "@components/dashboardNavbar";
import { AuthenticatedUser, Overlay, StreamMode, StreamState, RunnerStatus } from "@types";

type Runner = InferSelectModel<typeof runnersTable>;
type StreamSession = InferSelectModel<typeof streamSessionsTable>;
type RunnerPlatform = "windows" | "linux" | "linux-arm64" | "macos" | "macos-arm64";
type RunnerVersionManifest = Awaited<ReturnType<typeof getRunnerVersionManifest>>;

const runnerPlatformLabels: Record<RunnerPlatform, string> = {
	windows: "Windows",
	linux: "Linux x64",
	"linux-arm64": "Linux ARM64",
	macos: "macOS Intel",
	"macos-arm64": "macOS Apple Silicon",
};

function formatRunnerVersion(version: string | null | undefined) {
	if (!version) return "Unknown";
	const normalized = normalizeRunnerVersion(version);
	return normalized.slice(0, 8);
}

function normalizeRunnerVersion(version: string | null | undefined) {
	return (version ?? "").trim().replace(/^v/i, "");
}

function getRunnerVersionHashes(osInfo: string | null | undefined, manifest: RunnerVersionManifest) {
	if (!manifest) return [];

	const normalizedOs = osInfo?.toLowerCase() ?? "";
	if (normalizedOs.includes("windows")) return manifest.windows ? [normalizeRunnerVersion(manifest.windows)] : [];
	if (normalizedOs.includes("linux")) {
		if (normalizedOs.includes("arm64") || normalizedOs.includes("aarch64")) return manifest.linuxArm ? [normalizeRunnerVersion(manifest.linuxArm)] : [];
		return manifest.linux ? [normalizeRunnerVersion(manifest.linux)] : [];
	}
	if (normalizedOs.includes("darwin") || normalizedOs.includes("mac")) {
		if (normalizedOs.includes("arm64") || normalizedOs.includes("aarch64")) return manifest.macosArm ? [normalizeRunnerVersion(manifest.macosArm)] : [];
		if (normalizedOs.includes("x64") || normalizedOs.includes("x86_64")) return manifest.macos ? [normalizeRunnerVersion(manifest.macos)] : [];
		return [manifest.macos, manifest.macosArm].filter((hash): hash is string => Boolean(hash)).map(normalizeRunnerVersion);
	}

	return [manifest.windows, manifest.linux, manifest.linuxArm, manifest.macos, manifest.macosArm].filter((hash): hash is string => Boolean(hash)).map(normalizeRunnerVersion);
}

function getRunnerVersionState(runner: Runner, manifest: RunnerVersionManifest) {
	if (!runner.version) return "unknown";

	const latestHashes = getRunnerVersionHashes(runner.osInfo, manifest);
	if (!latestHashes.length) return "unknown";

	return latestHashes.includes(normalizeRunnerVersion(runner.version)) ? "latest" : "outdated";
}

function getRunnerPlatformFromOs(osInfo: string | null | undefined) {
	const normalizedOs = osInfo?.toLowerCase() ?? "";
	if (normalizedOs.includes("windows")) return "windows" as const;
	if (normalizedOs.includes("linux")) return normalizedOs.includes("arm64") || normalizedOs.includes("aarch64") ? ("linux-arm64" as const) : ("linux" as const);
	if (normalizedOs.includes("darwin") || normalizedOs.includes("mac")) {
		if (normalizedOs.includes("arm64") || normalizedOs.includes("aarch64")) return "macos-arm64" as const;
		if (normalizedOs.includes("x64") || normalizedOs.includes("x86_64")) return "macos" as const;
		return null;
	}
	return null;
}

export default function RunnerPage() {
	const params = useParams() as { id: string };
	const router = useRouter();

	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [runner, setRunner] = useState<Runner | null>(null);
	const [runnerVersionManifest, setRunnerVersionManifest] = useState<RunnerVersionManifest>(null);
	const [streamSessions, setStreamSessions] = useState<StreamSession[]>([]);
	const [overlays, setOverlays] = useState<Overlay[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [clearStreamKey, setClearStreamKey] = useState<boolean>(false);
	const [copied, setCopied] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const [previewImage, setPreviewImage] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(true);
	const [installPlatform, setInstallPlatform] = useState<RunnerPlatform | null>(null);

	const [preset, setPreset] = useState<string>("custom");
	const [rtmpUrl, setRtmpUrl] = useState("");
	const [streamKey, setStreamKey] = useState("");
	const [overlayId, setOverlayId] = useState("");
	const [mode, setMode] = useState<StreamMode>(StreamMode.AlwaysOn);
	const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
	const hasMounted = useRef(false);

	useEffect(() => {
		if (!user) return;

		const pollData = async () => {
			try {
				const [fetchedRunner, fetchedSessions, fetchedVersionManifest] = await Promise.all([getRunner(params.id, user.id), getStreamSessionsForRunner(params.id, user.id), getRunnerVersionManifest()]);

				if (fetchedRunner) setRunner(fetchedRunner);
				if (fetchedSessions) setStreamSessions(fetchedSessions);
				setRunnerVersionManifest(fetchedVersionManifest);

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
		}, 2000);

		return () => {
			clearInterval(interval);
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

			const [fetchedRunner, fetchedSessions, fetchedOverlays, fetchedVersionManifest] = await Promise.all([getRunner(params.id, authUser.id), getStreamSessionsForRunner(params.id, authUser.id), getAllOverlays(authUser.id), getRunnerVersionManifest()]);

			if (!fetchedRunner) {
				router.push("/dashboard");
				return;
			}

			setRunner(fetchedRunner);
			setRunnerVersionManifest(fetchedVersionManifest);
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

	const handleUnlinkRunner = async () => {
		const res = await unlinkRunner(runner.id, runner.ownerId);
		if (res.success) {
			notify({ title: "Runner unlinked", description: "The runner token was revoked.", color: "success" });
			router.refresh();
			return;
		}

		notify({ title: "Error", description: res.error || "Failed to unlink runner.", color: "danger" });
	};

	const getRunnerDownloadUrl = (platform: RunnerPlatform) => `/api/runner/download?os=${platform}`;

	const handleRunnerDownload = (platform: RunnerPlatform) => {
		setInstallPlatform(platform);
		const link = document.createElement("a");
		link.href = getRunnerDownloadUrl(platform);
		link.download = "";
		link.rel = "noopener";
		document.body.appendChild(link);
		link.click();
		link.remove();
	};

	const renderPlatformIcon = (platform: RunnerPlatform) => {
		if (platform === "windows") return <IconBrandWindows size={18} />;
		if (platform === "linux" || platform === "linux-arm64") return <IconTerminal2 size={18} />;
		return <IconBrandApple size={18} />;
	};

	const renderLinuxDownloadDropdown = (label: string, isDisabled = false, variant: "secondary" | "primary" = "secondary", className?: string) => (
		<Dropdown>
			<Dropdown.Trigger isDisabled={isDisabled} className={["button button--md", `button--${variant}`, "inline-flex items-center justify-center gap-2", className].filter(Boolean).join(" ")}>
				<IconTerminal2 size={18} />
				{label}
			</Dropdown.Trigger>
			<Dropdown.Popover>
				<Dropdown.Menu aria-label='Select Linux runner build'>
					<Dropdown.Item id='linux-x64' textValue='Linux x64' onAction={() => handleRunnerDownload("linux")}>
						Linux x64
					</Dropdown.Item>
					<Dropdown.Item id='linux-arm64' textValue='Linux ARM64' onAction={() => handleRunnerDownload("linux-arm64")}>
						Linux ARM64
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);

	const renderMacOSDownloadDropdown = (label: string, isDisabled = false, variant: "secondary" | "primary" = "secondary", className?: string) => (
		<Dropdown>
			<Dropdown.Trigger isDisabled={isDisabled} className={["button button--md", `button--${variant}`, "inline-flex items-center justify-center gap-2", className].filter(Boolean).join(" ")}>
				<IconBrandApple size={18} />
				{label}
			</Dropdown.Trigger>
			<Dropdown.Popover>
				<Dropdown.Menu aria-label='Select macOS runner build'>
					<Dropdown.Item id='macos-intel' textValue='macOS Intel' onAction={() => handleRunnerDownload("macos")}>
						macOS Intel
					</Dropdown.Item>
					<Dropdown.Item id='macos-apple-silicon' textValue='macOS Apple Silicon' onAction={() => handleRunnerDownload("macos-arm64")}>
						macOS Apple Silicon
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);

	const renderLatestRunnerDownload = () => {
		const platform = getRunnerPlatformFromOs(runner.osInfo);
		const isLatest = runnerVersionState === "latest";
		const label = isLatest ? "Runner up to date" : "Download latest runner";
		const variant = isLatest ? "secondary" : "primary";

		if (!platform) {
			return renderMacOSDownloadDropdown(label, isLatest, variant, "w-full justify-center");
		}

		if (platform === "macos" || platform === "macos-arm64") {
			return (
				<Button variant={variant} isDisabled={isLatest} onPress={() => handleRunnerDownload(platform)} className='w-full justify-center'>
					{renderPlatformIcon(platform)}
					{label}
				</Button>
			);
		}

		return (
			<Button variant={variant} isDisabled={isLatest} onPress={() => handleRunnerDownload(platform)} className='w-full justify-center'>
				{renderPlatformIcon(platform)}
				{label}
			</Button>
		);
	};

	const renderInstallSteps = () => {
		if (!installPlatform) return null;

		if (installPlatform === "windows") {
			return (
				<ol className='list-decimal space-y-2 pl-5 text-sm text-muted-foreground'>
					<li>Open the downloaded Clipify Runner file.</li>
					<li>Approve the runner enrollment in your browser. If the browser does not open automatically, use the URL and code shown by the runner.</li>
					<li>Return to this page after the runner shows as online.</li>
				</ol>
			);
		}

		if (installPlatform === "linux" || installPlatform === "linux-arm64") {
			const linuxBinaryName = installPlatform === "linux-arm64" ? "clipify-runner-linux-arm64" : "clipify-runner-linux";
			return (
				<ol className='list-decimal space-y-2 pl-5 text-sm text-muted-foreground'>
					<li>Open a terminal in your Downloads folder.</li>
					<li>
						Run <code className='rounded bg-secondary px-1.5 py-0.5 text-foreground'>chmod +x {linuxBinaryName}</code>.
					</li>
					<li>
						Run <code className='rounded bg-secondary px-1.5 py-0.5 text-foreground'>./{linuxBinaryName}</code>.
					</li>
					<li>Open the enrollment URL shown by the runner on any device and enter the code.</li>
				</ol>
			);
		}

		return (
			<div className='space-y-4'>
				<ol className='list-decimal space-y-2 pl-5 text-sm text-muted-foreground'>
					<li>Open your Downloads folder.</li>
					<li>Control-click Clipify Runner, then choose Open.</li>
					<li>If macOS blocks it, open System Settings.</li>
					<li>Go to Privacy &amp; Security and click Open Anyway.</li>
					<li>Click Open, then approve the runner enrollment in your browser. If the browser does not open automatically, use the URL and code shown by the runner.</li>
				</ol>
				<p className='rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground'>Apple adds this extra step for apps from developers who are not yet in the Apple Developer Program. You only need to approve this runner once.</p>
			</div>
		);
	};

	const runnerVersionState = getRunnerVersionState(runner, runnerVersionManifest);
	const runnerVersionLabel = formatRunnerVersion(runner.version);
	const isRunnerStreaming = runner.status === "online" && streamSessions[0]?.actualState === "running";
	const canUnlinkRunner = !isRunnerStreaming;
	const runnerConnectionLabel = runner.lastHeartbeatAt ? "Offline" : "Not connected";

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
						<div className='flex items-center gap-1.5'>
							{runner.status === "online" ? (
								<div className='flex items-center gap-1.5'>
									{isRunnerStreaming ? (
										<Chip color='danger' variant='soft'>
											Streaming (LIVE)
										</Chip>
									) : (
										<Chip color='success' variant='soft'>
											Online
										</Chip>
									)}
									<Tooltip delay={0}>
										<Tooltip.Trigger>
											<span>
												<Button size='sm' variant='ghost' className='h-6 min-w-6 px-1.5 text-foreground' onPress={() => setIsUnlinkConfirmOpen(true)} aria-label='Unlink runner' isDisabled={!canUnlinkRunner}>
													<IconUnlink size={13} />
												</Button>
											</span>
										</Tooltip.Trigger>
										<Tooltip.Content>{canUnlinkRunner ? "Unlink runner and revoke its token" : "Stop this runner to unlink"}</Tooltip.Content>
									</Tooltip>
								</div>
							) : (
								<div className='flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-warning'>
									<span className='h-2.5 w-2.5 rounded-full bg-warning' />
									<span className='text-sm font-medium leading-none'>{runnerConnectionLabel}</span>
									<Tooltip delay={0}>
										<Tooltip.Trigger>
											<span>
												<Button size='sm' variant='ghost' className='h-6 min-w-6 px-1.5 text-foreground' onPress={() => setIsUnlinkConfirmOpen(true)} aria-label='Unlink runner' isDisabled={!canUnlinkRunner}>
													<IconUnlink size={13} />
												</Button>
											</span>
										</Tooltip.Trigger>
										<Tooltip.Content>{canUnlinkRunner ? "Unlink runner and revoke its token" : "Stop this runner to unlink"}</Tooltip.Content>
									</Tooltip>
								</div>
							)}
						</div>
					</Card.Header>
					<Separator />

					<Card.Content className='grid grid-cols-1 md:grid-cols-2 gap-8 p-6'>
						{/* Installation Instructions for New Runners */}
						{!runner.lastHeartbeatAt && (
							<div className='col-span-1 md:col-span-2 flex flex-col items-center justify-center p-8 mt-4 gap-6'>
								<h2 className='text-3xl font-bold text-primary'>Setup Your Runner</h2>
								<p className='text-muted-foreground max-w-2xl text-center text-base'>This runner is linked to your account but has not checked in yet. Download the runner for your operating system, run it, and approve the browser enrollment prompt. The runner will connect to this Clipify environment automatically.</p>
								<div className='flex flex-col sm:flex-row gap-4 mt-6'>
									<Button
										variant='secondary'
										onPress={() => {
											handleRunnerDownload("windows");
										}}
									>
										<IconBrandWindows size={20} /> Download for Windows
									</Button>
									{renderLinuxDownloadDropdown("Download for Linux")}
									{renderMacOSDownloadDropdown("Download for macOS")}
								</div>
								<p className='text-sm text-muted/80 max-w-lg mt-8 text-center bg-secondary/30 p-4 rounded-lg'>This runner is currently connected to one Clipify account. To use it with another account or environment, unlink it here and start the runner again.</p>
							</div>
						)}

						{/* Only show configuration and telemetry if the runner is active */}
						{runner.lastHeartbeatAt && (
							<>
								{/* Left Column: Status Details */}
								<div className='flex flex-col gap-6'>
									<div className='flex flex-col gap-2'>
										<div className='flex items-center justify-between'>
											<h2 className='text-lg font-semibold'>Runner Telemetry</h2>
											<span className='text-xs text-muted font-mono'>Refreshing every 2s</span>
										</div>

										<div className='flex flex-col gap-2 text-sm mt-2'>
											<div className='flex justify-between border-b border-divider pb-2'>
												<span className='text-muted'>Hardware Node</span>
												<span className='font-medium'>{runner.name}</span>
											</div>
											<div className='flex justify-between border-b border-divider pb-2'>
												<span className='text-muted'>Runner Version</span>
												<span className='flex min-w-0 items-center justify-end gap-2'>
													<span className='max-w-[120px] truncate font-mono' title={runner.version || undefined}>
														{runnerVersionLabel}
													</span>
													{runnerVersionState === "latest" ? <IconCircleCheck size={16} className='shrink-0 text-success' aria-label='Latest runner version' /> : runnerVersionState === "outdated" ? <IconAlertTriangle size={16} className='shrink-0 text-warning' aria-label='Runner update available' /> : null}
												</span>
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

									{renderLatestRunnerDownload()}

									<details className='group border border-divider rounded-lg [&_summary::-webkit-details-marker]:hidden'>
										<summary className='flex cursor-pointer items-center justify-between gap-1.5 rounded-lg p-4 font-medium'>
											<span className='text-sm font-semibold'>Advanced / Docker Setup</span>
											<span className='transition duration-300 group-open:-rotate-180'>
												<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='size-5'>
													<path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
												</svg>
											</span>
										</summary>
										<div className='px-4 pb-4'>
											<div className='flex flex-col gap-2'>
												<TextField variant='secondary'>
													<Label>Manual Runner Token</Label>
													<div className='flex gap-2'>
														<Input readOnly value={runner.token} type='password' className='font-mono text-sm flex-1' />
														<Button isIconOnly variant='secondary' onPress={copyToken}>
															{copied ? <IconCheck size={18} className='text-success' /> : <IconCopy size={18} />}
														</Button>
													</div>
												</TextField>
												<p className='text-xs text-muted mt-1'>
													If you run this via Docker or in a headless CI environment, use this token as the <code>CLIPIFY_TOKEN</code> environment variable.
												</p>
											</div>
										</div>
									</details>

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
							</>
						)}
					</Card.Content>
				</Card>
				<Modal>
					<Modal.Backdrop isOpen={!!installPlatform} onOpenChange={(isOpen) => !isOpen && setInstallPlatform(null)}>
						<Modal.Container size='lg'>
							<Modal.Dialog>
								<Modal.CloseTrigger />
								<Modal.Header className='flex flex-col gap-2 pr-10'>
									<Modal.Heading>Install Clipify Runner for {installPlatform ? runnerPlatformLabels[installPlatform] : ""}</Modal.Heading>
									<p className='text-sm text-muted-foreground'>Download starting. If it does not start, click the button below.</p>
								</Modal.Header>
								<Modal.Body className='flex flex-col gap-5'>
									{installPlatform && (
										<a href={getRunnerDownloadUrl(installPlatform)} download className='button button--md button--primary self-center inline-flex w-fit items-center justify-center gap-2'>
											<IconDownload size={18} />
											Download again
										</a>
									)}
									{renderInstallSteps()}
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				</Modal>
				<ConfirmModal
					isOpen={isUnlinkConfirmOpen}
					onOpenChange={setIsUnlinkConfirmOpen}
					title='Unlink runner'
					description='This will disconnect the runner from this account and revoke its access.'
					confirmLabel='Unlink'
					cancelLabel='Cancel'
					onConfirm={async () => {
						await handleUnlinkRunner();
						setIsUnlinkConfirmOpen(false);
					}}
				/>
			</div>
		</DashboardNavbar>
	);
}
