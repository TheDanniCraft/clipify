"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Label, Link, Modal, Skeleton } from "@heroui/react";
import { IconRefresh, IconLayoutGrid, IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react";
import ControlledModal from "@components/controlledModal";
import { listClipLayouts, type ClipLayoutTemplate } from "@actions/clipLayoutLibrary";
import { createClipExportPlan, type ClipExportPlan, type ClipExportOutput } from "@lib/clipExportPlan";
import { notify } from "@lib/toast";
const original = "original:source";
export default function ClipExportSettings({ creatorId, clipIds, onStart, onClose }: { creatorId: string; clipIds: string[]; onStart: (plans: ClipExportPlan[]) => boolean; onClose: () => void }) {
	const [library, setLibrary] = useState<Awaited<ReturnType<typeof listClipLayouts>>>(),
		[attempt, setAttempt] = useState(0),
		[selected, setSelected] = useState(new Set([original]));
	useEffect(() => {
		let current = true;
		void listClipLayouts(creatorId)
			.then((data) => {
				if (!current) return;
				setLibrary(data);
				if (data.ok) setSelected((keys) => new Set([...keys].filter((key) => key === original || data.templates.some((entry) => entry.id === key))));
			})
			.catch(() => {
				if (current) setLibrary({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			current = false;
		};
	}, [creatorId, attempt]);
	const choose = (key: string, enabled: boolean) =>
		setSelected((keys) => {
			const next = new Set(keys);
			if (enabled) next.add(key);
			else next.delete(key);
			return next;
		});
	const ordered = library?.ok ? (["desktop", "mobile"] as const).flatMap((format) => library.templates.filter((entry) => entry.composition.format === format)) : [];
	const chosen = ordered.filter((entry) => selected.has(entry.id));
	const outputs: ClipExportOutput[] = [...(selected.has(original) ? [{ key: "original", label: "Original" }] : []), ...chosen.map((entry, index) => ({ key: `layout-${index}`, label: entry.name, layout: entry.composition, templateId: entry.id }))];
	const renderTemplate = (entry: ClipLayoutTemplate) => {
		const label = entry.composition.format === "desktop" ? "Desktop" : "Mobile";
		const cropCount = entry.composition.layers.filter((layer) => layer.kind === "video").length,
			widgetCount = entry.composition.layers.length - cropCount;
		return (
			<div key={entry.id} className='flex items-start justify-between gap-3'>
				<Checkbox variant='secondary' aria-label={`${label}: ${entry.name}`} isSelected={selected.has(entry.id)} onChange={(enabled) => choose(entry.id, enabled)}>
					<Checkbox.Content>
						<Checkbox.Control>
							<Checkbox.Indicator />
						</Checkbox.Control>
						<div>
							<Label>{entry.name}</Label>
							<p className='text-xs text-muted'>
								{cropCount} {cropCount === 1 ? "crop" : "crops"}, {widgetCount} {widgetCount === 1 ? "widget" : "widgets"}
								{library?.ok && library.defaults[entry.composition.format] === entry.id ? " (default)" : ""}
							</p>
						</div>
					</Checkbox.Content>
				</Checkbox>
				{clipIds.length === 1 ? (
					<Link className='shrink-0 text-xs' href={`/dashboard/clip-layouts?layout=${encodeURIComponent(entry.id)}&clip=${encodeURIComponent(clipIds[0])}`} target='_blank' rel='noopener noreferrer' aria-label={`Adjust ${entry.name} for this clip (opens in a new tab)`}>
						Adjust clip
					</Link>
				) : null}
			</div>
		);
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
				<section aria-label='Original output'>
					<Checkbox variant='secondary' aria-label='Original' isSelected={selected.has(original)} onChange={(enabled) => choose(original, enabled)}>
						<Checkbox.Content>
							<Checkbox.Control>
								<Checkbox.Indicator />
							</Checkbox.Control>
							<div>
								<Label>Original</Label>
								<p className='text-xs text-muted'>The untouched source clip</p>
							</div>
						</Checkbox.Content>
					</Checkbox>
				</section>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<Link className='gap-2 text-sm' href={`/dashboard/clip-layouts?reference=${encodeURIComponent(clipIds[0] ?? "")}`} target='_blank' rel='noopener noreferrer'>
						<IconLayoutGrid className='size-4' aria-hidden='true' />
						Manage layouts
					</Link>
					<Button
						size='sm'
						variant='ghost'
						className='gap-2'
						onPress={() => {
							setLibrary(undefined);
							setAttempt((value) => value + 1);
						}}
					>
						<IconRefresh className='size-4' aria-hidden='true' />
						Refresh layouts
					</Button>
				</div>
				{library?.ok ? (
					(["desktop", "mobile"] as const).map((format) => {
						const entries = library.templates.filter((entry) => entry.composition.format === format),
							label = format === "desktop" ? "Desktop" : "Mobile",
							Icon = format === "desktop" ? IconDeviceDesktop : IconDeviceMobile;
						return (
							<section key={format} aria-label={`${label} layouts`} className='space-y-3'>
								<h3 className='flex items-center gap-2 text-sm font-medium'>
									<Icon className='size-4' aria-hidden='true' />
									{label} <span className='text-muted'>{format === "desktop" ? "16:9" : "9:16"}</span>
								</h3>
								{entries.length ? (
									entries.map(renderTemplate)
								) : (
									<div className='space-y-2'>
										<p className='text-sm text-muted'>No {label.toLowerCase()} layouts yet.</p>
										<Link href={`/dashboard/clip-layouts?new=${format}&reference=${encodeURIComponent(clipIds[0] ?? "")}`} target='_blank' rel='noopener noreferrer'>
											Create {label} layout
										</Link>
									</div>
								)}
							</section>
						);
					})
				) : library ? (
					<div className='space-y-3'>
						<p role='status' className='text-sm text-muted'>
							Layouts could not be loaded. You can still export the original clips.
						</p>
						<Button
							variant='secondary'
							onPress={() => {
								setLibrary(undefined);
								setAttempt((value) => value + 1);
							}}
						>
							Retry layouts
						</Button>
					</div>
				) : (
					<Skeleton className='h-24 rounded-xl' />
				)}
				<p className='text-xs text-muted'>Each selected version creates a separate video. Saved clip adjustments are applied automatically.</p>
			</Modal.Body>
			<Modal.Footer className='flex-wrap'>
				<p role='status' aria-label='Export file count' className='mr-auto text-sm text-muted'>
					{clipIds.length * outputs.length} {clipIds.length * outputs.length === 1 ? "video file" : "video files"}
				</p>
				<Button variant='secondary' onPress={onClose}>
					Cancel
				</Button>
				<Button
					isDisabled={!outputs.length}
					onPress={() => {
						try {
							const plans = createClipExportPlan(creatorId, clipIds, outputs);
							if (onStart(plans)) onClose();
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
