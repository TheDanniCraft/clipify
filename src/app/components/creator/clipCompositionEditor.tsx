"use client";
import type { AuthenticatedUser } from "@types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Input, Label, TextField, NumberField, Select, ListBox, Modal, Link, Autocomplete, SearchField, EmptyState, Tabs, Switch, Tooltip, Skeleton } from "@heroui/react";
import { IconArrowLeft, IconPlus, IconArrowUp, IconArrowDown, IconTrash, IconLock } from "@tabler/icons-react";
import { useNavigationGuard } from "nextjs-nav-guard";
import { saveClipLayoutTemplate, saveClipLayoutOverride, resetClipLayoutOverride, type ClipLayoutTemplate } from "@actions/clipLayoutLibrary";
import { getCreatorClipInventory, getCreatorClipDetail, searchCreatorLibrary } from "@actions/creatorLibrary";
import { compositionWidgetTheme, compositionDimensions, resizeCompositionRect, updateCompositionFrame, updateCompositionSource, type ClipComposition, type CompositionLayer } from "@lib/clipComposition";
import { compositionLayerColor, templateCompositions } from "@lib/clipLayoutTemplate";
import { notify } from "@lib/toast";
import ThemeColorInput from "@components/theme/ThemeColorInput";
import { type CreatorBrand, DEFAULT_WIDGET_THEME, overlayMetadataHeight, overlayMetadataSize } from "@lib/overlayMetadata";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import UpgradeModal from "@components/upgradeModal";
import { trackProductEvent } from "@lib/analytics";
import ControlledModal from "@components/controlledModal";
import Logo from "@components/logo";
import ClipCompositionCanvas from "./clipCompositionCanvas";
type Clip = Extract<Awaited<ReturnType<typeof getCreatorClipDetail>>, { ok: true }>["clip"];
function Numeric({ label, value, min = 0, max = 100, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
	return (
		<NumberField
			variant='secondary'
			value={value}
			minValue={min}
			maxValue={max}
			step={0.1}
			onChange={(v) => {
				if (Number.isFinite(v)) onChange(v);
			}}
		>
			<Label>{label}</Label>
			<NumberField.Group>
				<NumberField.DecrementButton />
				<NumberField.Input />
				<NumberField.IncrementButton />
			</NumberField.Group>
		</NumberField>
	);
}
export default function ClipCompositionEditor({ user, creatorId, entry, initial, clipId, referenceId, onBack, onSaved, onReferenceChange, brand, canRemoveWatermark = false }: { user?: AuthenticatedUser; brand?: CreatorBrand | null; canRemoveWatermark?: boolean; creatorId: string; entry: ClipLayoutTemplate; initial: ClipComposition; clipId?: string; referenceId?: string; onBack: () => void; onSaved: () => void; onReferenceChange?: (id: string) => void }) {
	const [sourceDimensions, setSourceDimensions] = useState({ width: 1920, height: 1080 }),
		[layout, setLayout] = useState(initial),
		[drafts, setDrafts] = useState(() => ({ ...templateCompositions(entry), [initial.format]: initial })),
		[editedFormats, setEditedFormats] = useState<Set<ClipComposition["format"]>>(() => new Set()),
		[name, setName] = useState(entry.name),
		[dirty, setDirty] = useState(false),
		[saving, setSaving] = useState(false),
		[selected, setSelected] = useState(initial.layers[0].id),
		[boxMode, setBoxMode] = useState("output"),
		[clip, setClip] = useState<Clip | null>(null),
		[reference, setReference] = useState(clipId ?? referenceId ?? entry.referenceClipId ?? ""),
		[referenceError, setReferenceError] = useState(false),
		[clips, setClips] = useState<Clip[]>([]),
		[search, setSearch] = useState(""),
		[loading, setLoading] = useState(true),
		[pickerOpen, setPickerOpen] = useState(false),
		[retry, setRetry] = useState(0),
		[reset, setReset] = useState(false),
		[upgrade, setUpgrade] = useState(false);
	const revision = useRef(0);
	const selectLayer = useCallback((id: string, mode?: "source" | "output") => {
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		setSelected(id);
		if (mode) setBoxMode(mode);
	}, []);
	useEffect(() => {
		const deselect = (event: PointerEvent) => {
			if (!(event.target instanceof Element) || !event.target.closest('[data-clip-editor],[role="listbox"],[role="menu"],[role="dialog"]')) selectLayer("");
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && (!(event.target instanceof Element) || !event.target.closest('[role="dialog"],[role="listbox"],[role="menu"]'))) selectLayer("");
		};
		document.addEventListener("pointerdown", deselect);
		window.addEventListener("keydown", escape);
		return () => {
			document.removeEventListener("pointerdown", deselect);
			window.removeEventListener("keydown", escape);
		};
	}, [selectLayer]);
	const guard = useNavigationGuard({ enabled: dirty });
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	useEffect(() => {
		if (!pickerOpen) return;
		let active = true;
		const timer = setTimeout(() => {
			const request = search.trim().length >= 2 ? searchCreatorLibrary({ creatorId, title: search, cachedOnly: true }) : getCreatorClipInventory({ creatorId, query: { pageSize: 10 }, cachedOnly: true });
			void request
				.then((result) => {
					if (!active) return;
					if (result.ok) setClips(result.items);
					else notify({ title: "Reference clips could not be loaded", description: "Try searching again.", color: "danger" });
				})
				.catch(() => {
					if (active) notify({ title: "Reference clips could not be loaded", color: "danger" });
				})
				.finally(() => {
					if (active) setLoading(false);
				});
		}, 250);
		return () => {
			clearTimeout(timer);
			active = false;
		};
	}, [creatorId, search, pickerOpen]);
	useEffect(() => {
		let active = true;
		if (reference && clip?.id !== reference)
			void getCreatorClipDetail({ creatorId, clipId: reference, cachedOnly: true })
				.then((result) => {
					if (active) {
						if (result.ok) setClip(result.clip);
						else setReferenceError(true);
					}
				})
				.catch(() => {
					if (active) setReferenceError(true);
				});
		return () => {
			active = false;
		};
	}, [creatorId, reference, retry, clip?.id]);
	const change = (next: ClipComposition) => {
		setLayout(next);
		setDrafts((previous) => ({ ...previous, [next.format]: next }));
		setEditedFormats((previous) => new Set([...previous, next.format]));
		revision.current++;
		setDirty(true);
	};
	const watermarkEnabled = !canRemoveWatermark || (layout.watermark ?? true);
	const removeWatermark = () => {
		if (!canRemoveWatermark) {
			trackProductEvent("export_branding_upgrade_requested", { source: "clip_layout" });
			setUpgrade(true);
			return;
		}
		change({ ...layout, watermark: false });
		if (selected === "clipify-watermark") selectLayer("");
	};
	const layer = layout.layers.find((item) => item.id === selected) ?? layout.layers[0];
	const sourceMode = layer.kind === "video" && boxMode === "source";
	const box = sourceMode ? layer.source : layer.frame;
	const update = (next: CompositionLayer) => change({ ...layout, layers: layout.layers.map((item) => (item.id === layer.id ? next : item)) });
	const add = (kind: CompositionLayer["kind"] | "watermark") => {
		if (kind === "watermark") {
			change({ ...layout, watermark: true });
			selectLayer("clipify-watermark");
			return;
		}

		const id = crypto.randomUUID(),
			label = kind === "video" ? `Video crop ${layout.layers.filter((item) => item.kind === "video").length + 1}` : kind === "title" ? "Clip info" : kind === "channel" ? "Channel info" : kind === "clipper" ? "Clipper" : "Channel logo";
		const output = compositionDimensions(layout.format),
			infoWidth = layout.format === "mobile" ? 1 : 0.65;
		const infoHeight = Math.min(0.35, overlayMetadataHeight("title", clip ?? { title: "Clip title" }, infoWidth * output.width, 32) / output.height);
		const camera = layout.layers.find((item) => item.kind === "video" && item.id === "camera");
		const frame = kind === "channel" ? { x: 0, y: layout.format === "mobile" ? Math.max(0, Math.min(0.91, (camera?.frame.y ?? 0) + (camera?.frame.h ?? 0.333) - 0.045)) : 0.83, w: layout.format === "mobile" ? 1 : 0.5, h: layout.format === "mobile" ? 0.09 : 0.12 } : kind === "title" ? { x: 0, y: 1 - infoHeight, w: infoWidth, h: infoHeight } : { x: 0.05, y: 0.05, w: 0.5, h: kind === "video" ? 0.3 : kind === "logo" ? 0.15 : 0.1 };
		const next: CompositionLayer = kind === "video" ? { id, label, kind, source: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, frame } : kind === "logo" ? { id, label, kind, frame } : { id, label, kind, fontSize: 32, frame };
		const expanded = { ...layout, layers: [...layout.layers, next] };
		change(next.kind === "video" ? updateCompositionSource(expanded, id, next.source, sourceDimensions) : expanded);
		setSelected(id);
	};
	const switchFormat = (format: ClipComposition["format"]) => {
		if (format === layout.format) return;
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		setLayout(drafts[format]);
		setSelected(drafts[format].layers[0].id);
		setBoxMode("output");
	};
	const save = async () => {
		const savingRevision = revision.current;
		setSaving(true);
		try {
			const formats = editedFormats.size ? [...editedFormats] : [layout.format];
			const pending = clipId ? [layout] : formats.map((format) => drafts[format]);
			for (const composition of pending) {
				const result = clipId ? await saveClipLayoutOverride(creatorId, entry.id, clipId, composition) : await saveClipLayoutTemplate(creatorId, { id: entry.id, name, composition, referenceClipId: reference || null });
				if (!result.ok) {
					trackProductEvent("clip_layout_save_failed", { scope: clipId ? "clip" : "template", format: layout.format });
					notify({ title: "Layout could not be saved", description: result.code === "INVALID_INPUT" ? "Check the layout name and keep every layer inside the canvas." : "Your changes are preserved. Try again.", color: "danger" });
					return;
				}
			}
			if (revision.current === savingRevision) {
				setDirty(false);
				setEditedFormats(new Set());
			}

			trackProductEvent("clip_layout_saved", { scope: clipId ? "clip" : "template", format: layout.format });
			notify({ title: clipId ? "Clip adjustments saved" : "Layout saved", color: "success" });
			onSaved();
		} catch {
			trackProductEvent("clip_layout_save_failed", { scope: clipId ? "clip" : "template", format: layout.format });
			notify({ title: "Layout could not be saved", description: "Your changes are preserved. Try again.", color: "danger" });
		} finally {
			setSaving(false);
		}
	};
	const moveLayer = (id: string, direction: number) => {
		const index = layout.layers.findIndex((item) => item.id === id),
			target = index + direction;
		if (target < 0 || target >= layout.layers.length) return;
		const layers = [...layout.layers];
		[layers[index], layers[target]] = [layers[target], layers[index]];
		change({ ...layout, layers });
	};
	return (
		<div
			data-clip-editor
			onPointerDownCapture={(event) => {
				const target = event.target as HTMLElement;
				if (!target.closest("button,input,textarea,label,a,[role=button],[role=option],[role=listbox],[role=menu],[role=dialog],[role=combobox],[role=switch],canvas,[data-clip-stage],[data-layer-row]")) selectLayer("");
			}}
		>
			<DashboardEditorLayout>
				{user ? <UpgradeModal user={user} isOpen={upgrade} onOpenChange={setUpgrade} title='Make every clip your own with Pro' description='Remove Clipify branding from your composed exports.' /> : null}
				<ControlledModal ariaLabel='Unsaved layout changes' isOpen={guard.active} onClose={() => guard.reject()}>
					<Modal.Header>
						<Modal.Heading>Leave without saving?</Modal.Heading>
					</Modal.Header>
					<Modal.Body>Your layout has unsaved changes.</Modal.Body>
					<Modal.Footer>
						<Button variant='secondary' onPress={() => guard.reject()}>
							Keep editing
						</Button>
						<Button variant='danger' onPress={() => guard.accept()}>
							Discard changes
						</Button>
					</Modal.Footer>
				</ControlledModal>
				<ControlledModal ariaLabel='Reset clip adjustments' isOpen={reset} onClose={() => setReset(false)}>
					<Modal.Header>
						<Modal.Heading>Reset clip adjustments?</Modal.Heading>
					</Modal.Header>
					<Modal.Body>This clip will use the saved global layout again.</Modal.Body>
					<Modal.Footer>
						<Button variant='secondary' onPress={() => setReset(false)}>
							Cancel
						</Button>
						<Button
							isPending={saving}
							onPress={async () => {
								setSaving(true);
								try {
									const result = await resetClipLayoutOverride(creatorId, entry.id, clipId!, layout.format);
									if (!result.ok) throw Error();
									setLayout(entry.composition);
									setDirty(false);
									setReset(false);
									notify({ title: "Clip adjustments reset", color: "success" });
								} catch {
									notify({ title: "Clip adjustments could not be reset", color: "danger" });
								} finally {
									setSaving(false);
								}
							}}
						>
							Reset adjustments
						</Button>
					</Modal.Footer>
				</ControlledModal>
				{reference && !clip && !referenceError ? (
					<Card role='status' aria-label='Loading layout editor' aria-busy='true'>
						<span className='sr-only'>Loading reference clip…</span>
						<Card.Header className='space-y-3'>
							<Skeleton className='h-8 w-48 rounded-lg' />
							<Skeleton className='h-4 w-64 rounded-lg' />
						</Card.Header>
						<Card.Content className='space-y-6'>
							<Skeleton className='h-12 rounded-lg' />
							<div className='grid gap-4 lg:grid-cols-[2fr_1fr]'>
								<Skeleton className='aspect-video rounded-xl' />
								<Skeleton className='aspect-[9/16] max-h-96 rounded-xl' />
							</div>
							<Skeleton className='h-40 rounded-xl' />
						</Card.Content>
					</Card>
				) : null}
				<Card className={`clip-composition-card ${reference && !clip && !referenceError ? "hidden" : ""}`} hidden={Boolean(reference && !clip && !referenceError)}>
					<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-4'>
						<div className='flex min-w-0 items-center gap-3'>
							<Button isIconOnly variant='tertiary' aria-label='Back to clip layouts' onPress={onBack}>
								<IconArrowLeft />
							</Button>
							<div className='min-w-0'>
								<Card.Title className='break-words'>{entry.name}</Card.Title>
								<Card.Description>
									{clipId ? "Clip-specific adjustments" : "Reusable layout"} / {layout.format === "desktop" ? "Desktop 16:9" : "Mobile 9:16"}
								</Card.Description>
							</div>
						</div>
						<div className='flex flex-wrap items-center gap-2'>
							{clipId ? (
								<Button variant='secondary' onPress={() => setReset(true)}>
									Reset to template
								</Button>
							) : null}
							<Button isPending={saving} isDisabled={!dirty || !name.trim()} onPress={() => void save()}>
								{clipId ? "Save clip adjustments" : "Save layout"}
							</Button>
						</div>
					</Card.Header>
					<Card.Content className='space-y-6'>
						{!clipId ? (
							<Tabs className='sticky top-[8.25rem] z-20 bg-surface py-2 lg:top-36' selectedKey={layout.format} onSelectionChange={(key) => switchFormat(key === "desktop" ? "desktop" : "mobile")} variant='secondary'>
								<Tabs.ListContainer>
									<Tabs.List aria-label='Layout format'>
										<Tabs.Tab id='desktop'>
											Desktop 16:9
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab id='mobile'>
											Mobile 9:16
											<Tabs.Indicator />
										</Tabs.Tab>
									</Tabs.List>
								</Tabs.ListContainer>
							</Tabs>
						) : null}
						{!clipId ? (
							<div className='grid gap-4 sm:grid-cols-2'>
								<TextField
									variant='secondary'
									value={name}
									onChange={(v) => {
										setName(v);
										revision.current++;
										setDirty(true);
									}}
									maxLength={80}
									isRequired
								>
									<Label>Layout name</Label>
									<Input />
								</TextField>
								<Autocomplete
									variant='secondary'
									placeholder='Choose a clip to preview'
									onOpenChange={setPickerOpen}
									value={reference || null}
									allowsEmptyCollection
									onChange={(key) => {
										setClip(clips.find((item) => item.id === String(key)) ?? null);
										setReferenceError(false);
										setReference(String(key ?? ""));
										if (String(key ?? "") !== reference) {
											revision.current++;
											setDirty(true);
										}
										onReferenceChange?.(String(key ?? ""));
									}}
								>
									<Label>Reference clip</Label>
									<Autocomplete.Trigger>
										<Autocomplete.Value className='min-w-0 flex-1'>
											<span className='min-w-0 flex-1 truncate'>{clip?.title || clips.find((item) => item.id === reference)?.title || "Choose a clip to preview"}</span>
										</Autocomplete.Value>
										<Autocomplete.Indicator />
									</Autocomplete.Trigger>
									<Autocomplete.Popover>
										<Autocomplete.Filter
											inputValue={search}
											onInputChange={(value) => {
												if (value === search) return;
												setLoading(true);
												setClips([]);
												setSearch(value);
											}}
											filter={() => true}
										>
											<SearchField aria-label='Find a reference clip' variant='secondary' autoFocus>
												<SearchField.Group>
													<SearchField.SearchIcon />
													<SearchField.Input placeholder='Search clip titles' />
													<SearchField.ClearButton />
												</SearchField.Group>
											</SearchField>
											<ListBox renderEmptyState={() => <EmptyState>{loading ? "Loading clips…" : "No clips found. Try another title."}</EmptyState>}>
												{[...(clip && search.trim().length < 2 && !clips.some((item) => item.id === clip.id) ? [clip] : []), ...clips].map((item) => (
													<ListBox.Item id={item.id} key={item.id} textValue={item.title || "Untitled clip"}>
														<Label className='min-w-0 flex-1 truncate'>{item.title || "Untitled clip"}</Label>
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Autocomplete.Filter>
									</Autocomplete.Popover>
								</Autocomplete>
							</div>
						) : (
							<p className='text-sm text-muted'>Changes apply only to this clip and layout. Your global template stays unchanged.</p>
						)}
						{clip ? (
							<ClipCompositionCanvas brand={brand} watermark={watermarkEnabled} onRemoveWatermark={removeWatermark} key={clip.id} creatorId={creatorId} clip={clip} layout={layout} selected={selected} onSelect={selectLayer} onChange={change} onDimensions={setSourceDimensions} />
						) : (
							<div className='rounded-xl bg-default/50 p-6 text-sm text-muted'>
								{referenceError ? (
									<div className='flex flex-wrap items-center gap-3'>
										Reference clip unavailable.
										<Button
											variant='secondary'
											onPress={() => {
												setReferenceError(false);
												setRetry((v) => v + 1);
											}}
										>
											Retry reference
										</Button>
									</div>
								) : (
									"Choose a reference clip to preview your layout. You can save a template before choosing a clip."
								)}
							</div>
						)}

						<div className='grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
							<section className='space-y-3'>
								<h3 className='text-sm font-medium'>Layers</h3>
								<div className='space-y-1' aria-label='Reorder layers'>
									{watermarkEnabled ? (
										<div className='flex items-center gap-1' data-branding-row>
											<Button variant={selected === "clipify-watermark" ? "secondary" : "ghost"} className='min-w-0 flex-1 justify-start gap-2' onPress={() => selectLayer(selected === "clipify-watermark" ? "" : "clipify-watermark")}>
												<Logo size={16} aria-hidden='true' />
												<span className='min-w-0 flex-1 truncate text-left'>Clipify Watermark</span>
												<IconLock className='size-3.5 shrink-0 text-muted' aria-hidden='true' />
											</Button>
											<Tooltip>
												<Button isIconOnly size='sm' variant='danger-soft' aria-label='Remove Clipify Watermark' onPress={removeWatermark}>
													<IconTrash className='size-4' />
												</Button>
												<Tooltip.Content>Remove watermark</Tooltip.Content>
											</Tooltip>
										</div>
									) : null}

									{[...layout.layers].reverse().map((item) => (
										<div
											draggable
											onDragStart={(event) => {
												event.dataTransfer.setData("application/x-clipify-layer", item.id);
												event.dataTransfer.effectAllowed = "move";
											}}
											onDragOver={(event) => {
												if (event.dataTransfer.types.includes("application/x-clipify-layer")) event.preventDefault();
											}}
											onDrop={(event) => {
												const id = event.dataTransfer.getData("application/x-clipify-layer");
												const moving = layout.layers.find((layer) => layer.id === id);
												if (!moving || id === item.id) return;
												event.preventDefault();
												const layers = layout.layers.filter((layer) => layer.id !== id);
												layers.splice(
													layers.findIndex((layer) => layer.id === item.id),
													0,
													moving,
												);
												change({ ...layout, layers });
												setSelected(id);
											}}
											key={item.id}
											data-layer-row
											className='flex items-center gap-1'
										>
											<Button
												fullWidth
												variant={item.id === selected ? "secondary" : "ghost"}
												className='min-w-0 flex-1 justify-start gap-2'
												onPress={() => {
													setSelected(selected === item.id ? "" : item.id);
													setBoxMode("output");
												}}
											>
												<span
													aria-hidden='true'
													className='size-2.5 shrink-0 rounded-full'
													style={{
														backgroundColor: compositionLayerColor(item.id),
													}}
												/>
												{item.label}
											</Button>
											<div className='flex items-center gap-1' aria-label='Layer order'>
												<Tooltip>
													<Button isIconOnly size='sm' aria-label={`Bring ${item.label} forward`} variant='secondary' isDisabled={layout.layers.indexOf(item) === layout.layers.length - 1} onPress={() => moveLayer(item.id, 1)}>
														<IconArrowUp className='size-4' />
													</Button>

													<Tooltip.Content>Bring forward</Tooltip.Content>
												</Tooltip>
												<Tooltip>
													<Button isIconOnly size='sm' aria-label={`Send ${item.label} backward`} variant='secondary' isDisabled={layout.layers.indexOf(item) === 0} onPress={() => moveLayer(item.id, -1)}>
														<IconArrowDown className='size-4' />
													</Button>

													<Tooltip.Content>Send backward</Tooltip.Content>
												</Tooltip>
												<Tooltip>
													<Button
														isIconOnly
														size='sm'
														aria-label={`Remove ${item.label}`}
														variant='danger-soft'
														isDisabled={layout.layers.length === 1}
														onPress={() => {
															change({ ...layout, layers: layout.layers.filter((entry) => entry.id !== item.id) });
															setSelected(layout.layers.find((entry) => entry.id !== item.id)!.id);
														}}
													>
														<IconTrash className='size-4' />
													</Button>

													<Tooltip.Content>Remove layer</Tooltip.Content>
												</Tooltip>
											</div>
										</div>
									))}
								</div>
								<Select
									variant='secondary'
									aria-label='Add layer'
									value={null}
									isDisabled={layout.layers.length >= 32 && watermarkEnabled}
									onChange={(key) => {
										if (key) add(String(key) as CompositionLayer["kind"] | "watermark");
									}}
								>
									<Select.Trigger className='items-center gap-2'>
										<IconPlus className='size-4 shrink-0' />
										<Select.Value className='flex-1 text-left'>Add crop or widget</Select.Value>
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{(layout.layers.length < 32 ? (["video", "channel", "title"] as const) : []).map((kind) => (
												<ListBox.Item key={kind} id={kind} textValue={kind}>
													<Label>{kind === "video" ? "Video crop" : kind === "channel" ? "Channel info" : "Clip info"}</Label>
												</ListBox.Item>
											))}
											{!watermarkEnabled ? (
												<ListBox.Item id='watermark' textValue='Clipify Watermark'>
													<Label>Clipify Watermark</Label>
												</ListBox.Item>
											) : null}
										</ListBox>
									</Select.Popover>
								</Select>
							</section>
							{selected === "clipify-watermark" && watermarkEnabled ? (
								<section aria-label='Branding layer' className='space-y-2'>
									<h3 className='font-medium'>Clipify Watermark</h3>
									<p className='text-sm text-muted'>Positioned automatically every 8 seconds.</p>
								</section>
							) : selected && selected !== "clipify-watermark" ? (
								<section className='space-y-4'>
									<TextField variant='secondary' value={layer.label} maxLength={80} onChange={(label) => update({ ...layer, label })}>
										<Label>Layer name</Label>
										<Input />
									</TextField>

									<div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
										{(["x", "y", "w", "h"] as const).map((key) => (
											<Numeric
												key={key}
												label={key === "x" ? "Left (%)" : key === "y" ? "Top (%)" : key === "w" ? "Width (%)" : "Height (%)"}
												value={Number((box[key] * 100).toFixed(2))}
												min={key === "w" || key === "h" ? 0.2 : 0}
												onChange={(value) => {
													let frame = { ...box };
													if (key === "x" || key === "y") frame[key] = Math.min(value / 100, 1 - frame[key === "x" ? "w" : "h"]);
													else {
														const ratio = sourceMode && layer.kind === "video" ? layer.source.w / layer.source.h : layer.kind === "logo" ? frame.w / frame.h : undefined;
														frame = resizeCompositionRect(frame, key === "w" ? value / 100 - frame.w : 0, key === "h" ? value / 100 - frame.h : 0, "se", ratio);
													}
													if (sourceMode && layer.kind === "video") change(updateCompositionSource(layout, layer.id, frame, sourceDimensions));
													else change(updateCompositionFrame(layout, layer.id, frame, sourceDimensions));
												}}
											/>
										))}
									</div>
									{layer.kind === "video" ? (
										<Select
											variant='secondary'
											aria-label='Output shape'
											value={null}
											onChange={(key) => {
												if (!key) return;
												const frame = { ...layer.frame },
													ratio = (key === "portrait" ? 9 / 16 : key === "landscape" ? 16 / 9 : 1) * (layout.format === "mobile" ? 1280 / 720 : 720 / 1280);
												frame.h = Math.min(1 - frame.y, frame.w / ratio);
												frame.w = Math.min(1 - frame.x, frame.h * ratio);
												change(updateCompositionFrame(layout, layer.id, frame, sourceDimensions));
											}}
										>
											<Label>Output shape</Label>
											<Select.Trigger>
												<Select.Value>Set output aspect ratio</Select.Value>
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													<ListBox.Item id='portrait'>Portrait 9:16</ListBox.Item>
													<ListBox.Item id='landscape'>Landscape 16:9</ListBox.Item>
													<ListBox.Item id='square'>Square 1:1</ListBox.Item>
												</ListBox>
											</Select.Popover>
										</Select>
									) : layer.kind !== "logo" ? (
										<div className='space-y-3'>
											<Numeric label='Text size' value={layer.fontSize} min={12} max={96} onChange={(fontSize) => update({ ...layer, fontSize: Math.round(fontSize) })} />
											<div className='flex flex-wrap items-center gap-2'>
												<Button variant='secondary' onPress={() => update({ ...layer, frame: { ...layer.frame, x: 0, w: 1 } })}>
													Fit canvas width
												</Button>
												<Button
													variant='secondary'
													onPress={() => {
														const output = compositionDimensions(layout.format),
															size = overlayMetadataSize(layer.kind, clip ?? { title: "Clip title" }, layer.fontSize, output.width),
															w = Math.min(1, size.width / output.width),
															h = Math.min(1, size.height / output.height);
														update({ ...layer, frame: { x: Math.min(layer.frame.x, 1 - w), y: Math.min(layer.frame.y, 1 - h), w, h } });
													}}
												>
													Fit content
												</Button>
											</div>
										</div>
									) : null}
									{layer.kind !== "video" && layer.kind !== "logo" ? (
										<section aria-label='Widget appearance' className='flex flex-col gap-3 border-t border-separator pt-4'>
											<div>
												<h3 className='font-medium'>Widget appearance</h3>
												<p className='text-sm text-muted'>Use your brand or customize this widget in this layout.</p>
											</div>
											<Switch isSelected={!layer.appearance} onChange={(inherit) => update({ ...layer, appearance: inherit ? undefined : {} })} aria-label='Use brand styling'>
												<Switch.Content>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
													Use brand styling
												</Switch.Content>
											</Switch>
											{layer.appearance ? (
												<>
													{(
														[
															["themeTextColor", "Text Color"],
															["themeBackgroundColor", "Background Color"],
															["themeAccentColor", "Accent Color"],
														] as const
													).map(([field, label]) => (
														<ThemeColorInput key={field} label={label} value={compositionWidgetTheme(layout, layer, brand)[field]} defaultValue={DEFAULT_WIDGET_THEME[field]} allowAlpha={field === "themeBackgroundColor"} onChange={(value) => update({ ...layer, appearance: { ...layer.appearance, [field]: value } })} />
													))}
													<div className='grid grid-cols-2 gap-3'>
														{(
															[
																["borderRadius", "Corner radius (px)", 80],
																["borderSize", "Border width (px)", 32],
															] as const
														).map(([field, label, max]) => (
															<Numeric key={field} label={label} value={compositionWidgetTheme(layout, layer, brand)[field]} max={max} onChange={(value) => update({ ...layer, appearance: { ...layer.appearance, [field]: value } })} />
														))}
													</div>
												</>
											) : (
												<p className='text-sm text-muted'>
													Colors and corners follow <Link href='/dashboard/settings?tab=brand'>Brand styling</Link>.
												</p>
											)}
										</section>
									) : null}
								</section>
							) : (
								<p className='text-sm text-muted'>Select a layer to edit its appearance and position.</p>
							)}
						</div>
					</Card.Content>
				</Card>
			</DashboardEditorLayout>
		</div>
	);
}
