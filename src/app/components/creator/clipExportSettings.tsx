"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Label, Modal, Select, Autocomplete, SearchField, ListBox, EmptyState, Description, NumberField, FieldError, ToggleButtonGroup, ToggleButton, useFilter } from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
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
function selectedPreset(destination: Exclude<ExportPreset["id"], "custom">, size: string, maxSizeMB: number) {
	if (destination !== "discord") return exportPresetSchema.safeParse({ id: destination });
	if (size === "custom") return exportPresetSchema.safeParse({ id: "custom", maxSizeMB });
	return exportPresetSchema.safeParse({ id: "discord", tier: size });
}
function canExport(validPreset: boolean, fileCount: number, needsLayout: boolean, templates: number) {
	return validPreset && fileCount > 0 && (!needsLayout || templates > 0);
}
function ExportFooter({ step, capability, count, disabled, onClose, onStart, onStep }: { step: number; capability: BrowserCapability | undefined; count: number; disabled: boolean; onClose: () => void; onStart: () => void; onStep: (step: number) => void }) {
	return (
		<Modal.Footer className='flex-col items-stretch gap-3'>
			<div className='flex items-center justify-between gap-2 text-xs text-muted'>
				<p role='status' aria-label='Export file count' className='tabular-nums'>
					{count} {count === 1 ? "video file" : "video files"}
				</p>
				<p>{capability === "slow" ? "This device may take longer" : "Keep this tab open"}</p>
			</div>
			<div className='flex justify-end gap-3'>
				{step === 1 ? (
					<Button variant='ghost' className='mr-auto' onPress={() => onStep(0)}>
						Back
					</Button>
				) : null}
				<Button variant='secondary' onPress={onClose}>
					Cancel
				</Button>
				{step === 0 ? (
					<Button isDisabled={disabled} onPress={() => onStep(1)}>
						Next
					</Button>
				) : (
					<Button isDisabled={disabled} onPress={onStart}>
						Start export
					</Button>
				)}
			</div>
		</Modal.Footer>
	);
}
export default function ClipExportSettings({ creatorId, clipIds, onStart, onClose }: { creatorId: string; clipIds: string[]; onStart: (plans: ClipExportPlan[], engine: ExportEngine) => boolean; onClose: () => void }) {
	const [step, setStep] = useState(0);
	const [capability, setCapability] = useState<BrowserCapability>();
	const [probeAttempt, setProbeAttempt] = useState(0);
	const [library, setLibrary] = useState<LayoutLibrary>();
	const [versions, setVersions] = useState(new Set(["original"]));
	const [selected, setSelected] = useState<string[]>();
	const [destination, setDestination] = useState<Exclude<ExportPreset["id"], "custom">>("general");
	const [size, setSize] = useState("free");
	const [maxSizeMB, setMaxSizeMB] = useState(20);
	const composed = versions.has("desktop") || versions.has("mobile");
	const converting = composed || destination !== "general";
	const { contains } = useFilter({ sensitivity: "base" });
	useEffect(() => {
		if (!converting) return;
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
	}, [probeAttempt, converting]);
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
	const blocked = converting && capability !== "supported" && capability !== "slow";
	const startExport = () => {
		try {
			if (onStart(createClipExportPlan(creatorId, clipIds, outputs, preset.success ? preset.data : undefined), "browser")) onClose();
		} catch (error) {
			notify({ title: "Export could not be queued", description: error instanceof Error && error.message.startsWith("Select ") ? error.message : "Review your clip and output selection.", color: "danger" });
		}
	};
	const templates = library?.ok ? library.templates : [];
	const DestinationIcon = icons[destination];
	return (
		<ControlledModal ariaLabel='Export clips' isOpen onClose={onClose} size='lg'>
			<Modal.Header>
				<Modal.Heading>Export clips</Modal.Heading>
				<p className='min-h-5 text-sm text-muted'>
					{clipIds.length} {clipIds.length === 1 ? "clip" : "clips"} selected
				</p>
			</Modal.Header>
			<Modal.Body className='max-h-[60dvh] overflow-y-auto'>
				<Stepper currentStep={step} size='sm' className='mb-5' aria-label='Export steps'>
					{["Versions", "Destination"].map((title) => (
						<Stepper.Step key={title}>
							<Stepper.Indicator />
							<Stepper.Content>
								<Stepper.Title>{title}</Stepper.Title>
							</Stepper.Content>
							<Stepper.Separator />
						</Stepper.Step>
					))}
				</Stepper>
				<div>
					{step === 0 ? (
						<div className='space-y-5'>
							<section aria-label='Export versions' className='grid gap-2'>
								{(["original", "desktop", "mobile"] as const).map((version) => (
									<Checkbox
										key={version}
										autoFocus={version === "original"}
										variant='secondary'
										className='w-full rounded-xl border border-border p-3'
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
												<p className='text-xs text-muted'>{version === "original" ? "Full source frame" : version === "desktop" ? "Landscape composition, 16:9" : "Portrait composition, 9:16"}</p>
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
						</div>
					) : (
						<div className='space-y-5'>
							<Select autoFocus variant='secondary' value={destination} onChange={(value) => setDestination(value as typeof destination)}>
								<Label>Export for</Label>
								<Select.Trigger>
									<Select.Value>
										<span className='flex items-center gap-2'>
											<DestinationIcon className='size-5 shrink-0' aria-hidden='true' />
											{exportPresets.find((item) => item.id === destination)?.label}
										</span>
									</Select.Value>
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										{exportPresets
											.filter((item) => item.id !== "custom")
											.map((item) => {
												const Icon = icons[item.id as keyof typeof icons];
												return (
													<ListBox.Item key={item.id} id={item.id} textValue={item.label}>
														<Icon className='size-5 shrink-0' aria-hidden='true' />
														<Label>{item.label}</Label>
														<ListBox.ItemIndicator />
													</ListBox.Item>
												);
											})}
									</ListBox>
								</Select.Popover>
							</Select>
							{destination === "discord" ? (
								<section aria-label='Discord upload allowance' className='space-y-2'>
									<Label>Discord account</Label>
									<ToggleButtonGroup aria-label='Discord account' selectionMode='single' disallowEmptySelection fullWidth selectedKeys={new Set([size])} onSelectionChange={(keys) => setSize(String([...keys][0]))}>
										{[
											["free", "Free"],
											["basic", "Nitro Basic"],
											["nitro", "Nitro"],
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
									<p className='text-xs text-muted'>{size === "free" ? "Up to 20 MB per video." : size === "basic" ? "Within Nitro Basic’s 50 MB upload allowance." : size === "nitro" ? "Within Nitro’s 1 GB upload allowance." : "Each video stays within your chosen size."}</p>
								</section>
							) : (
								<p className='text-sm text-muted'>{destination === "general" ? "Original clips stay untouched. Desktop and Mobile use your selected layouts." : exportPresets.find((item) => item.id === destination)?.description}</p>
							)}
							{converting && capability === undefined ? (
								<p role='status' className='text-sm text-muted'>
									Checking video conversion support…
								</p>
							) : null}
							{converting && capability === "unsupported" ? (
								<div role='status' className='space-y-3 rounded-xl bg-surface-secondary p-4'>
									<h3 className='text-sm font-semibold'>Video conversion is not supported in this browser</h3>
									<p className='text-sm text-muted'>Try an up-to-date Chrome, Edge or Safari, or another device. You can still download Original clips with General selected.</p>
									<Button
										variant='secondary'
										size='sm'
										onPress={() => {
											setCapability(undefined);
											setProbeAttempt((n) => n + 1);
										}}
									>
										Check again
									</Button>
								</div>
							) : null}
						</div>
					)}
				</div>
			</Modal.Body>
			<ExportFooter step={step} onStep={setStep} capability={converting ? capability : "supported"} count={clipIds.length * outputs.length} disabled={(step === 1 && blocked) || !canExport(step === 0 || preset.success, clipIds.length * outputs.length, composed, chosen.length)} onClose={onClose} onStart={startExport} />
		</ControlledModal>
	);
}
