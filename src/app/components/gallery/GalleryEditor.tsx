"use client";

import { getGalleryDraftPreview, saveGallery } from "@actions/gallery";
import AppDateRangePicker from "@components/appDateRangePicker";
import ControlledModal from "@components/controlledModal";
import CodeSnippet from "@components/codeSnippet";
import GalleryInlinePreview from "@components/gallery/GalleryInlinePreview";
import TagsInput from "@components/tagsInput";
import { notify as addToast } from "@lib/toast";
import { Alert, Button, Card, Checkbox, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, Description, FieldError, Form, Input, Label, Link, ListBox, Modal, NumberField, parseColor, Select, Separator, Switch, TextField, Tooltip } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { parseDate } from "@internationalized/date";
import { IconAlertTriangle, IconArrowLeft, IconCrown, IconDeviceFloppy, IconPlayerPauseFilled, IconPlayerPlayFilled, IconRestore } from "@tabler/icons-react";
import type { Gallery, Playlist, TwitchClip } from "@types";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigationGuard } from "next-navigation-guard";
import { CLIPIFY_ELEMENTS_HELP_URL, FREE_PLAYLIST_CLIP_LIMIT } from "@lib/constants";
import type { GalleryPatch } from "@lib/gallery";

type SelectOption = { value: string; label: string };

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
	return (
		<section className='flex w-full flex-col gap-4'>
			<div>
				<h2 className='text-lg font-semibold'>{title}</h2>
				{description ? <p className='text-sm text-muted'>{description}</p> : null}
			</div>
			{children}
		</section>
	);
}

function GallerySelect({ label, value, options, onChange, description, isDisabled = false }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; description?: string; isDisabled?: boolean }) {
	return (
		<Select fullWidth variant='secondary' value={value} onChange={(next) => onChange(String(next))} isDisabled={isDisabled}>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item key={option.value} id={option.value} textValue={option.label}>
							<Label>{option.label}</Label>
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
			{description ? <Description>{description}</Description> : null}
		</Select>
	);
}

function GalleryNumber({ label, value, minValue, maxValue, onChange, description, isDisabled = false }: { label: string; value: number; minValue: number; maxValue?: number; onChange: (value: number) => void; description?: string; isDisabled?: boolean }) {
	return (
		<NumberField fullWidth variant='secondary' value={value} minValue={minValue} maxValue={maxValue} onChange={(next) => onChange(Number(next) || 0)} isDisabled={isDisabled}>
			<Label>{label}</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
			{description ? <Description>{description}</Description> : null}
		</NumberField>
	);
}

function GallerySwitch({ label, isSelected, onChange, description, isDisabled = false }: { label: string; isSelected: boolean; onChange: (value: boolean) => void; description?: string; isDisabled?: boolean }) {
	return (
		<Switch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled}>
			<Switch.Content>
				<Switch.Control>
					<Switch.Thumb />
				</Switch.Control>
				<span>
					<span className='block'>{label}</span>
					{description ? <span className='block text-xs text-muted'>{description}</span> : null}
				</span>
			</Switch.Content>
		</Switch>
	);
}

function GalleryCheckbox({ label, isSelected, onChange, isDisabled = false }: { label: string; isSelected: boolean; onChange: (value: boolean) => void; isDisabled?: boolean }) {
	return (
		<Checkbox isSelected={isSelected} onChange={onChange} isDisabled={isDisabled}>
			<Checkbox.Content>
				<Checkbox.Control>
					<Checkbox.Indicator />
				</Checkbox.Control>
				{label}
			</Checkbox.Content>
		</Checkbox>
	);
}

function GalleryColorPicker({ label, value, defaultValue, onChange, isDisabled, allowAlpha = false }: { label: string; value: string; defaultValue: string; onChange: (value: string) => void; isDisabled: boolean; allowAlpha?: boolean }) {
	const parsedColor = useMemo(() => {
		try {
			return parseColor(value);
		} catch {
			return parseColor(defaultValue);
		}
	}, [defaultValue, value]);
	const swatches = Array.from(new Set([defaultValue, "#7C3AED", "#9146FF", "#18181B", "#FFFFFF", "#000000"]));
	return (
		<ColorPicker value={parsedColor} onChange={(color) => onChange(color.toString(allowAlpha ? "rgba" : "hex"))}>
			<ColorField fullWidth isDisabled={isDisabled}>
				<Label>{label}</Label>
				<ColorField.Group fullWidth variant='secondary'>
					<ColorField.Input />
					<ColorField.Suffix className='pe-1'>
						<ColorPicker.Trigger className='p-1' aria-label={`Pick ${label}`}>
							<ColorSwatch size='xs' />
						</ColorPicker.Trigger>
					</ColorField.Suffix>
				</ColorField.Group>
			</ColorField>
			<ColorPicker.Popover className='max-w-62 gap-2' placement='bottom end'>
				<ColorArea aria-label={`${label} color area`} className='max-w-full' colorSpace='hsb' xChannel='saturation' yChannel='brightness'>
					<ColorArea.Thumb />
				</ColorArea>
				<ColorSlider aria-label={`${label} hue`} channel='hue' className='gap-1 px-1' colorSpace='hsb'>
					<Label>Hue</Label>
					<ColorSlider.Output className='text-muted' />
					<ColorSlider.Track>
						<ColorSlider.Thumb />
					</ColorSlider.Track>
				</ColorSlider>
				{allowAlpha ? (
					<ColorSlider aria-label={`${label} opacity`} channel='alpha' className='gap-1 px-1' colorSpace='rgb'>
						<Label>Opacity</Label>
						<ColorSlider.Output className='text-muted' />
						<ColorSlider.Track>
							<ColorSlider.Thumb />
						</ColorSlider.Track>
					</ColorSlider>
				) : null}
				<ColorSwatchPicker className='justify-center px-1' size='xs'>
					{swatches.map((swatch) => (
						<ColorSwatchPicker.Item key={swatch} color={swatch}>
							<ColorSwatchPicker.Swatch />
						</ColorSwatchPicker.Item>
					))}
				</ColorSwatchPicker>
				<Button className='w-full' size='sm' variant='tertiary' onPress={() => onChange(defaultValue)}>
					Reset to default
				</Button>
			</ColorPicker.Popover>
		</ColorPicker>
	);
}

export default function GalleryEditor({ initialGallery, playlists, canUseAdvanced, canUseStyling, previewClips, previewOwnerName, showPreviewAttribution }: { initialGallery: Gallery; playlists: Playlist[]; canUseAdvanced: boolean; canUseStyling: boolean; previewClips: TwitchClip[]; previewOwnerName: string; showPreviewAttribution: boolean }) {
	const router = useRouter();
	const [gallery, setGallery] = useState(initialGallery);
	const [savedGallery, setSavedGallery] = useState(initialGallery);
	const [saving, setSaving] = useState(false);
	const [livePreviewClips, setLivePreviewClips] = useState(previewClips);
	const [previewUpdating, setPreviewUpdating] = useState(false);
	const [previewError, setPreviewError] = useState(false);
	const initialPreview = useRef(true);
	const ownerPlaylists = useMemo(() => playlists.filter((playlist) => playlist.ownerId === gallery.ownerId), [gallery.ownerId, playlists]);
	const isGalleryDirty = useMemo(() => JSON.stringify(gallery) !== JSON.stringify(savedGallery), [gallery, savedGallery]);
	const navGuard = useNavigationGuard({ enabled: isGalleryDirty });
	const customDateRange = useMemo(() => {
		if (!gallery.liveCustomStart || !gallery.liveCustomEnd) return null;
		return {
			start: parseDate(new Date(gallery.liveCustomStart).toISOString().slice(0, 10)),
			end: parseDate(new Date(gallery.liveCustomEnd).toISOString().slice(0, 10)),
		};
	}, [gallery.liveCustomEnd, gallery.liveCustomStart]);
	const update = <K extends keyof Gallery>(key: K, value: Gallery[K]) => setGallery((current) => ({ ...current, [key]: value }));
	const previewDraft = useMemo<GalleryPatch>(
		() => ({
			source: gallery.source,
			playlistId: gallery.source === "curated" ? gallery.playlistId : null,
			liveSort: gallery.liveSort,
			liveTimeWindow: gallery.liveTimeWindow,
			liveCustomStart: gallery.liveCustomStart,
			liveCustomEnd: gallery.liveCustomEnd,
			liveResultLimit: gallery.liveResultLimit,
			includeCategories: gallery.includeCategories,
			excludeCategories: gallery.excludeCategories,
			minimumViews: gallery.minimumViews,
			minimumDuration: gallery.minimumDuration,
			maximumDuration: gallery.maximumDuration,
			titleBlacklist: gallery.titleBlacklist,
			creatorAllowlist: gallery.creatorAllowlist,
			creatorBlocklist: gallery.creatorBlocklist,
		}),
		[gallery.creatorAllowlist, gallery.creatorBlocklist, gallery.excludeCategories, gallery.includeCategories, gallery.liveCustomEnd, gallery.liveCustomStart, gallery.liveResultLimit, gallery.liveSort, gallery.liveTimeWindow, gallery.maximumDuration, gallery.minimumDuration, gallery.minimumViews, gallery.playlistId, gallery.source, gallery.titleBlacklist],
	);

	useEffect(() => {
		if (initialPreview.current) {
			initialPreview.current = false;
			return;
		}
		let cancelled = false;
		setPreviewUpdating(true);
		setPreviewError(false);
		setLivePreviewClips([]);
		const timer = window.setTimeout(() => {
			void getGalleryDraftPreview(gallery.id, previewDraft)
				.then((preview) => {
					if (cancelled) return;
					if (!preview) {
						setPreviewError(true);
						return;
					}
					setLivePreviewClips(preview.clips);
				})
				.catch(() => {
					if (!cancelled) setPreviewError(true);
				})
				.finally(() => {
					if (!cancelled) setPreviewUpdating(false);
				});
		}, 200);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [gallery.id, previewDraft]);

	const save = async () => {
		setSaving(true);
		try {
			const saved = await saveGallery(gallery.id, gallery);
			if (!saved) throw new Error("Gallery could not be saved");
			setSavedGallery(saved);
			setGallery(saved);
			addToast({ title: "Gallery settings saved", description: "Your gallery settings have been saved successfully.", color: "success" });
			return saved;
		} catch (error) {
			addToast({ title: "Save failed", description: error instanceof Error ? error.message : "Please try again.", color: "danger" });
			return null;
		} finally {
			setSaving(false);
		}
	};

	const resetStyling = () =>
		setGallery((current) => ({
			...current,
			theme: "system",
			accentColor: "#7C3AED",
			backgroundMode: "transparent",
			backgroundColor: "#000000",
			cardSurfaceColor: "#18181B",
			textColor: "#FFFFFF",
			cardRadius: 16,
			gap: 16,
			thumbnailTreatment: "cover",
			modalBackdrop: "rgba(0,0,0,0.72)",
			desktopModalWidth: 960,
		}));

	return (
		<div className='flex w-full flex-col items-center justify-center p-4'>
			<Card className='w-full max-w-4xl'>
				<Card.Header className='flex w-full flex-row items-center justify-between gap-4'>
					<div className='flex min-w-0 items-center gap-3'>
						<Button isIconOnly variant='tertiary' aria-label='Back to dashboard' onPress={() => router.push("/dashboard")}>
							<IconArrowLeft />
						</Button>
						<h1 className='truncate text-xl font-bold'>Gallery Settings</h1>
					</div>
					<span className='hidden shrink-0 text-sm text-muted sm:inline'>ID: {gallery.id}</span>
				</Card.Header>
				<Separator />
				<Card.Content>
					<Form
						className='flex w-full flex-col gap-3'
						onSubmit={(event) => {
							event.preventDefault();
							void save();
						}}
					>
						<div className='flex w-full items-center gap-2'>
							<Switch isSelected={gallery.published} onChange={(value) => update("published", value)} aria-label='Set gallery publication status'>
								<Switch.Content>
									<Switch.Control>
										<Switch.Thumb>
											<Switch.Icon>{gallery.published ? <IconPlayerPlayFilled size={12} /> : <IconPlayerPauseFilled size={12} />}</Switch.Icon>
										</Switch.Thumb>
									</Switch.Control>
								</Switch.Content>
							</Switch>
							<span className='text-sm text-muted'>{gallery.published ? "Published" : "Draft"}</span>
							<div className='flex-1' />
							<Tooltip delay={0}>
								<Tooltip.Trigger>
									<Button type='submit' isIconOnly isPending={saving} isDisabled={saving || !isGalleryDirty} aria-label='Save Gallery Settings' variant='primary'>
										<IconDeviceFloppy />
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>Save Gallery Settings</Tooltip.Content>
							</Tooltip>
						</div>

						<SettingsSection title='General'>
							<TextField fullWidth variant='secondary' isRequired>
								<Label>Gallery Name</Label>
								<Input value={gallery.name} maxLength={120} onChange={(event) => update("name", event.target.value)} />
								<FieldError />
							</TextField>
							<div className='grid w-full gap-4 sm:grid-cols-2'>
								<GallerySelect
									label='Source'
									value={gallery.source}
									options={[
										{ value: "curated", label: "Curated playlist" },
										{ value: "live", label: "Live clips" },
									]}
									onChange={(value) =>
										setGallery((current) => ({
											...current,
											source: value as Gallery["source"],
											playlistId: value === "live" ? null : current.playlistId,
										}))
									}
								/>
								{gallery.source === "curated" ? <GallerySelect label='Playlist' value={gallery.playlistId ?? "none"} options={[{ value: "none", label: "Select a playlist" }, ...ownerPlaylists.map((playlist) => ({ value: playlist.id, label: playlist.name }))]} onChange={(value) => update("playlistId", value === "none" ? null : value)} /> : null}
							</div>
							{gallery.source === "live" ? (
								<div className='grid w-full gap-4 sm:grid-cols-3'>
									<GallerySelect label='Sort' value={gallery.liveSort} options={[{ value: "newest", label: "Newest" }, { value: "most_viewed", label: "Most viewed" }, ...(canUseAdvanced ? [{ value: "stable_random", label: "Stable random" }] : [])]} onChange={(value) => update("liveSort", value as Gallery["liveSort"])} />
									<GallerySelect label='Time Window' value={gallery.liveTimeWindow} options={[{ value: "today", label: "Today" }, { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }, { value: "all", label: "All time" }, ...(canUseAdvanced ? [{ value: "custom", label: "Custom dates" }] : [])]} onChange={(value) => update("liveTimeWindow", value as Gallery["liveTimeWindow"])} />
									<GalleryNumber label='Clip Limit' value={gallery.liveResultLimit} minValue={1} maxValue={canUseAdvanced ? 100 : FREE_PLAYLIST_CLIP_LIMIT} onChange={(value) => update("liveResultLimit", value)} />
								</div>
							) : null}
							{gallery.source === "live" && gallery.liveTimeWindow === "custom" && canUseAdvanced ? (
								<AppDateRangePicker
									fullWidth
									variant='secondary'
									label='Custom Date Range'
									value={customDateRange}
									onChange={(range) => {
										update("liveCustomStart", range ? new Date(`${range.start.toString()}T00:00:00`) : null);
										update("liveCustomEnd", range ? new Date(`${range.end.toString()}T23:59:59`) : null);
									}}
								/>
							) : null}
						</SettingsSection>

						<Separator />

						<SettingsSection title='Website Preview' description='Layout and styling update here immediately. Select a clip to test the real website-level player modal.'>
							<GalleryInlinePreview gallery={gallery} clips={livePreviewClips} ownerName={previewOwnerName} showAttribution={showPreviewAttribution} isUpdating={previewUpdating} hasError={previewError} />
						</SettingsSection>

						<Separator />

						<SettingsSection title='Layout' description='The selected layout is locked for visitors.'>
							<GallerySelect
								label='Visitor Layout'
								value={gallery.layout}
								options={[
									{ value: "grid", label: "Grid" },
									{ value: "list", label: "List" },
									{ value: "carousel", label: "Carousel" },
								]}
								onChange={(value) => update("layout", value as Gallery["layout"])}
							/>
							{gallery.layout === "grid" ? (
								<>
									<GallerySwitch label='Auto-responsive grid' description='Recommended. Clipify chooses safe column counts for the available container.' isSelected={gallery.gridAuto} onChange={(value) => update("gridAuto", value)} />
									{!gallery.gridAuto ? (
										<div className='grid w-full gap-4 sm:grid-cols-3'>
											<GalleryNumber label='Mobile Columns' value={gallery.gridMobileColumns} minValue={1} maxValue={2} onChange={(value) => update("gridMobileColumns", value)} />
											<GalleryNumber label='Tablet Columns' value={gallery.gridTabletColumns} minValue={2} maxValue={4} onChange={(value) => update("gridTabletColumns", value)} />
											<GalleryNumber label='Desktop Columns' value={gallery.gridDesktopColumns} minValue={2} maxValue={6} onChange={(value) => update("gridDesktopColumns", value)} />
										</div>
									) : null}
								</>
							) : null}
							{gallery.layout === "list" ? (
								<GallerySelect
									label='Density'
									value={gallery.listDensity}
									options={[
										{ value: "compact", label: "Compact" },
										{ value: "comfortable", label: "Comfortable" },
									]}
									onChange={(value) => update("listDensity", value)}
								/>
							) : null}
							{gallery.layout === "carousel" ? (
								<>
									<div className='grid w-full gap-4 sm:grid-cols-3'>
										<GalleryNumber label='Mobile Cards' value={gallery.carouselMobileCards} minValue={1} maxValue={2} onChange={(value) => update("carouselMobileCards", value)} />
										<GalleryNumber label='Tablet Cards' value={gallery.carouselTabletCards} minValue={1} maxValue={4} onChange={(value) => update("carouselTabletCards", value)} />
										<GalleryNumber label='Desktop Cards' value={gallery.carouselDesktopCards} minValue={1} maxValue={6} onChange={(value) => update("carouselDesktopCards", value)} />
									</div>
									<div className='flex flex-wrap gap-5'>
										<GalleryCheckbox label='Navigation buttons' isSelected={gallery.carouselShowNavigation} onChange={(value) => update("carouselShowNavigation", value)} />
										<GalleryCheckbox label='Indicators' isSelected={gallery.carouselShowIndicators} onChange={(value) => update("carouselShowIndicators", value)} />
									</div>
								</>
							) : null}
							<div>
								<p className='mb-2 text-sm font-medium'>Metadata</p>
								<div className='flex flex-wrap gap-5'>
									<GalleryCheckbox label='Title' isSelected={gallery.showTitle} onChange={(value) => update("showTitle", value)} />
									<GalleryCheckbox label='Creator' isSelected={gallery.showCreator} onChange={(value) => update("showCreator", value)} />
									<GalleryCheckbox label='Views' isSelected={gallery.showViews} onChange={(value) => update("showViews", value)} />
									<GalleryCheckbox label='Duration' isSelected={gallery.showDuration} onChange={(value) => update("showDuration", value)} />
									<GalleryCheckbox label='Creation date' isSelected={gallery.showCreatedAt} onChange={(value) => update("showCreatedAt", value)} />
								</div>
							</div>
						</SettingsSection>

						<Separator />

						<SettingsSection title='Advanced Live Filters' description={canUseAdvanced ? "Apply precise filters to live galleries." : "Available with Pro. Free galleries keep broad discovery useful."}>
							{!canUseAdvanced ? (
								<Alert status='warning'>
									<Alert.Indicator>
										<IconCrown size={18} />
									</Alert.Indicator>
									<Alert.Content>
										<Alert.Title>Advanced live filters require Pro</Alert.Title>
										<Alert.Description>Upgrade to filter by categories, views, duration, title, and creators.</Alert.Description>
										<Button size='sm' variant='secondary' onPress={() => router.push("/pricing")}>
											View Pro
										</Button>
									</Alert.Content>
								</Alert>
							) : null}
							<div className='grid w-full gap-4 sm:grid-cols-2'>
								<TagsInput fullWidth label='Included Category IDs' value={gallery.includeCategories} onValueChange={(value) => update("includeCategories", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
								<TagsInput fullWidth label='Excluded Category IDs' value={gallery.excludeCategories} onValueChange={(value) => update("excludeCategories", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
								<GalleryNumber label='Minimum Views' value={gallery.minimumViews} minValue={0} onChange={(value) => update("minimumViews", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
								<div className='grid grid-cols-2 gap-3'>
									<GalleryNumber label='Min Duration' value={gallery.minimumDuration} minValue={0} onChange={(value) => update("minimumDuration", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
									<GalleryNumber label='Max Duration' value={gallery.maximumDuration} minValue={0} onChange={(value) => update("maximumDuration", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
								</div>
								<TagsInput fullWidth label='Title Blacklist' value={gallery.titleBlacklist} onValueChange={(value) => update("titleBlacklist", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
								<TagsInput fullWidth label='Creator Allowlist' value={gallery.creatorAllowlist} onValueChange={(value) => update("creatorAllowlist", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
								<TagsInput fullWidth label='Creator Blocklist' value={gallery.creatorBlocklist} onValueChange={(value) => update("creatorBlocklist", value)} isDisabled={!canUseAdvanced || gallery.source !== "live"} />
							</div>
						</SettingsSection>

						<Separator />

						<SettingsSection title='Pro Styling' description={canUseStyling ? "Saved defaults for the gallery and website modal." : "Free galleries use Clipify defaults and attribution."}>
							<div className='grid w-full gap-4 sm:grid-cols-2'>
								<GallerySelect
									label='Theme'
									value={gallery.theme}
									options={[
										{ value: "system", label: "System" },
										{ value: "light", label: "Light" },
										{ value: "dark", label: "Dark" },
									]}
									onChange={(value) => update("theme", value as Gallery["theme"])}
									isDisabled={!canUseStyling}
								/>
								<GallerySelect
									label='Background'
									value={gallery.backgroundMode}
									options={[
										{ value: "transparent", label: "Transparent" },
										{ value: "solid", label: "Solid" },
									]}
									onChange={(value) => update("backgroundMode", value)}
									isDisabled={!canUseStyling}
								/>
							</div>
							<div className='grid w-full gap-4 sm:grid-cols-2'>
								<GalleryColorPicker label='Accent Color' value={gallery.accentColor} defaultValue='#7C3AED' onChange={(value) => update("accentColor", value)} isDisabled={!canUseStyling} />
								<GalleryColorPicker label='Background Color' value={gallery.backgroundColor} defaultValue='#000000' onChange={(value) => update("backgroundColor", value)} isDisabled={!canUseStyling || gallery.backgroundMode !== "solid"} />
								<GalleryColorPicker label='Card Surface' value={gallery.cardSurfaceColor} defaultValue='#18181B' onChange={(value) => update("cardSurfaceColor", value)} isDisabled={!canUseStyling} />
								<GalleryColorPicker label='Text Color' value={gallery.textColor} defaultValue='#FFFFFF' onChange={(value) => update("textColor", value)} isDisabled={!canUseStyling} />
								<GalleryColorPicker label='Modal Backdrop' value={gallery.modalBackdrop} defaultValue='rgba(0,0,0,0.72)' onChange={(value) => update("modalBackdrop", value)} isDisabled={!canUseStyling} allowAlpha />
							</div>
							<div className='grid w-full gap-4 sm:grid-cols-2'>
								<GalleryNumber label='Card Radius' value={gallery.cardRadius} minValue={0} maxValue={32} onChange={(value) => update("cardRadius", value)} isDisabled={!canUseStyling} />
								<GalleryNumber label='Gap' value={gallery.gap} minValue={4} maxValue={48} onChange={(value) => update("gap", value)} isDisabled={!canUseStyling} />
								<GalleryNumber label='Modal Width' value={gallery.desktopModalWidth} minValue={640} maxValue={1440} onChange={(value) => update("desktopModalWidth", value)} isDisabled={!canUseStyling} />
							</div>
							<div className='flex justify-end'>
								<Button type='button' variant='tertiary' isDisabled={!canUseStyling} onPress={resetStyling}>
									<IconRestore size={17} /> Reset Theme
								</Button>
							</div>
						</SettingsSection>

						<Separator />

						<SettingsSection title='Integration' description='Copy the gallery element below, then install Clipify Elements once on your website. Raw gallery iframes are intentionally unsupported.'>
							<CodeSnippet symbol='' className='w-full' preClassName='overflow-x-auto whitespace-nowrap'>
								{`<clipify-gallery gallery-id="${gallery.id}"></clipify-gallery>`}
							</CodeSnippet>
							<div className='flex flex-wrap gap-2'>
								<Link href={CLIPIFY_ELEMENTS_HELP_URL} target='_blank' rel='noopener noreferrer' className={buttonVariants({ variant: "secondary" })}>
									Install Clipify Elements
									<Link.Icon />
								</Link>
							</div>
							{!gallery.published ? <p className='text-xs text-muted'>You can preview drafts above. Publish and save before using the element on an external website.</p> : null}
						</SettingsSection>
					</Form>
				</Card.Content>
			</Card>

			<ControlledModal variant='blur' isOpen={navGuard.active} onClose={navGuard.reject}>
				<Modal.Header>
					<Modal.Heading className='flex items-center'>
						<IconAlertTriangle className='mr-2' />
						Unsaved Changes
					</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					<p className='text-sm text-foreground'>
						You&apos;ve made changes to your <span className='font-semibold text-foreground'>gallery settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
						<br />
						<br />
						<span className='font-semibold text-foreground'>Do you want to continue without saving?</span>
					</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='tertiary' onPress={navGuard.reject} aria-label='Cancel'>
						Cancel
					</Button>
					<Button onPress={navGuard.accept} aria-label='Discard Changes' variant='danger'>
						Discard changes
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</div>
	);
}
