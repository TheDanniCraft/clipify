"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Label, Link, Modal, Skeleton, Autocomplete, SearchField, ListBox, EmptyState, useFilter } from "@heroui/react";
import { IconRefresh, IconLayoutCollage } from "@tabler/icons-react";
import ControlledModal from "@components/controlledModal";
import { listClipLayouts } from "@actions/clipLayoutLibrary";
import { createClipExportPlan, type ClipExportPlan, type ClipExportOutput } from "@lib/clipExportPlan";
import { templateCompositions } from "@lib/clipLayoutTemplate";
import { notify } from "@lib/toast";
export default function ClipExportSettings({ creatorId, clipIds, onStart, onClose }: { creatorId: string; clipIds: string[]; onStart: (plans: ClipExportPlan[]) => boolean; onClose: () => void }) {
	const [library, setLibrary] = useState<Awaited<ReturnType<typeof listClipLayouts>>>(),
		[attempt, setAttempt] = useState(0),
		[versions, setVersions] = useState(new Set(["original"])),
		[selected, setSelected] = useState<string[]>();
	const { contains } = useFilter({ sensitivity: "base" });
	useEffect(() => {
		let current = true;
		void listClipLayouts(creatorId)
			.then((data) => {
				if (!current) return;
				setLibrary(data);
				if (data.ok)
					setSelected((keys) => {
						return keys ? keys.filter((id) => data.templates.some((t) => t.id === id)) : [data.defaults.desktop ?? data.defaults.mobile ?? data.templates[0]?.id].filter((id): id is string => !!id);
					});
			})
			.catch(() => {
				if (current) setLibrary({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			current = false;
		};
	}, [creatorId, attempt]);
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
	const refresh = () => {
		setLibrary(undefined);
		setAttempt((n) => n + 1);
	};
	return (
		<ControlledModal ariaLabel='Export clips' isOpen onClose={onClose} size='lg'>
			<Modal.Header>
				<Modal.Heading>Export clips</Modal.Heading>
				<p className='text-sm text-muted'>
					{clipIds.length} {clipIds.length === 1 ? "clip" : "clips"} selected. Choose the versions to download.
				</p>
			</Modal.Header>
			<Modal.Body className='max-h-[60dvh] space-y-6 overflow-y-auto'>
				<section aria-label='Export versions' className='space-y-3'>
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
									<Label>{version === "original" ? "Original" : version === "desktop" ? "Desktop 16:9" : "Mobile 9:16"}</Label>
									<p className='text-xs text-muted'>{version === "original" ? "The untouched source clip" : version === "desktop" ? "Landscape composition from your template" : "Portrait composition from the same template"}</p>
								</div>
							</Checkbox.Content>
						</Checkbox>
					))}
				</section>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<Link className='gap-2 text-sm' href={`/dashboard/clip-layouts?reference=${encodeURIComponent(clipIds[0] ?? "")}`} target='_blank' rel='noopener noreferrer'>
						<IconLayoutCollage className='size-4' />
						Manage layouts
					</Link>
					<Button size='sm' variant='ghost' className='gap-2' onPress={refresh}>
						<IconRefresh className='size-4' />
						Refresh layouts
					</Button>
				</div>
				{library?.ok ? (
					library.templates.length ? (
						<div className='space-y-3'>
							<Autocomplete className='min-w-0' variant='secondary' selectionMode='multiple' value={selected ?? []} onChange={(keys) => setSelected(Array.isArray(keys) ? keys.map(String) : keys ? [String(keys)] : [])} placeholder='Choose templates'>
								<Label>Layout templates</Label>
								<Autocomplete.Trigger className='min-w-0'>
									<Autocomplete.Value className='min-w-0 flex-1 overflow-hidden'>
										<span className='block min-w-0 truncate'>{chosen.map((entry) => entry.name).join(", ") || "Choose templates"}</span>
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
											{library.templates.map((entry) => (
												<ListBox.Item key={entry.id} id={entry.id} textValue={entry.name}>
													<Label className='min-w-0 flex-1 truncate'>{entry.name}</Label>
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Autocomplete.Filter>
								</Autocomplete.Popover>
							</Autocomplete>
							<p className='text-xs text-muted'>Desktop and Mobile both use the selected templates.</p>
							{clipIds.length === 1
								? chosen.map((entry) => (
										<div key={entry.id} className='flex flex-wrap items-center gap-x-4 gap-y-2 text-xs'>
											<span className='min-w-0 max-w-full break-words text-muted'>{entry.name}</span>
											{(["desktop", "mobile"] as const).map((format) => (
												<Link key={format} href={`/dashboard/clip-layouts?layout=${encodeURIComponent(entry.id)}&clip=${encodeURIComponent(clipIds[0])}&format=${format}`} target='_blank' rel='noopener noreferrer'>
													Adjust {format === "desktop" ? "Desktop" : "Mobile"} for this clip
												</Link>
											))}
										</div>
									))
								: null}
						</div>
					) : (
						<div className='space-y-2'>
							<p className='text-sm text-muted'>No layout templates yet. Create one for Desktop and Mobile.</p>
							<Link href={`/dashboard/clip-layouts?new=mobile&reference=${encodeURIComponent(clipIds[0] ?? "")}`} target='_blank' rel='noopener noreferrer'>
								Create layout template
							</Link>
						</div>
					)
				) : library ? (
					<div className='space-y-3'>
						<p role='status' className='text-sm text-muted'>
							Layouts could not be loaded. You can still export the original clips.
						</p>
						<Button variant='secondary' onPress={refresh}>
							Retry layouts
						</Button>
					</div>
				) : (
					<Skeleton className='h-24 rounded-xl' />
				)}
				<p className='text-xs text-muted'>Each selected version creates a separate video. Clip-specific adjustments are applied automatically.</p>
			</Modal.Body>
			<Modal.Footer className='flex-wrap'>
				<p role='status' aria-label='Export file count' className='mr-auto text-sm text-muted'>
					{clipIds.length * outputs.length} {clipIds.length * outputs.length === 1 ? "video file" : "video files"}
				</p>
				<Button variant='secondary' onPress={onClose}>
					Cancel
				</Button>
				<Button
					isDisabled={!outputs.length || ((versions.has("desktop") || versions.has("mobile")) && !chosen.length)}
					onPress={() => {
						try {
							if (onStart(createClipExportPlan(creatorId, clipIds, outputs))) onClose();
						} catch (error) {
							notify({ title: "Export could not be queued", description: error instanceof Error && error.message.startsWith("Select ") ? error.message : "Review your clip and output selection.", color: "danger" });
						}
					}}
				>
					Start export
				</Button>
			</Modal.Footer>
		</ControlledModal>
	);
}
