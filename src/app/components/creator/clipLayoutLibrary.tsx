"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, TextField, Select, ListBox, Modal, Skeleton, Chip } from "@heroui/react";
import { IconPlus, IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react";
import { listClipLayouts, saveClipLayoutTemplate, setDefaultClipLayout, deleteClipLayoutTemplate, loadClipLayoutOverride, type ClipLayoutTemplate } from "@actions/clipLayoutLibrary";
import { createClipComposition, type ClipComposition } from "@lib/clipComposition";
import { notify } from "@lib/toast";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import ControlledModal from "@components/controlledModal";
import ClipCompositionEditor from "./clipCompositionEditor";
export default function ClipLayoutLibrary({ creatorId, layoutId, clipId, referenceId, newFormat }: { creatorId: string; layoutId?: string; clipId?: string; referenceId?: string; newFormat?: string }) {
	const router = useRouter();
	const [library, setLibrary] = useState<Awaited<ReturnType<typeof listClipLayouts>>>(),
		[attempt, setAttempt] = useState(0),
		[create, setCreate] = useState(newFormat === "desktop" || newFormat === "mobile"),
		[name, setName] = useState(""),
		[format, setFormat] = useState<"desktop" | "mobile">(newFormat === "desktop" ? "desktop" : "mobile"),
		[busy, setBusy] = useState(false),
		[remove, setRemove] = useState<ClipLayoutTemplate | null>(null),
		[override, setOverride] = useState<{ scope: string; composition: ClipComposition | null; error: boolean } | null>(null);
	const entry = library?.ok ? library.templates.find((item) => item.id === layoutId) : undefined;
	const scope = `${layoutId}:${clipId}:${attempt}`;
	const initial = clipId ? (override?.scope === scope ? override.composition : null) : entry?.composition;
	const overrideError = clipId && override?.scope === scope && override.error;
	useEffect(() => {
		let active = true;
		void listClipLayouts(creatorId)
			.then((result) => {
				if (active) setLibrary(result);
			})
			.catch(() => {
				if (active) setLibrary({ ok: false, code: "SERVICE_UNAVAILABLE" });
			});
		return () => {
			active = false;
		};
	}, [creatorId, attempt]);
	useEffect(() => {
		let active = true;
		if (!entry || !clipId) return;
		void loadClipLayoutOverride(creatorId, entry.id, clipId)
			.then((result) => {
				if (!active) return;
				setOverride({ scope, composition: result.ok ? (result.composition ?? entry.composition) : null, error: !result.ok });
			})
			.catch(() => {
				if (active) setOverride({ scope, composition: null, error: true });
			});
		return () => {
			active = false;
		};
	}, [creatorId, entry, clipId, scope]);
	const path = (id: string) => `/dashboard/clip-layouts?layout=${encodeURIComponent(id)}${clipId ? `&clip=${encodeURIComponent(clipId)}` : referenceId ? `&reference=${encodeURIComponent(referenceId)}` : ""}`;
	const error = () => notify({ title: "Layout could not be updated", description: "Your changes are preserved. Try again.", color: "danger" });
	if (entry && initial) return <ClipCompositionEditor key={`${entry.id}:${clipId ?? ""}`} creatorId={creatorId} entry={entry} initial={initial} clipId={clipId} referenceId={referenceId} onBack={() => router.push("/dashboard/clip-layouts")} onSaved={() => setAttempt((n) => n + 1)} />;
	return (
		<DashboardEditorLayout>
			<Card>
				<Card.Header className='flex flex-row flex-wrap justify-between gap-4'>
					<div>
						<Card.Title>Clip layouts</Card.Title>
						<Card.Description>Reusable compositions for Desktop and Mobile exports.</Card.Description>
					</div>
					<Button onPress={() => setCreate(true)}>
						<IconPlus className='size-4' />
						Create layout
					</Button>
				</Card.Header>
				<Card.Content className='space-y-4'>
					{!library || (entry && !initial && !overrideError) ? (
						<Skeleton className='h-40 rounded-xl' />
					) : !library.ok || overrideError ? (
						<div className='space-y-3'>
							<p className='text-sm text-muted'>Layouts could not be loaded.</p>
							<Button variant='secondary' onPress={() => setAttempt((n) => n + 1)}>
								Retry layouts
							</Button>
						</div>
					) : (
						<>
							{layoutId && !entry ? <p className='text-sm text-muted'>This layout is no longer available. Choose another layout.</p> : null}
							{library.templates.length ? (
								(["desktop", "mobile"] as const).map((kind) => (
									<section key={kind} className='space-y-3'>
										<h3 className='text-sm font-medium'>{kind === "desktop" ? "Desktop 16:9" : "Mobile 9:16"}</h3>
										{library.templates
											.filter((item) => item.composition.format === kind)
											.map((item) => (
												<div key={item.id} className='flex flex-wrap items-center justify-between gap-3 rounded-xl bg-default/40 p-4'>
													<div className='flex min-w-0 items-center gap-3'>
														{kind === "desktop" ? <IconDeviceDesktop className='size-5 shrink-0 text-muted' /> : <IconDeviceMobile className='size-5 shrink-0 text-muted' />}
														<div>
															<p className='break-words font-medium'>{item.name}</p>
															<p className='text-xs text-muted'>{item.composition.layers.length} layers</p>
														</div>
														{library.defaults[kind] === item.id ? <Chip size='sm'>Default</Chip> : null}
													</div>
													<div className='flex flex-wrap gap-2'>
														<Button variant='secondary' onPress={() => router.push(path(item.id))}>
															{clipId ? "Adjust clip" : "Edit layout"}
														</Button>
														{!clipId && library.defaults[kind] !== item.id ? (
															<Button
																variant='ghost'
																isDisabled={busy}
																onPress={async () => {
																	setBusy(true);
																	try {
																		const r = await setDefaultClipLayout(creatorId, item.id);
																		if (!r.ok) error();
																		else setAttempt((n) => n + 1);
																	} catch {
																		error();
																	} finally {
																		setBusy(false);
																	}
																}}
															>
																Make default
															</Button>
														) : null}
														{!clipId ? (
															<Button variant='danger-soft' onPress={() => setRemove(item)}>
																Delete
															</Button>
														) : null}
													</div>
												</div>
											))}
									</section>
								))
							) : (
								<div className='space-y-2 py-6'>
									<p className='font-medium'>Create your first layout</p>
									<p className='text-sm text-muted'>Choose video crops, arrange layers, and add channel or clip details. Apply the layout to any number of clips when exporting.</p>
								</div>
							)}
						</>
					)}
				</Card.Content>
			</Card>
			<ControlledModal ariaLabel='Create clip layout' isOpen={create} onClose={() => setCreate(false)}>
				<Modal.Header>
					<Modal.Heading>Create clip layout</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='space-y-4'>
					<TextField variant='secondary' value={name} onChange={setName} isRequired maxLength={80}>
						<Label>Layout name</Label>
						<Input autoFocus placeholder='Gameplay and camera' />
					</TextField>
					<Select variant='secondary' value={format} onChange={(key) => setFormat(key === "desktop" ? "desktop" : "mobile")}>
						<Label>Output format</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								<ListBox.Item id='desktop'>Desktop 16:9</ListBox.Item>
								<ListBox.Item id='mobile'>Mobile 9:16</ListBox.Item>
							</ListBox>
						</Select.Popover>
					</Select>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onPress={() => setCreate(false)}>
						Cancel
					</Button>
					<Button
						isPending={busy}
						isDisabled={!name.trim()}
						onPress={async () => {
							setBusy(true);
							try {
								const result = await saveClipLayoutTemplate(creatorId, { name, composition: createClipComposition(format) });
								if (!result.ok) {
									error();
									return;
								}
								setCreate(false);
								setAttempt((n) => n + 1);
								router.push(path(result.id));
							} catch {
								error();
							} finally {
								setBusy(false);
							}
						}}
					>
						Create layout
					</Button>
				</Modal.Footer>
			</ControlledModal>
			<ControlledModal ariaLabel='Delete layout' isOpen={!!remove} onClose={() => setRemove(null)}>
				<Modal.Header>
					<Modal.Heading>Delete layout?</Modal.Heading>
				</Modal.Header>
				<Modal.Body>Delete “{remove?.name}” and its saved clip adjustments? Your source clips are kept.</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onPress={() => setRemove(null)}>
						Cancel
					</Button>
					<Button
						variant='danger'
						isPending={busy}
						onPress={async () => {
							if (!remove) return;
							setBusy(true);
							try {
								const r = await deleteClipLayoutTemplate(creatorId, remove.id);
								if (!r.ok) {
									error();
									return;
								}
								setRemove(null);
								setAttempt((n) => n + 1);
							} catch {
								error();
							} finally {
								setBusy(false);
							}
						}}
					>
						Delete layout
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</DashboardEditorLayout>
	);
}
