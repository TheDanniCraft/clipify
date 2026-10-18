"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Label, ListBox, Select, Switch } from "@heroui/react";
import StandbyEditor from "./StandbyEditor";
import { getRunnerBrandingProfile, saveRunnerBrandingProfile } from "@/app/actions/runner";

type Profile = Extract<Awaited<ReturnType<typeof getRunnerBrandingProfile>>, { success: true }>["profile"];
const corners = [
	{ id: "top_left", name: "Top left" },
	{ id: "top_right", name: "Top right" },
	{ id: "bottom_left", name: "Bottom left" },
	{ id: "bottom_right", name: "Bottom right" },
] as const;

export default function RunnerBrandingPreview({ ownerId, runnerId, overlayId, resolution = "720p" }: { ownerId: string; runnerId: string; overlayId: string; resolution?: "720p" | "1080p" }) {
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
	const [runnerPro, setRunnerPro] = useState(false);
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
				const status = frame && document?.URL === frame.src && surface?.getAttribute("data-runner-presentation-generation") === `preview-${runnerId}` ? surface.getAttribute("data-runner-layout-status") : null;
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
		<Card className='w-full max-w-5xl'>
			<Card.Header>
				<h2 className='text-lg font-semibold'>Appearance</h2>
				<p className='text-sm text-muted'>Choose where Clipify attribution appears on generated content.</p>
			</Card.Header>
			<Card.Content className='space-y-4'>
				{error && (
					<p role='alert' className='text-sm text-danger'>
						{error}
					</p>
				)}
				{runnerPro && (
					<StandbyEditor
						hasLogo={Boolean(logoAssetId)}
						hasBackground={Boolean(backgroundAssetId)}
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
				<Select
					value={corner}
					onChange={(value) => {
						setCorner(String(value) as Profile["watermarkCorner"]);
						setNotice(null);
					}}
					variant='secondary'
					isDisabled={!profile || saving || uploading}
				>
					<Label>Attribution corner</Label>
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{corners.map((item) => (
								<ListBox.Item key={item.id} id={item.id} textValue={item.name}>
									<ListBox.ItemIndicator />
									<Label>{item.name}</Label>
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
				<Button onPress={() => void save()} isDisabled={!profile || saving || uploading}>
					Save appearance
				</Button>
				{notice && (
					<p role='status' className='text-sm text-success'>
						{notice}
					</p>
				)}
				{profile && overlayId && (
					<div role='group' aria-label='Appearance preview mode' className='flex flex-wrap gap-2'>
						<Button variant={previewMode === "standby" ? "primary" : "secondary"} aria-pressed={previewMode === "standby"} onPress={() => setPreviewMode("standby")} isDisabled={saving || uploading}>
							Preview standby
						</Button>
						<Button variant={previewMode === "playback" ? "primary" : "secondary"} aria-pressed={previewMode === "playback"} onPress={() => setPreviewMode("playback")} isDisabled={saving || uploading}>
							Preview clips
						</Button>
					</div>
				)}
				{profile && overlayId && (
					<div ref={previewContainerRef} className='relative left-1/2 aspect-video w-screen max-w-none -translate-x-1/2 overflow-hidden sm:left-auto sm:w-full sm:translate-x-0 sm:rounded-lg sm:ring-1 sm:ring-default'>
						<iframe
							ref={previewRef}
							key={`${runnerId}:${profile.revision}:${overlayId}:${resolution}:${corner}:${showAttribution}:${standbyBackgroundColor}:${backgroundAssetId ?? ""}:${logoAssetId ?? ""}:${message}:${showNextBroadcastTime}:${previewMode}`}
							title='Runner appearance preview'
							src={`/runner/preview/${runnerId}?overlayId=${encodeURIComponent(overlayId)}&watermarkCorner=${corner}&previewMode=${previewMode}${runnerPro ? `&proShowAttribution=${showAttribution}&standbyBackgroundColor=${encodeURIComponent(standbyBackgroundColor)}&backgroundAssetId=${backgroundAssetId ?? ""}&logoAssetId=${logoAssetId ?? ""}&message=${encodeURIComponent(message)}&showNextBroadcastTime=${showNextBroadcastTime}` : ""}`}
							className='absolute left-0 top-0 max-w-none border-0'
							style={{ width: previewCanvas.width, height: previewCanvas.height, transform: `scale(${previewWidth / previewCanvas.width})`, transformOrigin: "top left" }}
						/>
					</div>
				)}
			</Card.Content>
		</Card>
	);
}
