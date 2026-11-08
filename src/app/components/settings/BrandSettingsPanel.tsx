"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button, Card, Description, FieldError, Form, Input, Label, ListBox, Modal, NumberField, Select, Skeleton, TextField } from "@heroui/react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useNavigationGuard } from "nextjs-nav-guard";
import { getCreatorBrand, saveCreatorBrand } from "@actions/creatorBrand";
import { creatorBrandSchema, DEFAULT_WIDGET_THEME, type CreatorBrand } from "@lib/overlayMetadata";
import { useDeploymentDraft } from "@lib/deploymentDrafts";
import { trackProductEvent } from "@lib/analytics";
import { notify } from "@lib/toast";
import type { AuthenticatedUser } from "@types";
import ThemeColorInput from "@components/theme/ThemeColorInput";
import ControlledModal from "@components/controlledModal";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
function BrandPreview({ creatorId, brand, username }: { creatorId: string; brand: CreatorBrand; username: string }) {
	const [src, setSrc] = useState(""),
		[failed, setFailed] = useState(false),
		[attempt, setAttempt] = useState(0);
	useEffect(() => {
		const timer = setTimeout(() => {
			if (!creatorBrandSchema.safeParse(brand).success) return;
			setSrc(`/api/clips/widget-preview?data=${encodeURIComponent(JSON.stringify({ creatorId, kind: "title", width: 720, height: 140, fontSize: 32, clip: { title: "A moment worth sharing", clipCreatorName: username }, theme: brand }))}&attempt=${attempt}`);
			setFailed(false);
		}, 400);
		return () => clearTimeout(timer);
	}, [creatorId, brand, username, attempt]);
	return (
		<div className='relative flex min-h-36 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary p-4' aria-label='Brand preview'>
			{src ? <Image unoptimized src={src} width={720} height={140} alt='Clip information styled with your brand' className='h-auto w-full max-w-2xl' onError={() => setFailed(true)} /> : <Skeleton className='h-24 w-full rounded-xl' />}
			{failed ? (
				<div className='absolute inset-0 flex items-center justify-center gap-3 bg-surface-secondary p-4'>
					<span className='text-sm text-muted'>Font preview unavailable</span>
					<Button variant='secondary' onPress={() => setAttempt((n) => n + 1)}>
						Retry preview
					</Button>
				</div>
			) : null}
		</div>
	);
}
export default function BrandSettingsPanel({ user }: { user: AuthenticatedUser }) {
	const [loaded, setLoaded] = useState(false),
		[failed, setFailed] = useState(false),
		[attempt, setAttempt] = useState(0),
		[draft, setDraft] = useState<CreatorBrand>(() => creatorBrandSchema.parse({})),
		[base, setBase] = useState<CreatorBrand>(() => creatorBrandSchema.parse({})),
		[revision, setRevision] = useState(0),
		[canEdit, setCanEdit] = useState(false),
		[busy, setBusy] = useState(false),
		[confirm, setConfirm] = useState(false),
		[fontError, setFontError] = useState("");
	useDeploymentDraft(loaded ? `creator-brand:${user.id}` : null, draft, base, (value, saved) => {
		setDraft(value as CreatorBrand);
		setBase(saved as CreatorBrand);
	});
	const dirty = JSON.stringify(draft) !== JSON.stringify(base);
	const guard = useNavigationGuard({ enabled: loaded && dirty });
	useEffect(() => {
		let active = true;
		const timeout = setTimeout(() => {
			if (active) {
				active = false;
				setFailed(true);
			}
		}, 15000);
		void getCreatorBrand(user.id)
			.then((result) => {
				if (!active) return;
				clearTimeout(timeout);
				if (!result.ok) {
					setFailed(true);
					return;
				}
				const initial = result.brand ?? creatorBrandSchema.parse({});
				setDraft(initial);
				setBase(initial);
				setRevision(result.revision);
				setCanEdit(result.canEdit);
				setLoaded(true);
			})
			.catch(() => {
				if (active) {
					clearTimeout(timeout);
					setFailed(true);
				}
			});
		return () => {
			active = false;
			clearTimeout(timeout);
		};
	}, [user.id, attempt]);
	async function save() {
		const parsed = creatorBrandSchema.safeParse(draft);
		if (!parsed.success) {
			setFontError("Choose a valid font and appearance.");
			return;
		}
		const snapshot = parsed.data;
		setBusy(true);
		setConfirm(false);
		setFontError("");
		try {
			const result = await saveCreatorBrand(user.id, snapshot, revision);
			if (!result.ok) {
				if (result.code === "FONT_UNAVAILABLE") {
					setFontError("This font could not be loaded. Check its Google Fonts family name or retry.");
					return;
				}
				notify({ title: result.code === "CONFLICT" ? "Brand changed in another tab" : "Brand could not be saved", description: result.code === "CONFLICT" ? "Your draft is preserved. Open Brand styling in another tab to compare the latest saved version." : "Your draft is preserved. Try again.", color: "danger" });
				return;
			}
			setBase(snapshot);
			setRevision(result.revision);
			trackProductEvent("brand_style_saved", { font_source: snapshot.fontSource, watermark: snapshot.watermark });
			notify({ title: "Brand saved", description: "Your overlays and clip layouts use this style. Refresh an open OBS browser source to apply it.", color: "success" });
		} catch {
			notify({ title: "Brand could not be saved", description: "Your draft is preserved. Try again.", color: "danger" });
		} finally {
			setBusy(false);
		}
	}
	return (
		<DashboardEditorLayout>
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-4'>
					<div>
						<Card.Title>Brand styling</Card.Title>
						<Card.Description>One look for your overlay widgets and exported clips.</Card.Description>
						{loaded && !canEdit ? <p className='text-sm text-muted'>You can view this brand. An account owner can change it.</p> : null}
					</div>
					<Button isPending={busy} isDisabled={!loaded || !canEdit || (revision > 0 && !dirty)} onPress={() => (revision === 0 ? setConfirm(true) : void save())}>
						<IconDeviceFloppy className='size-4' />
						{revision === 0 ? "Apply brand" : "Save brand"}
					</Button>
				</Card.Header>
				<Card.Content>
					{!loaded ? (
						failed ? (
							<div className='space-y-3'>
								<p className='text-sm text-muted'>Brand styling could not be loaded.</p>
								<Button
									variant='secondary'
									onPress={() => {
										setFailed(false);
										setLoaded(false);
										setAttempt((n) => n + 1);
									}}
								>
									Retry brand styling
								</Button>
							</div>
						) : (
							<Skeleton className='h-64 rounded-xl' />
						)
					) : (
						<fieldset disabled={!canEdit} className='contents'>
							<Form
								className='flex flex-col gap-6'
								onSubmit={(event) => {
									event.preventDefault();
									if (revision === 0) setConfirm(true);
									else void save();
								}}
							>
								<BrandPreview creatorId={user.id} brand={draft} username={user.username} />
								<section className='grid grid-cols-1 gap-4 md:grid-cols-2' aria-label='Brand colors'>
									{(
										[
											["progressBarStartColor", "Progress gradient start", "#26018E"],
											["progressBarEndColor", "Progress gradient end", "#8D42F9"],
										] as const
									).map(([field, label, fallback]) => (
										<ThemeColorInput key={field} label={label} value={draft[field]} defaultValue={fallback} onChange={(value) => setDraft({ ...draft, [field]: value })} />
									))}
									{(
										[
											["themeTextColor", "Text Color"],
											["themeBackgroundColor", "Background Color"],
											["themeAccentColor", "Accent Color"],
										] as const
									).map(([field, label]) => (
										<ThemeColorInput key={field} label={label} value={draft[field]} defaultValue={DEFAULT_WIDGET_THEME[field]} allowAlpha={field === "themeBackgroundColor"} onChange={(value) => setDraft({ ...draft, [field]: value })} />
									))}
									{(
										[
											["borderRadius", "Corner radius (px)", 80],
											["borderSize", "Border width (px)", 32],
										] as const
									).map(([field, label, max]) => (
										<NumberField
											key={field}
											variant='secondary'
											minValue={0}
											maxValue={max}
											value={draft[field]}
											onChange={(value) => {
												if (Number.isFinite(value)) setDraft({ ...draft, [field]: value });
											}}
										>
											<Label>{label}</Label>
											<NumberField.Group>
												<NumberField.DecrementButton />
												<NumberField.Input />
												<NumberField.IncrementButton />
											</NumberField.Group>
										</NumberField>
									))}
								</section>
								<section className='grid grid-cols-1 gap-4 md:grid-cols-2' aria-label='Brand typography'>
									<Select
										variant='secondary'
										value={draft.fontSource}
										onChange={(value) => {
											setFontError("");
											setDraft({ ...draft, fontSource: value === "google" ? "google" : "builtin", fontFamily: value === "google" ? "Laila" : "DejaVu Sans" });
										}}
									>
										<Label>Font source</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBox.Item id='builtin' textValue='Built-in fonts'>
													Built-in fonts
													<ListBox.ItemIndicator />
												</ListBox.Item>
												<ListBox.Item id='google' textValue='Google Fonts'>
													Google Fonts
													<ListBox.ItemIndicator />
												</ListBox.Item>
											</ListBox>
										</Select.Popover>
									</Select>
									{draft.fontSource === "google" ? (
										<TextField variant='secondary' isInvalid={Boolean(fontError)}>
											<Label>Google font family</Label>
											<Input
												value={draft.fontFamily}
												onChange={(event) => {
													setFontError("");
													setDraft({ ...draft, fontFamily: event.target.value });
												}}
											/>
											<Description>Use the family name, for example Laila, Poppins or Space Grotesk.</Description>
											<FieldError>{fontError}</FieldError>
										</TextField>
									) : (
										<Select variant='secondary' value={draft.fontFamily} onChange={(value) => setDraft({ ...draft, fontFamily: String(value) })}>
											<Label>Font family</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													{["DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono"].map((font) => (
														<ListBox.Item key={font} id={font} textValue={font}>
															{font}
															<ListBox.ItemIndicator />
														</ListBox.Item>
													))}
												</ListBox>
											</Select.Popover>
										</Select>
									)}
								</section>
							</Form>
						</fieldset>
					)}
				</Card.Content>
			</Card>
			<ControlledModal ariaLabel='Apply account brand' isOpen={confirm} onClose={() => setConfirm(false)}>
				<Modal.Header>
					<Modal.Heading>Apply your account brand?</Modal.Heading>
				</Modal.Header>
				<Modal.Body>This changes widget colors and fonts across your overlays and clip layouts. Positions, crops and video effects stay as they are.</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onPress={() => setConfirm(false)}>
						Keep editing
					</Button>
					<Button onPress={() => void save()}>Apply to overlays and clips</Button>
				</Modal.Footer>
			</ControlledModal>
			<ControlledModal ariaLabel='Unsaved brand changes' isOpen={guard.active} onClose={() => guard.reject()}>
				<Modal.Header>
					<Modal.Heading>Leave without saving?</Modal.Heading>
				</Modal.Header>
				<Modal.Body>Your brand has unsaved changes.</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onPress={() => guard.reject()}>
						Keep editing
					</Button>
					<Button variant='danger' onPress={() => guard.accept()}>
						Discard changes
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</DashboardEditorLayout>
	);
}
