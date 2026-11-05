"use client";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, TextField, NumberField, Select, ListBox, Modal, Autocomplete, SearchField, EmptyState, Tabs } from "@heroui/react";
import { IconArrowLeft, IconPlus, IconArrowUp, IconArrowDown, IconTrash } from "@tabler/icons-react";
import { useNavigationGuard } from "nextjs-nav-guard";
import { saveClipLayoutTemplate, saveClipLayoutOverride, resetClipLayoutOverride, type ClipLayoutTemplate } from "@actions/clipLayoutLibrary";
import { getCreatorClipInventory, getCreatorClipDetail, searchCreatorLibrary } from "@actions/creatorLibrary";
import { resizeCompositionRect, updateCompositionFrame, updateCompositionSource, type ClipComposition, type CompositionLayer } from "@lib/clipComposition";
import { compositionLayerColor } from "@lib/clipLayoutTemplate";
import { notify } from "@lib/toast";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import ControlledModal from "@components/controlledModal";
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
export default function ClipCompositionEditor({ creatorId, entry, initial, clipId, referenceId, onBack, onSaved, onFormatChange, onReferenceChange }: { creatorId: string; entry: ClipLayoutTemplate; initial: ClipComposition; clipId?: string; referenceId?: string; onBack: () => void; onSaved: () => void; onReferenceChange?: (id: string) => void; onFormatChange?: (format: "desktop" | "mobile") => void }) {
	const [sourceDimensions, setSourceDimensions] = useState({ width: 1920, height: 1080 }),
		[layout, setLayout] = useState(initial),
		[name, setName] = useState(entry.name),
		[dirty, setDirty] = useState(false),
		[saving, setSaving] = useState(false),
		[selected, setSelected] = useState(initial.layers[0].id),
		[boxMode, setBoxMode] = useState("output"),
		[clip, setClip] = useState<Clip | null>(null),
		[reference, setReference] = useState(clipId ?? referenceId ?? ""),
		[clips, setClips] = useState<Clip[]>([]),
		[search, setSearch] = useState(""),
		[loading, setLoading] = useState(true),
		[retry, setRetry] = useState(0),
		[reset, setReset] = useState(false);
	const guard = useNavigationGuard({ enabled: dirty });
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	useEffect(() => {
		let active = true;
		const timer = setTimeout(() => {
			const request = search.trim().length >= 2 ? searchCreatorLibrary({ creatorId, title: search }) : getCreatorClipInventory({ creatorId, query: { pageSize: 10 } });
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
	}, [creatorId, search]);
	useEffect(() => {
		let active = true;
		if (reference)
			void getCreatorClipDetail({ creatorId, clipId: reference })
				.then((result) => {
					if (active) {
						if (result.ok) setClip(result.clip);
						else notify({ title: "Reference clip unavailable", description: "Choose another clip or retry.", color: "danger" });
					}
				})
				.catch(() => {
					if (active) notify({ title: "Reference clip could not be loaded", color: "danger" });
				});
		return () => {
			active = false;
		};
	}, [creatorId, reference, retry]);
	const change = (next: ClipComposition) => {
		setLayout(next);
		setDirty(true);
	};
	const layer = layout.layers.find((item) => item.id === selected) ?? layout.layers[0];
	const sourceMode = layer.kind === "video" && boxMode === "source";
	const box = sourceMode ? layer.source : layer.frame;
	const update = (next: CompositionLayer) => change({ ...layout, layers: layout.layers.map((item) => (item.id === layer.id ? next : item)) });
	const add = (kind: CompositionLayer["kind"]) => {
		const id = crypto.randomUUID(),
			label = kind === "video" ? `Video crop ${layout.layers.filter((item) => item.kind === "video").length + 1}` : kind === "title" ? "Clip title" : kind === "channel" ? "Channel name" : kind === "clipper" ? "Clipper" : "Channel logo";
		const camera = layout.layers.find((item) => item.kind === "video" && item.id === "camera");
		const frame = kind === "channel" ? { x: 0.05, y: layout.format === "mobile" ? Math.max(0, Math.min(0.93, (camera?.frame.y ?? 0) + (camera?.frame.h ?? 0.333) - 0.035)) : 0.85, w: layout.format === "mobile" ? 0.9 : 0.5, h: layout.format === "mobile" ? 0.07 : 0.1 } : { x: 0.05, y: 0.05, w: 0.5, h: kind === "video" ? 0.3 : kind === "logo" ? 0.15 : 0.1 };
		const next: CompositionLayer = kind === "video" ? { id, label, kind, source: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, frame } : kind === "logo" ? { id, label, kind, frame } : { id, label, kind, fontSize: 32, frame };
		const expanded = { ...layout, layers: [...layout.layers, next] };
		change(next.kind === "video" ? updateCompositionSource(expanded, id, next.source, sourceDimensions) : expanded);
		setSelected(id);
	};
	const save = async () => {
		setSaving(true);
		try {
			const result = clipId ? await saveClipLayoutOverride(creatorId, entry.id, clipId, layout) : await saveClipLayoutTemplate(creatorId, { id: entry.id, name, composition: layout });
			if (!result.ok) {
				notify({ title: "Layout could not be saved", description: result.code === "INVALID_INPUT" ? "Check the layout name and keep every layer inside the canvas." : "Your changes are preserved. Try again.", color: "danger" });
				return;
			}
			setDirty(false);
			notify({ title: clipId ? "Clip adjustments saved" : "Layout saved", color: "success" });
			onSaved();
		} catch {
			notify({ title: "Layout could not be saved", description: "Your changes are preserved. Try again.", color: "danger" });
		} finally {
			setSaving(false);
		}
	};
	const moveLayer = (direction: number) => {
		const index = layout.layers.indexOf(layer),
			target = index + direction;
		if (target < 0 || target >= layout.layers.length) return;
		const layers = [...layout.layers];
		[layers[index], layers[target]] = [layers[target], layers[index]];
		change({ ...layout, layers });
	};
	return (
		<DashboardEditorLayout>
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
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-start justify-between gap-4'>
					<div className='flex min-w-0 items-start gap-3'>
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
					<div className='flex flex-wrap gap-2'>
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
					{onFormatChange ? (
						<Tabs selectedKey={layout.format} onSelectionChange={(key) => onFormatChange(key === "desktop" ? "desktop" : "mobile")} variant='secondary'>
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
								value={reference || null}
								allowsEmptyCollection
								onChange={(key) => {
									setClip(null);
									setReference(String(key ?? ""));
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
											setLoading(true);
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
						<ClipCompositionCanvas key={clip.id} creatorId={creatorId} clip={clip} layout={layout} selected={layer.id} onSelect={setSelected} onChange={change} onDimensions={setSourceDimensions} />
					) : (
						<div className='rounded-xl bg-default/50 p-6 text-sm text-muted'>
							{reference ? (
								<div className='flex flex-wrap items-center gap-3'>
									Reference clip unavailable.
									<Button variant='secondary' onPress={() => setRetry((v) => v + 1)}>
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
							<div className='space-y-1'>
								{[...layout.layers].reverse().map((item) => (
									<Button key={item.id} fullWidth variant={item.id === layer.id ? "secondary" : "ghost"} className='justify-start gap-2' onPress={() => setSelected(item.id)}>
										<span
											aria-hidden='true'
											className='size-2.5 shrink-0 rounded-full'
											style={{
												backgroundColor: compositionLayerColor(item.id),
											}}
										/>
										{item.label}
									</Button>
								))}
							</div>
							<Select
								variant='secondary'
								aria-label='Add layer'
								value={null}
								isDisabled={layout.layers.length >= 32}
								onChange={(key) => {
									if (key) add(String(key) as CompositionLayer["kind"]);
								}}
							>
								<Select.Trigger className='items-center gap-2'>
									<IconPlus className='size-4 shrink-0' />
									<Select.Value className='flex-1 text-left'>Add crop or widget</Select.Value>
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										{(["video", "channel", "logo", "title", "clipper"] as const).map((kind) => (
											<ListBox.Item key={kind} id={kind} textValue={kind}>
												<Label>{kind === "video" ? "Video crop" : kind === "channel" ? "Channel name" : kind === "logo" ? "Channel logo" : kind === "title" ? "Clip title" : "Clipper"}</Label>
											</ListBox.Item>
										))}
									</ListBox>
								</Select.Popover>
							</Select>
						</section>
						<section className='space-y-4'>
							<TextField variant='secondary' value={layer.label} maxLength={80} onChange={(label) => update({ ...layer, label })}>
								<Label>Layer name</Label>
								<Input />
							</TextField>
							{layer.kind === "video" ? (
								<Select variant='secondary' value={boxMode} onChange={(key) => setBoxMode(String(key ?? "output"))}>
									<Label>Edit box</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											<ListBox.Item id='source'>Source crop</ListBox.Item>
											<ListBox.Item id='output'>Output layer</ListBox.Item>
										</ListBox>
									</Select.Popover>
								</Select>
							) : null}
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
								<Numeric label='Text size' value={layer.fontSize} min={12} max={96} onChange={(fontSize) => update({ ...layer, fontSize: Math.round(fontSize) })} />
							) : null}
							<div className='flex flex-wrap gap-2'>
								<Button variant='secondary' isDisabled={layout.layers.indexOf(layer) === layout.layers.length - 1} onPress={() => moveLayer(1)}>
									<IconArrowUp className='size-4' />
									Bring forward
								</Button>
								<Button variant='secondary' isDisabled={layout.layers.indexOf(layer) === 0} onPress={() => moveLayer(-1)}>
									<IconArrowDown className='size-4' />
									Send backward
								</Button>
								<Button
									variant='danger-soft'
									isDisabled={layout.layers.length === 1}
									onPress={() => {
										change({ ...layout, layers: layout.layers.filter((item) => item.id !== layer.id) });
										setSelected(layout.layers.find((item) => item.id !== layer.id)!.id);
									}}
								>
									<IconTrash className='size-4' />
									Remove layer
								</Button>
							</div>
						</section>
					</div>
				</Card.Content>
			</Card>
		</DashboardEditorLayout>
	);
}
