"use client";

import LocalizedDate from "@components/localizedDate";
import DashboardEditorLayout from "@components/dashboardEditorLayout";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getRunner, getRunnerLivePreview, getRunnerToken, getRunnerVersionManifest, getStreamSessionsForRunner, upsertStreamSession, setStreamDesiredState, unlinkRunner, listRunnerDestinations, listRunnerScheduleEvents } from "@actions/runner";
import { getAllOverlays } from "@actions/database";
import { Accordion, Button, Card, Label, Select, Spinner, ListBox, Chip, Link, Modal, Dropdown, Tooltip, Separator } from "@heroui/react";
import { IconArrowLeft, IconBrandWindows, IconTerminal2, IconBrandApple, IconUnlink, IconAlertTriangle, IconCircleCheck, IconRefresh, IconPaint, IconCalendarEvent } from "@tabler/icons-react";
import { notify } from "@lib/toast";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import ConfirmModal from "@components/confirmModal";
import AdvancedRunnerSetup from "@components/runner/AdvancedSetup";
import { formatRunnerVersion, getRunnerPlatformFromOs, getRunnerVersionState, type RunnerPlatform } from "@lib/runnerInstallation";
import RunnerBroadcastControls from "@components/runnerBroadcastControls";
import RunnerDestinations from "@components/runnerDestinations";
import RunnerBrandingPreview from "@components/runner/RunnerBrandingPreview";
import RunnerSchedule from "@components/runnerSchedule";
import RunnerDestinationSelection, { canStartWithDestinations } from "@components/runnerDestinationSelection";
import RunnerOutputStatus from "@components/runnerOutputStatus";
import RunnerControlSelection from "@components/runnerControlSelection";
import UpgradeModal from "@components/upgradeModal";
import DashboardNavbar from "@components/dashboardNavbar";
import { AuthenticatedUser, Overlay, StreamMode, StreamState, RunnerStatus, type StreamControlMode } from "@types";

type Runner = NonNullable<Awaited<ReturnType<typeof getRunner>>>;
type StreamSession = Awaited<ReturnType<typeof getStreamSessionsForRunner>>[number];
type RunnerPolicy = Extract<Awaited<ReturnType<typeof listRunnerScheduleEvents>>, { success: true }>["policy"];
type DestinationView = Extract<Awaited<ReturnType<typeof listRunnerDestinations>>, { success: true }>["destinations"][number];

const runnerPlatformLabels: Record<RunnerPlatform, string> = {
	windows: "Windows",
	linux: "Linux x64",
	"linux-arm64": "Linux ARM64",
	macos: "macOS Intel",
	"macos-arm64": "macOS Apple Silicon",
};

export default function RunnerPage() {
	const params = useParams() as { id: string };
	const router = useRouter();

	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [runner, setRunner] = useState<Runner | null>(null);

	const [streamSessions, setStreamSessions] = useState<StreamSession[]>([]);
	const [overlays, setOverlays] = useState<Overlay[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [runnerPolicy, setRunnerPolicy] = useState<RunnerPolicy | null>(null);
	const [destinationOptions, setDestinationOptions] = useState<DestinationView[]>([]);
	const [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);
	const [versionManifest, setVersionManifest] = useState<Awaited<ReturnType<typeof getRunnerVersionManifest>>>(null);
	const [versionPending, setVersionPending] = useState(false);
	const [tokenPending, setTokenPending] = useState(false);
	const [manualToken, setManualToken] = useState<string | null>(null);
	const [tokenError, setTokenError] = useState<string | null>(null);

	const [isSaving, setIsSaving] = useState(false);

	const [previewImage, setPreviewImage] = useState<string | null>(null);
	const [previewState, setPreviewState] = useState<"loading" | "waiting" | "ready" | "unavailable">("loading");
	const readPreview = useCallback(async (runnerId: string, ownerId: string) => {
		try {
			const result = await getRunnerLivePreview(runnerId, ownerId);
			if (result.success) {
				setPreviewImage(result.image);
				setPreviewState(result.image ? "ready" : "waiting");
			} else {
				setPreviewImage(null);
				setPreviewState("unavailable");
			}
		} catch {
			setPreviewImage(null);
			setPreviewState("unavailable");
		}
	}, []);

	const [installPlatform, setInstallPlatform] = useState<RunnerPlatform | null>(null);
	const [downloadCountdown, setDownloadCountdown] = useState(0);

	const [overlayId, setOverlayId] = useState("");
	const [mode, setMode] = useState<StreamMode>(StreamMode.AlwaysOn);
	const [controlMode, setControlMode] = useState<StreamControlMode>("manual");
	const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
	const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
	const [appearanceOpen, setAppearanceOpen] = useState(false);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [destinationsOpen, setDestinationsOpen] = useState(false);
	const [configurationError, setConfigurationError] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loadAttempt, setLoadAttempt] = useState(0);
	const [actionPending, setActionPending] = useState(false);
	useEffect(() => {
		if (!installPlatform) return;
		const timer = window.setInterval(() => setDownloadCountdown((value) => Math.max(0, value - 1)), 1000);
		return () => window.clearInterval(timer);
	}, [installPlatform]);

	useEffect(() => {
		if (!user) return;

		let polling = false;
		const pollData = async () => {
			if (polling) return;
			polling = true;
			try {
				const [fetchedRunner, fetchedSessions, manifest] = await Promise.all([getRunner(params.id, user.id), getStreamSessionsForRunner(params.id, user.id), getRunnerVersionManifest().catch(() => null)]);
				setVersionManifest(manifest);

				if (fetchedRunner) setRunner(fetchedRunner);
				if (fetchedSessions) setStreamSessions(fetchedSessions);

				if (fetchedRunner?.status === "online" && fetchedSessions[0]?.actualState === "running") {
					await readPreview(params.id, user.id);
				} else {
					setPreviewImage(null);
					setPreviewState("loading");
				}
			} catch (e) {
				console.error("Polling error", e);
			} finally {
				polling = false;
			}
		};

		const interval = setInterval(() => {
			pollData();
		}, 2000);

		return () => {
			clearInterval(interval);
		};
	}, [params.id, user, readPreview]);

	useEffect(() => {
		let active = true;
		async function init() {
			try {
				const authUser = await validateAuth();
				if (!active) return;
				setIsLoading(true);
				setLoadError(null);
				if (!authUser) {
					router.push("/login");
					return;
				}
				if (!active) return;
				setUser(authUser);

				const [fetchedRunner, fetchedSessions, fetchedOverlays, fetchedToken, fetchedDestinations, fetchedSchedule, manifest] = await Promise.all([getRunner(params.id, authUser.id), getStreamSessionsForRunner(params.id, authUser.id), getAllOverlays(authUser.id), getRunnerToken(params.id, authUser.id), listRunnerDestinations(authUser.id, params.id), listRunnerScheduleEvents(authUser.id, params.id), getRunnerVersionManifest().catch(() => null)]);

				if (!active) return;
				if (!fetchedRunner) {
					router.push("/dashboard");
					return;
				}

				setRunner(fetchedRunner);
				setVersionManifest(manifest);
				setStreamSessions(fetchedSessions);
				setOverlays(fetchedOverlays || []);

				if (fetchedToken.success && fetchedToken.token) setManualToken(fetchedToken.token);
				else setTokenError("Runner token could not be loaded.");

				if (fetchedDestinations.success) setDestinationOptions(fetchedDestinations.destinations);
				if (fetchedSchedule?.success) {
					setRunnerPolicy(fetchedSchedule.policy);
					if (fetchedSchedule.policy.scheduling && new URLSearchParams(window.location.search).has("schedule")) setScheduleOpen(true);
				}
				const session = fetchedSessions[0];
				if (session) {
					setSelectedDestinationIds(session.destinationIds);
					setOverlayId(session.overlayId);
					setMode(session.mode as StreamMode);
					setControlMode(session.controlMode ?? "manual");
				} else if (fetchedOverlays?.length) setOverlayId(fetchedOverlays[0].id);
			} catch {
				if (active) setLoadError("Could not load this runner. Please try again.");
			} finally {
				if (active) setIsLoading(false);
			}
		}
		void init();
		return () => {
			active = false;
		};
	}, [params.id, router, loadAttempt]);

	useEffect(() => {
		if (!runnerPolicy?.validUntil || !runner || !user) return;
		const delay = Math.max(0, Date.parse(runnerPolicy.validUntil) - Date.now());
		const timer = window.setTimeout(
			() => {
				void listRunnerScheduleEvents(runner.ownerId, runner.id)
					.then((result) => {
						if (result.success) setRunnerPolicy(result.policy);
					})
					.catch(() => {
						setRunnerPolicy(null);
					});
			},
			Math.min(delay + 100, 2147483647),
		);
		return () => window.clearTimeout(timer);
	}, [runnerPolicy?.validUntil, runner, user]);

	if (loadError)
		return (
			<div className='mx-auto max-w-xl space-y-4 p-6'>
				<p role='alert'>{loadError}</p>
				<Button variant='secondary' onPress={() => setLoadAttempt((value) => value + 1)}>
					Try again
				</Button>
			</div>
		);
	if (isLoading || !runner || !user) {
		return <FullscreenLoadingState message='Loading runner configuration' />;
	}

	const reloadToken = async () => {
		setTokenPending(true);
		try {
			const result = await getRunnerToken(runner.id, runner.ownerId);
			if (result.success && result.token) {
				setManualToken(result.token);
				setTokenError(null);
			} else setTokenError("Runner token could not be loaded. Please try again.");
		} catch {
			setTokenError("Runner token could not be loaded. Please try again.");
		} finally {
			setTokenPending(false);
		}
	};
	const refreshVersion = async () => {
		setVersionPending(true);
		try {
			setVersionManifest(await getRunnerVersionManifest());
		} catch {
			setVersionManifest(null);
		} finally {
			setVersionPending(false);
		}
	};

	const savedSession = streamSessions[0];
	const dirty = !savedSession || overlayId !== savedSession.overlayId || mode !== savedSession.mode || controlMode !== savedSession.controlMode || [...selectedDestinationIds].sort().join() !== [...savedSession.destinationIds].sort().join();
	const streamConfigValid = Boolean(overlayId && selectedDestinationIds.length && (runnerPolicy?.runnerPro || selectedDestinationIds.length === 1));
	const streamReadyToStart = !dirty && streamConfigValid && canStartWithDestinations(destinationOptions, selectedDestinationIds);
	const refreshDestinationOptions = async (change?: { deletedId: string }) => {
		if (!user || !runner) return;
		try {
			const result = await listRunnerDestinations(user.id, runner.id);
			if (result.success) {
				setDestinationOptions(result.destinations);
				setSelectedDestinationIds((current) => {
					const retained = current.filter((id) => result.destinations.some((target) => target.id === id));
					if (change?.deletedId) return retained;
					return retained.length ? retained : result.destinations.slice(0, 1).map((target) => target.id);
				});
				if (change?.deletedId) setStreamSessions(await getStreamSessionsForRunner(runner.id, user.id));
			}
		} catch {
			setConfigurationError("Could not refresh destinations. Please try again.");
		}
	};

	const handleSave = async () => {
		if (isSaving) return;
		setConfigurationError(null);
		if (!overlayId) {
			setConfigurationError("Choose an overlay before saving.");
			return;
		}
		if (!selectedDestinationIds.length) {
			setConfigurationError("Add and select a broadcast destination.");
			setDestinationsOpen(true);
			return;
		}
		if (!runnerPolicy?.runnerPro && selectedDestinationIds.length > 1) {
			setConfigurationError("Select one broadcast destination before saving.");
			return;
		}
		setIsSaving(true);
		try {
			const res = await upsertStreamSession({ id: savedSession?.id, expectedRevision: savedSession?.configurationRevision, ownerId: runner.ownerId, runnerId: runner.id, overlayId, mode, controlMode, rtmpUrl: "", streamKey: "", destinationIds: selectedDestinationIds });
			if (!res.success) {
				setConfigurationError(res.error || "Could not save this broadcast. Please try again.");
				const current = await listRunnerScheduleEvents(runner.ownerId, runner.id);
				if (current.success) setRunnerPolicy(current.policy);
				return;
			}
			const sessions = await getStreamSessionsForRunner(runner.id, runner.ownerId);
			setStreamSessions(sessions);
			setSelectedDestinationIds(sessions[0]?.destinationIds ?? selectedDestinationIds);
			notify({ title: "Saved", description: "Stream session configuration saved.", color: "success" });
		} catch {
			setConfigurationError("Could not save this broadcast. Your changes are kept. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleAction = async (state: "started" | "stopped", stopMode: "graceful" | "immediate" = "graceful") => {
		if (state === "started" && !streamReadyToStart) {
			notify({ title: "Incomplete stream configuration", description: "Select an overlay and a configured destination before starting.", color: "warning" });
			return;
		}
		if (!streamSessions[0]?.id || actionPending) return;
		setActionPending(true);
		try {
			const res = await setStreamDesiredState(streamSessions[0].id, state === "started" ? StreamState.Running : StreamState.Stopped, streamSessions[0].configurationRevision, stopMode);
			if (res.success) {
				notify({ title: state === "started" ? "Start requested" : stopMode === "immediate" ? "Stop now requested" : "Stop requested", description: state === "started" ? "Waiting for the runner to confirm it is live." : "Waiting for the runner to close its outputs.", color: "success" });
				const fetchedSessions = await getStreamSessionsForRunner(params.id, user.id);
				setStreamSessions(fetchedSessions);
			} else {
				notify({ title: state === "started" ? "Cannot start broadcast" : "Cannot stop broadcast", description: res.error || "Please try again.", color: "danger" });
			}
		} catch {
			notify({ title: "Could not update broadcast", description: "Please try again.", color: "danger" });
		} finally {
			setActionPending(false);
		}
	};

	const handleUnlinkRunner = async () => {
		try {
			const res = await unlinkRunner(runner.id, runner.ownerId);
			if (res.success) {
				setManualToken(null);
				notify({ title: "Runner unlinked", description: "The runner token was revoked.", color: "success" });
				router.refresh();
				return true;
			}

			notify({ title: "Could not unlink runner", description: res.error || "Please try again.", color: "danger" });
		} catch {
			notify({ title: "Could not unlink runner", description: "Please try again.", color: "danger" });
		}
		return false;
	};

	const getRunnerDownloadUrl = (platform: RunnerPlatform) => `/api/runner/download?os=${platform}`;

	const handleRunnerDownload = (platform: RunnerPlatform) => {
		setDownloadCountdown(5);
		setInstallPlatform(platform);
		const link = document.createElement("a");
		link.href = getRunnerDownloadUrl(platform);
		link.download = "";
		link.rel = "noopener";
		document.body.appendChild(link);
		link.click();
		link.remove();
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

	const renderInstallSteps = () => {
		if (!installPlatform) return null;

		if (installPlatform === "windows") {
			return (
				<ol className='list-decimal space-y-2 pl-5 text-sm text-muted'>
					<li>Open the downloaded Clipify Runner file.</li>
					<li>Approve the runner enrollment in your browser. If the browser does not open automatically, use the URL and code shown by the runner.</li>
					<li>Return to this page after the runner shows as online.</li>
				</ol>
			);
		}

		if (installPlatform === "linux" || installPlatform === "linux-arm64") {
			const linuxBinaryName = installPlatform === "linux-arm64" ? "clipify-runner-linux-arm64" : "clipify-runner-linux";
			return (
				<ol className='list-decimal space-y-2 pl-5 text-sm text-muted'>
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
				<ol className='list-decimal space-y-2 pl-5 text-sm text-muted'>
					<li>Open your Downloads folder.</li>
					<li>Control-click Clipify Runner, then choose Open.</li>
					<li>If macOS blocks it, open System Settings.</li>
					<li>Go to Privacy &amp; Security and click Open Anyway.</li>
					<li>Click Open, then approve the runner enrollment in your browser. If the browser does not open automatically, use the URL and code shown by the runner.</li>
				</ol>
				<p className='rounded-lg bg-secondary/50 p-3 text-sm text-muted'>Apple adds this extra step for apps from developers who are not yet in the Apple Developer Program. You only need to approve this runner once.</p>
			</div>
		);
	};

	const runnerVersionLabel = formatRunnerVersion(runner.version);
	const runnerVersionState = getRunnerVersionState(runner, versionManifest);
	const runnerPlatform = getRunnerPlatformFromOs(runner.osInfo);
	const isRunnerStreaming = runner.status === "online" && streamSessions[0]?.actualState === "running";
	const canUnlinkRunner = !isRunnerStreaming;
	const runnerConnectionLabel = runner.lastHeartbeatAt ? "Offline" : "Not connected";

	return (
		<DashboardNavbar user={user} title='Runner Settings' tagline='Manage your runner'>
			<DashboardEditorLayout>
				<Card>
					<Card.Header className='flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between'>
						<div className='flex min-w-0 flex-1 items-center gap-3'>
							<Button isIconOnly className='shrink-0' variant='tertiary' aria-label='Back to runners' onPress={() => router.push("/dashboard?tab=runners")}>
								<IconArrowLeft />
							</Button>
							<h2 className='min-w-0 break-words text-xl font-bold'>{runner.name}</h2>
						</div>
						<div className='flex shrink-0 items-center justify-end gap-2'>
							<Chip size='sm' variant='soft' color={runner.status === "online" ? "success" : "default"}>
								{runner.status === "online" ? "Online" : runnerConnectionLabel}
							</Chip>
							<Tooltip delay={0}>
								<Button isIconOnly variant='danger-soft' aria-label='Unlink runner' onPress={() => setIsUnlinkConfirmOpen(true)} isDisabled={!canUnlinkRunner}>
									<IconUnlink />
								</Button>
								<Tooltip.Content>Unlink runner</Tooltip.Content>
							</Tooltip>
						</div>
					</Card.Header>
					<Separator />
					<Card.Content className='space-y-6'>
						{!runner.lastHeartbeatAt && (
							<section className='flex flex-col items-center gap-8 px-2 py-8 sm:px-8 sm:py-12' aria-label='Connect runner'>
								<div className='flex w-full max-w-2xl flex-col items-center gap-5 text-center'>
									<h3 className='text-3xl font-bold text-primary'>Setup Your Runner</h3>
									<p className='text-base text-muted'>Download Runner for your computer, open it, and approve the browser enrollment prompt to connect your account.</p>
									<div className='mt-2 flex w-full flex-col items-stretch justify-center gap-4 sm:w-auto sm:flex-row sm:items-center'>
										<Button className='w-full sm:w-auto' variant='secondary' onPress={() => handleRunnerDownload("windows")}>
											<IconBrandWindows size={20} />
											Download for Windows
										</Button>
										{renderLinuxDownloadDropdown("Download for Linux", false, "secondary", "w-full sm:w-auto")}
										{renderMacOSDownloadDropdown("Download for macOS", false, "secondary", "w-full sm:w-auto")}
									</div>
									<div role='status' className='mt-3 flex flex-col items-center justify-center gap-3 text-sm text-muted'>
										<Spinner size='md' aria-label='Waiting for first Runner connection' />
										Waiting for Runner to connect
									</div>
								</div>
								<div className='w-full max-w-2xl border-t border-separator pt-4'>
									<AdvancedRunnerSetup token={manualToken} error={tokenError} pending={tokenPending} onRetry={reloadToken} />
								</div>
							</section>
						)}
						{runner.lastHeartbeatAt && (
							<>
								<h3 className='text-lg font-semibold'>Stream Configuration</h3>
								<div className='grid gap-6 lg:grid-cols-2'>
									<div className='space-y-5'>
										<Select value={overlayId || null} onChange={(value) => setOverlayId(String(value ?? ""))} variant='secondary'>
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
										{!overlays.length && (
											<p className='text-sm text-muted'>
												Create an overlay in{" "}
												<a className='text-accent underline' href='/dashboard'>
													your dashboard
												</a>{" "}
												to choose the clips for this broadcast.
											</p>
										)}
										<div className='grid gap-4 sm:grid-cols-2'>
											<Select
												value={mode}
												onChange={(value) => {
													const next = String(value) as StreamMode;
													setMode(next);
													if (next === StreamMode.Failsafe) setControlMode("manual");
												}}
												variant='secondary'
											>
												<Label>Broadcast behavior</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														{[
															{ id: StreamMode.AlwaysOn, name: "Clip playback" },
															{ id: StreamMode.Failsafe, name: "Live fallback" },
														].map((item) => (
															<ListBox.Item id={item.id} key={item.id} textValue={item.name}>
																<ListBox.ItemIndicator />
																<Label>{item.name}</Label>
															</ListBox.Item>
														))}
													</ListBox>
												</Select.Popover>
											</Select>
											<RunnerControlSelection
												value={controlMode}
												clipPlayback={mode === StreamMode.AlwaysOn}
												scheduling={runnerPolicy?.scheduling ?? null}
												onChange={(value) => {
													setControlMode(value);
													if (value === "scheduled") setScheduleOpen(true);
												}}
												onUpgrade={() => setIsUpgradeOpen(true)}
											/>
										</div>
										{mode === StreamMode.Failsafe && (
											<p className='text-sm text-muted'>
												Send OBS to <code>rtmp://localhost:1935/live</code> with an empty stream key. Clips play when your live feed goes offline.
											</p>
										)}
									</div>
									<div className='space-y-4'>
										<RunnerDestinationSelection destinations={destinationOptions} selectedIds={selectedDestinationIds} runnerPro={Boolean(runnerPolicy?.runnerPro)} onChange={setSelectedDestinationIds} onManage={() => setDestinationsOpen(true)} />
										{savedSession && (savedSession.desiredState !== StreamState.Stopped || savedSession.outputs.length > 0) && <RunnerOutputStatus outputs={savedSession.outputs} destinations={destinationOptions} online={runner.status === RunnerStatus.Online} />}
									</div>
								</div>
								{configurationError && (
									<p role='alert' className='text-sm text-danger'>
										{configurationError}
									</p>
								)}
								{savedSession?.hasError && !savedSession.playbackTimedOut && (
									<p role='alert' className='text-sm text-danger'>
										The Runner reported a broadcast error. Check its logs before retrying.
									</p>
								)}
								<div className={controlMode === "scheduled" ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
									<Button variant='ghost' className='w-full' onPress={() => setAppearanceOpen(true)} isDisabled={!overlayId}>
										<IconPaint size={18} aria-hidden='true' />
										Appearance
									</Button>
									{controlMode === "scheduled" && (
										<Button className='w-full' variant='ghost' isDisabled={isSaving} onPress={() => (runnerPolicy?.scheduling ? setScheduleOpen(true) : setIsUpgradeOpen(true))}>
											<IconCalendarEvent size={18} aria-hidden='true' />
											Schedule
										</Button>
									)}
								</div>
								{controlMode === "scheduled" && dirty && <p className='text-xs text-muted'>Save configuration to activate your schedule.</p>}
								<div className='flex flex-wrap items-center justify-between gap-4 border-t border-separator pt-4'>
									<Button variant='primary' onPress={handleSave} isDisabled={isSaving || !dirty} isPending={isSaving}>
										Save Configuration
									</Button>
									{savedSession && <RunnerBroadcastControls playbackTimedOut={savedSession.playbackTimedOut} desiredState={savedSession.desiredState} actualState={savedSession.actualState} canStart={!actionPending && runner.status === RunnerStatus.Online && streamReadyToStart} requiresConnection={!runnerPolicy?.runnerPro} clipPlayback={savedSession.mode === "24/7"} onStart={() => handleAction("started")} onStop={(stopMode) => handleAction("stopped", stopMode)} />}
								</div>
								{savedSession && dirty && <p className='text-sm text-muted'>Save your changes before starting this broadcast.</p>}
							</>
						)}
					</Card.Content>
				</Card>
				{isRunnerStreaming && (
					<Card>
						<Card.Header>
							<h2 className='text-lg font-semibold'>Live Stream Preview</h2>
						</Card.Header>
						<Card.Content>
							<div className='aspect-video overflow-hidden rounded-xl bg-black'>
								{previewImage ? (
									<Image src={previewImage} alt='Live Stream Preview' width={1280} height={720} unoptimized className='h-full w-full object-contain' />
								) : (
									<div className='flex h-full items-center justify-center'>
										{previewState === "loading" ? (
											<Spinner aria-label='Loading live preview' />
										) : previewState === "unavailable" ? (
											<div className='space-y-3 text-center'>
												<p role='alert' className='text-sm text-muted'>
													Preview unavailable.
												</p>
												<Button
													variant='secondary'
													onPress={() => {
														setPreviewState("loading");
														void readPreview(runner.id, runner.ownerId);
													}}
												>
													Retry preview
												</Button>
											</div>
										) : (
											<p role='status' className='text-sm text-muted'>
												Waiting for first frame...
											</p>
										)}
									</div>
								)}
							</div>
						</Card.Content>
					</Card>
				)}
				{runner.lastHeartbeatAt && (
					<Accordion>
						<Accordion.Item>
							<Accordion.Heading>
								<Accordion.Trigger>
									Runner details
									{runnerVersionState === "outdated" && (
										<Chip size='sm' color='warning' variant='soft'>
											Update available
										</Chip>
									)}
									<Accordion.Indicator />
								</Accordion.Trigger>
							</Accordion.Heading>
							<Accordion.Panel>
								<Accordion.Body className='space-y-5'>
									<dl className='grid gap-4 text-sm sm:grid-cols-3'>
										<div>
											<dt className='text-muted'>Computer</dt>
											<dd>{runner.osInfo || "Unknown"}</dd>
										</div>
										<div>
											<dt className='text-muted'>Runner version</dt>
											<dd className='flex items-center gap-2'>
												<span title={runner.version ?? undefined}>{runnerVersionLabel}</span>
												{runnerVersionState === "latest" ? <IconCircleCheck size={16} className='text-success' aria-label='Latest runner version' /> : runnerVersionState === "outdated" ? <IconAlertTriangle size={16} className='text-warning' aria-label='Runner update available' /> : <span className='text-muted'>Update status unavailable</span>}
												<Button isIconOnly size='sm' variant='tertiary' aria-label='Check for Runner updates' isPending={versionPending} onPress={refreshVersion}>
													<IconRefresh size={16} />
												</Button>
											</dd>
										</div>
										<div>
											<dt className='text-muted'>Last connection</dt>
											<dd>{runner.lastHeartbeatAt ? <LocalizedDate value={runner.lastHeartbeatAt} showTime /> : "Not connected"}</dd>
										</div>
										{savedSession && (
											<div>
												<dt className='text-muted'>Video quality</dt>
												<dd>
													{savedSession.resolution} at {savedSession.fps} FPS
												</dd>
											</div>
										)}
									</dl>
									{runnerPlatform && (
										<Button className='w-full' variant={runnerVersionState === "outdated" ? "primary" : "secondary"} isDisabled={runnerVersionState === "latest"} onPress={() => handleRunnerDownload(runnerPlatform)}>
											{runnerVersionState === "latest" ? "Runner up to date" : "Download latest runner"}
										</Button>
									)}
									<div className='flex flex-wrap gap-3'>
										<Button variant='secondary' onPress={() => handleRunnerDownload("windows")}>
											Download for Windows
										</Button>
										{renderLinuxDownloadDropdown("Download for Linux")}
										{renderMacOSDownloadDropdown("Download for macOS")}
									</div>
									<AdvancedRunnerSetup token={manualToken} error={tokenError} pending={tokenPending} onRetry={reloadToken} />
								</Accordion.Body>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
				)}
				{destinationsOpen && (
					<Modal.Backdrop isOpen={destinationsOpen} onOpenChange={setDestinationsOpen}>
						<Modal.Container size='lg' placement='center' scroll='inside'>
							<Modal.Dialog>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>Manage destinations</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<RunnerDestinations ownerId={runner.ownerId} runnerId={runner.id} onChange={refreshDestinationOptions} />
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				)}
				<Modal.Backdrop isOpen={appearanceOpen} onOpenChange={setAppearanceOpen}>
					<Modal.Container size='lg' placement='center' scroll='inside' className='px-0 sm:w-full sm:px-10'>
						<Modal.Dialog className='max-w-6xl rounded-none px-0 sm:rounded-3xl sm:px-6'>
							<Modal.CloseTrigger />
							<Modal.Header className='px-6 sm:px-0'>
								<Modal.Heading>Appearance</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='mx-0 px-0 sm:-mx-[3px] sm:px-[3px]'>
								{appearanceOpen && (
									<RunnerBrandingPreview
										onPolicyInvalidated={() => {
											void listRunnerScheduleEvents(runner.ownerId, runner.id)
												.then((result) => setRunnerPolicy(result.success ? result.policy : null))
												.catch(() => setRunnerPolicy(null));
										}}
										ownerId={runner.ownerId}
										runnerId={runner.id}
										overlayId={overlayId}
										runnerPro={runnerPolicy?.runnerPro ?? false}
										resolution={savedSession?.resolution === "1080p" ? "1080p" : "720p"}
									/>
								)}
							</Modal.Body>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
				<Modal.Backdrop isOpen={scheduleOpen} onOpenChange={setScheduleOpen}>
					<Modal.Container size='cover'>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Broadcast schedule</Modal.Heading>
							</Modal.Header>
							<Modal.Body>{scheduleOpen && <RunnerSchedule ownerId={runner.ownerId} runnerId={runner.id} sessionId={savedSession?.id} overlayId={overlayId} overlays={overlays} destinations={destinationOptions} selectedDestinationIds={selectedDestinationIds} clipPlayback={mode === StreamMode.AlwaysOn} onPolicyChange={setRunnerPolicy} onDestinationsChange={refreshDestinationOptions} />}</Modal.Body>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
				<Modal.Backdrop
					isOpen={!!installPlatform}
					onOpenChange={(open) => {
						if (!open) setInstallPlatform(null);
					}}
				>
					<Modal.Container size='lg'>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header className='flex-row items-center gap-3'>
								<span className='flex size-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success'>
									<IconCircleCheck size={26} aria-hidden='true' />
								</span>
								<div className='space-y-1'>
									<Modal.Heading>Your download is starting</Modal.Heading>
									<p className='text-sm text-muted'>Clipify Runner for {installPlatform ? runnerPlatformLabels[installPlatform] : ""}</p>
								</div>
							</Modal.Header>
							<Modal.Body className='space-y-5'>
								{installPlatform && (
									<p className='text-sm text-muted'>
										If it doesn’t start,{" "}
										<Link href={getRunnerDownloadUrl(installPlatform)} download='' isDisabled={downloadCountdown > 0} onPress={() => setDownloadCountdown(5)} className='inline text-sm underline underline-offset-4'>
											download again{downloadCountdown > 0 ? ` (${downloadCountdown}s)` : ""}
										</Link>
										.
									</p>
								)}
								{renderInstallSteps()}
							</Modal.Body>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
				<UpgradeModal isOpen={isUpgradeOpen} onOpenChange={setIsUpgradeOpen} user={user} source='upgrade_modal' feature='runner_scheduling' mode='plan' />
				<ConfirmModal
					isOpen={isUnlinkConfirmOpen}
					onOpenChange={setIsUnlinkConfirmOpen}
					title='Unlink runner'
					description='Disconnect this computer from your account?'
					confirmLabel='Unlink'
					onConfirm={async () => {
						if (await handleUnlinkRunner()) setIsUnlinkConfirmOpen(false);
					}}
				/>
			</DashboardEditorLayout>
		</DashboardNavbar>
	);
}
