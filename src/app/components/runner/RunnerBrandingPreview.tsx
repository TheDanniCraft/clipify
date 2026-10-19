"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Label, Radio, RadioGroup, Switch, Tabs } from "@heroui/react";
import StandbyEditor from "./StandbyEditor";
import { getRunnerBrandingProfile, saveRunnerBrandingProfile } from "@/app/actions/runner";

type Profile = Extract<Awaited<ReturnType<typeof getRunnerBrandingProfile>>, { success: true }>["profile"];
const corners = [
	{ id: "top_left", name: "Top left" },
	{ id: "top_right", name: "Top right" },
	{ id: "bottom_left", name: "Bottom left" },
	{ id: "bottom_right", name: "Bottom right" },
] as const;

export default function RunnerBrandingPreview({ ownerId, runnerId, overlayId, resolution = "720p", runnerPro: sharedRunnerPro, onPolicyInvalidated }: { ownerId: string; runnerId: string; overlayId: string; resolution?: "720p" | "1080p"; runnerPro?: boolean; onPolicyInvalidated?: () => void }) {
	const previewCanvas = resolution === "1080p" ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
	const previewRef = useRef<HTMLIFrameElement>(null);
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const [previewWidth, setPreviewWidth] = useState(0);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [corner, setCorner] = useState<Profile["watermarkCorner"]>("bottom_right");
	const [showNextBroadcastTime, setShowNextBroadcastTime] = useState(false);
	const [previewMode, setPreviewMode] = useState<"standby" | "playback">("standby");
	const [message, setMessage] = useState("");
	const [logoAssetId, setLogoAssetId] = useState<string | null>(null);
	const [backgroundAssetId, setBackgroundAssetId] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [standbyBackgroundColor, setStandbyBackgroundColor] = useState("#000000");
	const [loadedRunnerPro, setRunnerPro] = useState(false);
	const runnerPro = loadedRunnerPro && (sharedRunnerPro ?? true);
	const [showAttribution, setShowAttribution] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	useEffect(() => {
		let current = true;
		void getRunnerBrandingProfile(ownerId, runnerId)
			.then((result) => {
				if (!current) return;
				if (result.success) {
					setProfile(result.profile);
					setRunnerPro(result.runnerPro);
					setShowAttribution(result.profile.proShowAttribution);
					setCorner(result.profile.watermarkCorner);
					setStandbyBackgroundColor(result.profile.standbyBackgroundColor);
					setBackgroundAssetId(result.profile.backgroundAssetId);
					setLogoAssetId(result.profile.logoAssetId);
					setMessage(result.profile.message);
					setShowNextBroadcastTime(result.profile.showNextBroadcastTime);
				} else setError(result.error);
			})
			.catch(() => {
				if (current) setError("Could not load appearance. Please try again.");
			});
		return () => {
			current = false;
		};
	}, [ownerId, runnerId]);
	const draft = { watermarkCorner: corner, proShowAttribution: showAttribution, standbyBackgroundColor, backgroundAssetId, logoAssetId, message, showNextBroadcastTime, previewMode };
	const draftRevision = JSON.stringify(draft);
	const sendPreviewDraft = useCallback(() => previewRef.current?.contentWindow?.postMessage({ type: "clipify:runner-preview", runnerId, draft: JSON.parse(draftRevision), revision: draftRevision }, window.location.origin), [runnerId, draftRevision]);
	useEffect(() => {
		sendPreviewDraft();
		const ready = (event: MessageEvent) => {
			if (event.origin === location.origin && event.source === previewRef.current?.contentWindow && event.data?.type === "clipify:runner-preview-ready" && event.data.runnerId === runnerId) sendPreviewDraft();
		};
		window.addEventListener("message", ready);
		return () => window.removeEventListener("message", ready);
	}, [sendPreviewDraft, runnerId]);

	const previewAvailable = Boolean(profile && overlayId);
	useEffect(() => {
		const container = previewContainerRef.current;
		if (!previewAvailable || !container) return;
		setPreviewWidth(container.clientWidth);
		const observer = new ResizeObserver((entries) => setPreviewWidth(entries[0].contentRect.width));
		observer.observe(container);
		return () => observer.disconnect();
	}, [previewAvailable]);
	async function uploadAsset(file: File | undefined, kind: "background" | "logo") {
		if (!file || uploading || saving) return;
		if (file.size > 2097152) {
			setError("Images must be no larger than 2 MiB.");
			return;
		}
		setUploading(true);
		setError(null);
		setNotice(null);
		try {
			const response = await fetch(`/api/runner/branding-assets?ownerId=${encodeURIComponent(ownerId)}&runnerId=${runnerId}&kind=${kind}`, { method: "POST", credentials: "same-origin", body: file });
			const result = await response.json();
			if (!response.ok || !result.success) {
				setError(typeof result.error === "string" ? result.error : "Could not upload the image. Please try again.");
				return;
			}
			if (typeof result.asset?.id !== "string") {
				setError("Could not upload the image. Please try again.");
				return;
			}
			if (kind === "logo") setLogoAssetId(result.asset.id);
			else setBackgroundAssetId(result.asset.id);
		} catch {
			setError("Could not upload the image. Your saved appearance is unchanged. Please try again.");
		} finally {
			setUploading(false);
		}
	}
	async function save() {
		if (!profile || saving || uploading) return;
		setSaving(true);
		setError(null);
		setNotice(null);
		try {
			let ready = false;
			for (let attempt = 0; attempt < 50; attempt++) {
				const frame = previewRef.current;
				const document = frame?.contentDocument;
				const surface = document?.querySelector("[data-runner-presentation-generation]");
				const draftApplied = document?.querySelector("[data-runner-preview-revision]")?.getAttribute("data-runner-preview-revision") === draftRevision;
				const status = draftApplied && frame && document?.URL === frame.src && surface?.getAttribute("data-runner-presentation-generation") === `preview-${runnerId}` ? surface.getAttribute("data-runner-layout-status") : null;
				if (status === "blocked") {
					setError("Adjust your overlay layout to leave room for Clipify attribution before saving.");
					return;
				}
				if (status === "placed" || status === "clean") {
					ready = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			if (!ready) {
				setError("Wait for the appearance preview to finish loading, then try again.");
				return;
			}
			const result = await saveRunnerBrandingProfile({ ownerId, runnerId, expectedRevision: profile.revision, watermarkCorner: corner, ...(runnerPro ? { proShowAttribution: showAttribution, standbyBackgroundColor, backgroundAssetId, logoAssetId, message, showNextBroadcastTime } : {}) });
			if (!result.success) {
				setError(result.error);
				const current = await getRunnerBrandingProfile(ownerId, runnerId);
				if (current.success) setRunnerPro(current.runnerPro);
				onPolicyInvalidated?.();
				return;
			}
			setProfile(result.profile);
			setNotice("Appearance saved");
		} catch {
			setError("Could not save appearance. Please try again.");
		} finally {
			setSaving(false);
		}
	}
	return (
		<div className='grid gap-6 xl:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]'>
			<div className='space-y-5 px-6 sm:px-0'>
				<h3 className='text-lg font-semibold'>Standby and branding</h3>
				<p className='text-sm text-muted'>Choose where Clipify attribution appears on generated content.</p>

				{error && (
					<p role='alert' className='text-sm text-danger'>
						{error}
					</p>
				)}
				{runnerPro && (
					<StandbyEditor
						logoUrl={logoAssetId ? `/runner/preview/${runnerId}/assets/${logoAssetId}?kind=logo` : undefined}
						backgroundUrl={backgroundAssetId ? `/runner/preview/${runnerId}/assets/${backgroundAssetId}` : undefined}
						onRemoveLogo={() => setLogoAssetId(null)}
						onRemoveBackground={() => setBackgroundAssetId(null)}
						showNextBroadcastTime={showNextBroadcastTime}
						onShowNextBroadcastTimeChange={setShowNextBroadcastTime}
						disabled={saving || uploading}
						backgroundColor={standbyBackgroundColor}
						message={message}
						onBackgroundColorChange={setStandbyBackgroundColor}
						onMessageChange={setMessage}
						onUpload={(file, kind) => void uploadAsset(file, kind)}
					/>
				)}
				{runnerPro && (
					<Switch aria-label='Show Clipify attribution' isSelected={showAttribution} onChange={setShowAttribution} isDisabled={saving}>
						<Switch.Content>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
							<Label>Show Clipify attribution</Label>
						</Switch.Content>
					</Switch>
				)}
				<RadioGroup
					value={corner}
					onChange={(value) => {
						setCorner(value as Profile["watermarkCorner"]);
						setNotice(null);
					}}
					variant='secondary'
					isDisabled={!profile || saving || uploading}
				>
					<Label>Attribution position</Label>
					<div className='grid grid-cols-2 gap-3'>
						{corners.map((item) => (
							<Radio key={item.id} value={item.id} className='mt-0!'>
								<Radio.Content aria-label={item.name} className={`w-full flex-col items-stretch gap-2 rounded-lg border p-3 ${corner === item.id ? "border-accent" : "border-separator"}`}>
									<span aria-hidden='true' className='relative block aspect-video w-full rounded-md bg-secondary'>
										<span className={`absolute h-2 w-6 rounded-sm bg-accent ${item.id.startsWith("top") ? "top-2" : "bottom-2"} ${item.id.endsWith("left") ? "left-2" : "right-2"}`} />
									</span>
									<span className='flex items-center gap-2 text-sm'>
										<Radio.Control>
											<Radio.Indicator />
										</Radio.Control>
										{item.name}
									</span>
								</Radio.Content>
							</Radio>
						))}
					</div>
				</RadioGroup>
				<Button onPress={() => void save()} isDisabled={!profile || !overlayId || saving || uploading}>
					Save appearance
				</Button>
				{notice && (
					<p role='status' className='text-sm text-success'>
						{notice}
					</p>
				)}
			</div>
			<div className='space-y-4 xl:sticky xl:top-0 xl:self-start'>
				{profile && overlayId && (
					<Tabs selectedKey={previewMode} onSelectionChange={(key) => setPreviewMode(key as "standby" | "playback")} isDisabled={saving || uploading} className='space-y-4'>
						<Tabs.ListContainer className='mx-6 w-fit sm:mx-0'>
							<Tabs.List aria-label='Appearance preview mode'>
								<Tabs.Tab id='standby'>
									Standby
									<Tabs.Indicator />
								</Tabs.Tab>
								<Tabs.Tab id='playback'>
									Clips
									<Tabs.Indicator />
								</Tabs.Tab>
							</Tabs.List>
						</Tabs.ListContainer>
						<Tabs.Panel id={previewMode} className='p-0'>
							<div ref={previewContainerRef} className='relative aspect-video w-full overflow-hidden bg-black ring-1 ring-separator sm:rounded-xl'>
								<iframe ref={previewRef} key={`${runnerId}:${overlayId}:${resolution}`} onLoad={sendPreviewDraft} title='Runner appearance preview' src={`/runner/preview/${runnerId}?overlayId=${encodeURIComponent(overlayId)}`} className='absolute left-0 top-0 max-w-none border-0' style={{ width: previewCanvas.width, height: previewCanvas.height, transform: `scale(${previewWidth / previewCanvas.width})`, transformOrigin: "top left" }} />
							</div>
						</Tabs.Panel>
					</Tabs>
				)}
			</div>
		</div>
	);
}
