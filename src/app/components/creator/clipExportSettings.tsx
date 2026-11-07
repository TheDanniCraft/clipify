"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Label, Modal, Skeleton, Autocomplete, SearchField, ListBox, EmptyState, Description, NumberField, FieldError, ToggleButtonGroup, ToggleButton, useFilter } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import { IconDownload, IconBrandDiscord, IconBrandYoutube, IconBrandTiktok, IconBrandInstagram, IconBrandReddit } from "@tabler/icons-react";
import { browserExportCapability, type BrowserCapability } from "@lib/clipBrowserRender";
import type { ExportEngine } from "@lib/clipBrowserExport";
import ControlledModal from "@components/controlledModal";
import { listClipLayouts } from "@actions/clipLayoutLibrary";
import { createClipExportPlan, type ClipExportPlan, type ClipExportOutput } from "@lib/clipExportPlan";
import { templateCompositions } from "@lib/clipLayoutTemplate";
import { exportPresets, exportPresetSchema, type ExportPreset } from "@lib/clipExportPreset";
import { notify } from "@lib/toast";
const icons = { general: IconDownload, discord: IconBrandDiscord, youtube: IconBrandYoutube, tiktok: IconBrandTiktok, instagram: IconBrandInstagram, reddit: IconBrandReddit };
type LayoutLibrary = Awaited<ReturnType<typeof listClipLayouts>>;
function layoutPresentation(library: LayoutLibrary | undefined) {
	if (!library) return { placeholder: "Loading templates…", description: "Loading your saved layouts…" };
	if (!library.ok) return { placeholder: "Layouts unavailable", description: "Layouts could not be loaded. Original clips are still available." };
	if (!library.templates.length) return { placeholder: "No saved templates", description: "No layout templates yet. Create one in Clip layouts for Desktop or Mobile." };
	return { placeholder: "Choose templates", description: "" };
}
function selectionDescription(capability: BrowserCapability | undefined, count: number) {
	if (capability === undefined) return "Checking browser support…";
	if (capability === "unsupported") return "Video export needs a supported browser";
	return `${count} ${count === 1 ? "clip" : "clips"} selected`;
}
function selectedPreset(destination: Exclude<ExportPreset["id"], "custom">, size: string, maxSizeMB: number) {
	if (size === "recommended") return exportPresetSchema.safeParse({ id: destination });
	return exportPresetSchema.safeParse({ id: "custom", maxSizeMB: size === "custom" ? maxSizeMB : Number(size) });
}
function canExport(validPreset: boolean, fileCount: number, needsLayout: boolean, templates: number) {
	return validPreset && fileCount > 0 && (!needsLayout || templates > 0);
}
function ExportFooter({ capability, count, disabled, onClose, onStart }: { capability: BrowserCapability | undefined; count: number; disabled: boolean; onClose: () => void; onStart: () => void }) {
	const supported = capability === "supported" || capability === "slow";
	return (
		<Modal.Footer className='flex-col items-stretch gap-3'>
			{supported ? (
				<div className='flex items-center justify-between gap-2 text-xs text-muted'>
					<p role='status' aria-label='Export file count' className='tabular-nums'>
						{count} {count === 1 ? "video file" : "video files"}
					</p>
					<p>{capability === "slow" ? "This device may take longer" : "Keep this tab open"}</p>
				</div>
			) : null}
			<div className='flex justify-end gap-3'>
				<Button variant='secondary' onPress={onClose}>
					{capability === "unsupported" ? "Close" : "Cancel"}
				</Button>
				{supported ? (
					<Button isDisabled={disabled} onPress={onStart}>
						Start export
					</Button>
				) : null}
			</div>
		</Modal.Footer>
	);
}
export default function ClipExportSettings({ creatorId, clipIds, onStart, onClose }: { creatorId: string; clipIds: string[]; onStart: (plans: ClipExportPlan[], engine: ExportEngine) => boolean; onClose: () => void }) {
	const [capability, setCapability] = useState<BrowserCapability>();
	const [probeAttempt, setProbeAttempt] = useState(0);
	const [library, setLibrary] = useState<LayoutLibrary>();
	const [versions, setVersions] = useState(new Set(["original"]));
	const [selected, setSelected] = useState<string[]>();
	const [destination, setDestination] = useState<Exclude<ExportPreset["id"], "custom">>("general");
	const [size, setSize] = useState("recommended");
	const [maxSizeMB, setMaxSizeMB] = useState(20);
	const { contains } = useFilter({ sensitivity: "base" });
	useEffect(() => {
		let active = true;
		void browserExportCapability(probeAttempt > 0)
			.then((value) => {
				if (active) setCapability(value);
			})
			.catch(() => {
				if (active) setCapability("unsupported");
			});
		return () => {
			active = false;
		};
	}, [probeAttempt]);
	useEffect(() => {
		let active = true;
		void listClipLayouts(creatorId)
			.then((data) => {
				if (!active) return;
				setLibrary(data);
				if (data.ok) setSelected((keys) => (keys ? keys.filter((id) => data.templates.some((t) => t.id === id)) : [data.defaults.desktop ?? data.defaults.mobile ?? data.templates[0]?.id].filter((id): id is string => !!id)));
			})
			.catch(() => {
				if (active) setLibrary({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			active = false;
		};
	}, [creatorId]);
	const chosen = library?.ok ? library.templates.filter((t) => selected?.includes(t.id)) : [];
	const composed = versions.has("desktop") || versions.has("mobile");
	const outputs: ClipExportOutput[] = [
		...(versions.has("original") ? [{ key: "original", label: "Original" }] : []),
		...chosen.flatMap((entry, index) =>
			(["desktop", "mobile"] as const)
				.filter((format) => versions.has(format))
				.map((format) => {
					const suffix = format === "desktop" ? "Desktop" : "Mobile";
					return { key: `layout-${index}-${format}`, label: `${entry.name.slice(0, 80 - suffix.length - 1)} ${suffix}`, layout: templateCompositions(entry)[format], templateId: entry.id, format };
				}),
		),
	];
	const preset = selectedPreset(destination, size, maxSizeMB);
	const appearance = layoutPresentation(library);
	const startExport = () => {
		try {
			if (onStart(createClipExportPlan(creatorId, clipIds, outputs, preset.success ? preset.data : undefined), "browser")) onClose();
		} catch (error) {
			notify({ title: "Export could not be queued", description: error instanceof Error && error.message.startsWith("Select ") ? error.message : "Review your clip and output selection.", color: "danger" });
		}
	};
	const templates = library?.ok ? library.templates : [];
	return (
		<ControlledModal ariaLabel='Export clips' isOpen onClose={onClose} size='lg'>
			<Modal.Header>
				<Modal.Heading>Export clips</Modal.Heading>
				<p className='min-h-5 text-sm text-muted'>{selectionDescription(capability, clipIds.length)}</p>
			</Modal.Header>
			<Modal.Body className='max-h-[60dvh] overflow-y-auto'>
				{capability === undefined ? (
					<div role='status' aria-label='Checking browser support'>
						<Skeleton className='h-96 rounded-xl' />
					</div>
				) : capability === "unsupported" ? (
					<div className='flex min-h-72 flex-col items-center justify-center gap-4 px-4 text-center'>
						<h3 className='font-semibold'>Exporting is not supported in this browser</h3>
						<p className='max-w-sm text-sm text-muted'>The video encoding features needed for export are unavailable. Try an up-to-date Chrome, Edge or Safari, or another device.</p>
						<Button
							variant='secondary'
							onPress={() => {
								setCapability(undefined);
								setProbeAttempt((n) => n + 1);
							}}
						>
							Check again
						</Button>
					</div>
				) : (
					<div className='space-y-5'>
						<section aria-label='Export versions' className='grid grid-cols-3 gap-3'>
							{(["original", "desktop", "mobile"] as const).map((version) => (
								<Checkbox
									key={version}
									variant='secondary'
									aria-label={version === "original" ? "Original" : version === "desktop" ? "Desktop" : "Mobile"}
									isSelected={versions.has(version)}
									onChange={(enabled) =>
										setVersions((keys) => {
											const next = new Set(keys);
											if (enabled) next.add(version);
											else next.delete(version);
											return next;
										})
									}
								>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<div>
											<Label>{version === "original" ? "Original" : version === "desktop" ? "Desktop" : "Mobile"}</Label>
											<p className='text-xs text-muted'>{version === "original" ? "Source" : version === "desktop" ? "16:9" : "9:16"}</p>
										</div>
									</Checkbox.Content>
								</Checkbox>
							))}
						</section>
						<Autocomplete className='min-w-0' variant='secondary' selectionMode='multiple' value={selected ?? []} onChange={(keys) => setSelected(Array.isArray(keys) ? keys.map(String) : keys ? [String(keys)] : [])} isDisabled={!composed || !templates.length} placeholder={appearance.placeholder}>
							<Label>Layout templates</Label>
							<Autocomplete.Trigger className='min-w-0'>
								<Autocomplete.Value className='min-w-0 flex-1 overflow-hidden'>
									<span className='block min-w-0 truncate'>{composed ? chosen.map((entry) => entry.name).join(", ") || "Choose templates" : "Used for Desktop and Mobile"}</span>
								</Autocomplete.Value>
								<Autocomplete.Indicator />
							</Autocomplete.Trigger>
							<Autocomplete.Popover>
								<Autocomplete.Filter filter={contains}>
									<SearchField aria-label='Search templates' variant='secondary' autoFocus>
										<SearchField.Group>
											<SearchField.SearchIcon />
											<SearchField.Input placeholder='Search templates' />
											<SearchField.ClearButton />
										</SearchField.Group>
									</SearchField>
									<ListBox renderEmptyState={() => <EmptyState>No templates found</EmptyState>}>
										{templates.map((entry) => (
											<ListBox.Item key={entry.id} id={entry.id} textValue={entry.name}>
												<Label className='min-w-0 flex-1 truncate'>{entry.name}</Label>
												<ListBox.ItemIndicator />
											</ListBox.Item>
										))}
									</ListBox>
								</Autocomplete.Filter>
							</Autocomplete.Popover>
							{appearance.description ? <Description>{appearance.description}</Description> : null}
						</Autocomplete>
						<RadioButtonGroup layout='grid' aria-label='Export for' value={destination} onChange={(value) => setDestination(value as typeof destination)} className='grid-cols-3 gap-2 sm:grid-cols-6'>
							<span aria-hidden='true' className='col-span-full text-sm font-medium'>
								Export for
							</span>
							{exportPresets
								.filter((item) => item.id !== "custom")
								.map((item) => {
									const Icon = icons[item.id as keyof typeof icons];
									return (
										<RadioButtonGroup.Item key={item.id} value={item.id} aria-label={item.label} className='flex-col justify-center gap-1 p-2'>
											<RadioButtonGroup.ItemIcon className='self-center'>
												<Icon className='size-5' aria-hidden='true' />
											</RadioButtonGroup.ItemIcon>
											<RadioButtonGroup.ItemContent className='text-center'>
												<Label className='text-xs'>{item.label}</Label>
											</RadioButtonGroup.ItemContent>
										</RadioButtonGroup.Item>
									);
								})}
						</RadioButtonGroup>
						<section aria-label='File size' className='space-y-2'>
							<Label>File size</Label>
							<ToggleButtonGroup aria-label='File size' selectionMode='single' disallowEmptySelection fullWidth selectedKeys={new Set([size])} onSelectionChange={(keys) => setSize(String([...keys][0]))}>
								{[
									["recommended", "Default"],
									["10", "10 MB"],
									["20", "20 MB"],
									["custom", "Custom"],
								].map(([id, label], index) => (
									<ToggleButton key={id} id={id}>
										{index ? <ToggleButtonGroup.Separator /> : null}
										{label}
									</ToggleButton>
								))}
							</ToggleButtonGroup>
							{size === "custom" ? (
								<NumberField
									variant='secondary'
									value={maxSizeMB}
									onChange={(value) => {
										setMaxSizeMB(value);
										setSize("custom");
									}}
									minValue={1}
									maxValue={32}
									isInvalid={!preset.success}
									className='w-full'
								>
									<Label>Custom maximum size (MB)</Label>
									<NumberField.Group>
										<NumberField.DecrementButton />
										<NumberField.Input />
										<NumberField.IncrementButton />
									</NumberField.Group>
									<FieldError>Choose a size between 1 and 32 MB.</FieldError>
								</NumberField>
							) : null}
							<p className='text-xs text-muted'>General keeps Original files untouched. Other presets or size limits re-encode them without changing the framing.</p>
						</section>
					</div>
				)}
			</Modal.Body>
			<ExportFooter capability={capability} count={clipIds.length * outputs.length} disabled={!canExport(preset.success, clipIds.length * outputs.length, composed, chosen.length)} onClose={onClose} onStart={startExport} />
		</ControlledModal>
	);
}
