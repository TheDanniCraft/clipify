"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getRunner, getStreamSessionsForRunner, upsertStreamSession, setStreamDesiredState } from "@actions/runner";
import { getAllOverlays } from "@actions/database";
import { Button, Card, Label, Select, Spinner, TextField, InputGroup, ListBox } from "@heroui/react";
import { IconCopy, IconCheck, IconServer, IconPlayerPlay, IconPlayerStop, IconArrowLeft } from "@tabler/icons-react";
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

	const [copied, setCopied] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const [preset, setPreset] = useState<string>("custom");
	const [rtmpUrl, setRtmpUrl] = useState("");
	const [streamKey, setStreamKey] = useState("");
	const [overlayId, setOverlayId] = useState("");
	const [mode, setMode] = useState<StreamMode>(StreamMode.AlwaysOn);
	const hasMounted = useRef(false);

	useEffect(() => {
		async function init() {
			const authUser = await validateAuth();
			if (!authUser) {
				router.push("/login");
				return;
			}
			setUser(authUser);

			const [fetchedRunner, fetchedSessions, fetchedOverlays] = await Promise.all([
				getRunner(params.id, authUser.id),
				getStreamSessionsForRunner(params.id, authUser.id),
				getAllOverlays(authUser.id),
			]);

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

	useEffect(() => {
		if (!user) return;
		const pollInterval = setInterval(async () => {
			try {
				const [fetchedRunner, fetchedSessions] = await Promise.all([
					getRunner(params.id, user.id),
					getStreamSessionsForRunner(params.id, user.id),
				]);
				if (fetchedRunner) setRunner(fetchedRunner);
				if (fetchedSessions) setStreamSessions(fetchedSessions);
			} catch (e) {
				console.error("Polling error", e);
			}
		}, 5000);

		return () => clearInterval(pollInterval);
	}, [params.id, user]);

	if (isLoading || !runner || !user) {
		return <FullscreenLoadingState message="Loading runner configuration" />;
	}

	const copyToken = () => {
		navigator.clipboard.writeText(runner.token);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handlePresetChange = (value: string) => {
		setPreset(value);
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
		<>
			<DashboardNavbar user={user} title='Runner Settings' tagline='Configure hardware streaming'></DashboardNavbar>
			
			<div className="flex flex-col items-center justify-center w-full p-4">
				<Card className="w-full max-w-4xl p-6 mb-6">
					<div className="flex items-center gap-3 mb-6 border-b border-divider pb-4">
						<Button
							isIconOnly
							variant='tertiary'
							onPress={() => router.push("/dashboard")}
						>
							<IconArrowLeft />
						</Button>
						<IconServer className="text-primary" size={28} />
						<h1 className="text-2xl font-bold">Hardware Node: {runner.name}</h1>
						<div className={`px-3 py-1 text-sm font-semibold rounded-full ml-auto ${runner.status === 'online' ? 'bg-success/20 text-success' : 'bg-default/20 text-default-foreground'}`}>
							{runner.status.toUpperCase()}
						</div>
					</div>
					
					<div className="flex flex-col gap-2">
						<TextField>
							<Label>Runner Token</Label>
							<div className="flex gap-2">
								<InputGroup className="flex-1">
									<InputGroup.Input 
										readOnly 
										value={runner.token} 
										type="password"
										className="font-mono text-sm flex-1"
									/>
								</InputGroup>
								<Button isIconOnly variant="secondary" onPress={copyToken}>
									{copied ? <IconCheck size={18} className="text-success" /> : <IconCopy size={18} />}
								</Button>
							</div>
						</TextField>
						<p className="text-xs text-muted">Use this token when starting your local runner binary.</p>
					</div>
				</Card>

				<Card className="w-full max-w-4xl p-6">
					<h3 className="text-xl font-bold mb-6">Stream Configuration</h3>
					
					<div className="flex flex-col gap-5">
						<Select 
							value={overlayId || null}
							onChange={(selected) => setOverlayId(String(selected ?? ""))}
						>
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

						<Select 
							value={mode || null}
							onChange={(selected) => setMode(String(selected ?? "") as StreamMode)}
						>
							<Label>Engine Mode</Label>
							<Select.Trigger>
								<Select.Value />
								<Select.Indicator />
							</Select.Trigger>
							<Select.Popover>
								<ListBox>
									{[
										{ id: StreamMode.AlwaysOn, name: "24/7 Cloud Loop (Puppeteer)" },
										{ id: StreamMode.Failsafe, name: "Failsafe Mode (Local OBS Fallback)" }
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
							<div className="bg-warning/10 border border-warning/20 p-4 rounded-md text-sm text-warning-600 dark:text-warning-400 leading-relaxed">
								<strong>Failsafe Mode Active:</strong> Direct your local OBS to stream to <code>rtmp://localhost:1935/live</code> (the Stream Key in OBS can be left empty). If your OBS connection drops, the local Runner will instantly fallback to the 24/7 Cloud Loop.
							</div>
						)}

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Select 
								value={preset || null}
								onChange={(selected) => handlePresetChange(String(selected ?? ""))}
							>
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
											{ id: "custom", name: "Custom RTMP" }
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

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<TextField>
								<Label>RTMP URL</Label>
								<InputGroup>
									<InputGroup.Input 
										value={rtmpUrl} 
										onChange={(e) => setRtmpUrl(e.target.value)}
										readOnly={preset !== "custom"}
									/>
								</InputGroup>
							</TextField>

							<TextField>
								<Label>Stream Key (Optional)</Label>
								<InputGroup>
									<InputGroup.Input 
										type="password"
										value={streamKey} 
										onChange={(e) => setStreamKey(e.target.value)}
										placeholder={streamSessions[0]?.encryptedStreamKey ? "******** (Saved)" : "live_xxx_..."}
									/>
								</InputGroup>
								<p className="text-xs text-muted mt-1">Leave blank if embedded in the custom RTMP URL.</p>
							</TextField>
						</div>

						<div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-divider">
							<Button variant="primary" onPress={handleSave} isPending={isSaving} className="sm:w-auto w-full">
								{isSaving ? <Spinner size="sm" color="current" /> : "Save Configuration"}
							</Button>

							{streamSessions[0]?.id && (
								<div className="flex gap-3 sm:ml-auto w-full sm:w-auto">
									<Button 
										className="bg-success text-success-foreground" 
										onPress={() => handleAction("started")}
										isDisabled={runner?.status !== RunnerStatus.Online || streamSessions[0]?.desiredState === StreamState.Running}
									>
										<IconPlayerPlay size={18} /> Start
									</Button>
									<Button 
										className="bg-danger text-danger-foreground" 
										onPress={() => handleAction("stopped")}
										isDisabled={runner?.status !== RunnerStatus.Online || streamSessions[0]?.desiredState === StreamState.Stopped}
									>
										<IconPlayerStop size={18} /> Stop
									</Button>
								</div>
							)}
						</div>
					</div>
				</Card>
			</div>
		</>
	);
}
