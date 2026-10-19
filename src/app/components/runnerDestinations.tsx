"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Chip, Input, Label, ListBox, Modal, Select, Table, TextField, Tooltip } from "@heroui/react";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { deleteRunnerDestination, listRunnerDestinations, saveRunnerDestination } from "@/app/actions/runner";
import ConfirmModal from "@/app/components/confirmModal";

type RunnerDestinationView = Extract<Awaited<ReturnType<typeof listRunnerDestinations>>, { success: true }>["destinations"][number];

const providers = [
	{ id: "twitch", name: "Twitch" },
	{ id: "youtube", name: "YouTube" },
	{ id: "custom", name: "Custom RTMP" },
] as const;
type Provider = (typeof providers)[number]["id"];
const endpoints = { twitch: "rtmp://live.twitch.tv/app", youtube: "rtmp://a.rtmp.youtube.com/live2", custom: "" };

export default function RunnerDestinations({ ownerId, runnerId, onChange }: { ownerId: string; runnerId: string; onChange?: (change?: { deletedId: string }) => void }) {
	const [destinations, setDestinations] = useState<RunnerDestinationView[]>([]);
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<RunnerDestinationView | null>(null);
	const [deleting, setDeleting] = useState<RunnerDestinationView | null>(null);
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const focusAddAfterDelete = useRef(false);
	const [name, setName] = useState("");
	const [provider, setProvider] = useState<Provider>("twitch");
	const [url, setUrl] = useState(endpoints.twitch);
	const [key, setKey] = useState("");
	const savedKeyAvailable = Boolean(editing?.credentialConfigured && editing.provider === provider);
	const credentialAction = key.trim() ? "replace" : savedKeyAvailable ? "keep" : "clear";
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const nameValid = name.trim().length >= 1 && name.trim().length <= 80;
	const credentialValid = provider === "custom" || savedKeyAvailable || key.trim().length > 0;
	const valid = nameValid && Boolean(url.trim() || editing) && Boolean(credentialValid);

	useEffect(() => {
		let current = true;
		void listRunnerDestinations(ownerId, runnerId)
			.then((result) => {
				if (!current) return;
				if (result.success) setDestinations(result.destinations);
				else setError(result.error);
			})
			.catch(() => {
				if (current) setError("Could not load destinations. Please try again.");
			});
		return () => {
			current = false;
		};
	}, [ownerId, runnerId]);

	useEffect(() => {
		if (!deleting && focusAddAfterDelete.current) {
			focusAddAfterDelete.current = false;
			addButtonRef.current?.focus();
		}
	}, [deleting]);

	function edit(destination: RunnerDestinationView | null) {
		setEditing(destination);
		setName(destination?.name ?? "");
		setProvider(destination?.provider ?? "twitch");
		setUrl(destination ? "" : endpoints.twitch);
		setKey("");
		setError(null);
		setOpen(true);
	}

	async function save() {
		if (!valid || saving) return;
		setSaving(true);
		setError(null);
		try {
			const result = await saveRunnerDestination({ ownerId, runnerId: editing ? editing.runnerId : runnerId, ...(editing ? { id: editing.id, expectedRevision: editing.configurationRevision } : {}), name, provider, ...(url.trim() ? { rtmpUrl: url } : {}), credentialAction, ...(credentialAction === "replace" && key.trim() ? { streamKey: key } : {}) });
			if (!result.success) {
				if (result.code === "CONFLICT") {
					const refreshed = await listRunnerDestinations(ownerId, runnerId);
					if (refreshed.success) setDestinations(refreshed.destinations);
				}
				setError(result.error);
				return;
			}
			setDestinations((current) => [...current.filter((row) => row.id !== result.destination.id), result.destination]);
			onChange?.();
			setKey("");
			setOpen(false);
		} catch {
			setError("Could not save the destination. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		if (!deleting || saving) return;
		setSaving(true);
		setError(null);
		try {
			const result = await deleteRunnerDestination({ ownerId, id: deleting.id, expectedRevision: deleting.configurationRevision, removeFromSavedBroadcasts: true });
			if (!result.success) {
				setError(result.error);
				if (result.code === "CONFLICT") {
					const refreshed = await listRunnerDestinations(ownerId, runnerId);
					if (refreshed.success) setDestinations(refreshed.destinations);
					setDeleting(null);
				}
				return;
			}
			setDestinations((current) => current.filter((row) => row.id !== deleting.id));
			onChange?.({ deletedId: deleting.id });
			focusAddAfterDelete.current = true;
			setDeleting(null);
		} catch {
			setError("Could not delete the destination. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<section className='space-y-4'>
				<div className='flex justify-end'>
					<Button ref={addButtonRef} variant='secondary' onPress={() => edit(null)}>
						<IconPlus size={16} />
						Add destination
					</Button>
				</div>
				<div className='space-y-3'>
					{error && !open && !deleting && (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					)}
					{destinations.length === 0 ? (
						<p className='text-sm text-muted'>No saved destinations yet.</p>
					) : (
						<Table variant='secondary' className='w-full'>
							<Table.ScrollContainer>
								<Table.Content aria-label='Saved destinations' className='w-full table-fixed'>
									<Table.Header>
										<Table.Column id='destination' isRowHeader>
											Destination
										</Table.Column>
										<Table.Column id='connection' className='hidden sm:table-cell'>
											Connection
										</Table.Column>
										<Table.Column id='actions' className='w-28 text-end'>
											Actions
										</Table.Column>
									</Table.Header>
									<Table.Body>
										{destinations.map((destination) => (
											<Table.Row key={destination.id} id={destination.id} textValue={destination.name}>
												<Table.Cell className='py-4 align-middle'>
													<p className='break-words font-medium'>{destination.name}</p>
													<p className='text-sm text-muted'>{providers.find((row) => row.id === destination.provider)?.name}</p>
													<p className='mt-1 break-all text-sm text-muted sm:hidden'>{destination.host}</p>
													<Chip size='sm' variant='soft' className='mt-2'>
														{destination.credentialConfigured ? "Key saved" : destination.provider === "custom" ? "No key configured" : "Key required"}
													</Chip>
												</Table.Cell>
												<Table.Cell className='hidden break-all py-4 align-middle text-sm text-muted sm:table-cell'>{destination.host}</Table.Cell>
												<Table.Cell className='py-4 align-middle'>
													<div className='flex items-center justify-end gap-2'>
														<Tooltip>
															<Button isIconOnly size='sm' variant='tertiary' aria-label={`Edit ${destination.name}`} onPress={() => edit(destination)}>
																<IconPencil size={16} />
															</Button>
															<Tooltip.Content>Edit destination</Tooltip.Content>
														</Tooltip>
														<Tooltip>
															<Button
																isIconOnly
																size='sm'
																variant='tertiary'
																className='text-danger'
																aria-label={`Delete ${destination.name}`}
																onPress={() => {
																	setError(null);
																	setDeleting(destination);
																}}
															>
																<IconTrash size={16} />
															</Button>
															<Tooltip.Content>Delete destination</Tooltip.Content>
														</Tooltip>
													</div>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					)}
				</div>
			</section>
			<ConfirmModal
				isOpen={deleting !== null}
				isPending={saving}
				onOpenChange={(next) => {
					if (!next) {
						setDeleting(null);
						setError(null);
					}
				}}
				title='Delete destination?'
				confirmLabel='Delete destination'
				description={
					<div className='space-y-3'>
						<p>Delete “{deleting?.name}” and its saved key? It will also be removed from stopped broadcasts.</p>
						{error && (
							<p role='alert' className='text-sm text-danger'>
								{error}
							</p>
						)}
					</div>
				}
				onConfirm={remove}
			/>
			<Modal.Backdrop
				isOpen={open}
				onOpenChange={(next) => {
					if (!saving) {
						setOpen(next);
						if (!next) setKey("");
					}
				}}
			>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>{editing ? "Edit destination" : "Add destination"}</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='space-y-4'>
							<TextField>
								<Label>Destination name</Label>
								<Input variant='secondary' value={name} onChange={(event) => setName(event.target.value)} />
								{!nameValid && <p className='text-sm text-danger'>Use 1–80 characters.</p>}
							</TextField>
							<Select
								variant='secondary'
								value={provider}
								onChange={(value) => {
									const next = String(value) as Provider;
									setProvider(next);
									setUrl(endpoints[next]);
									setKey("");
								}}
							>
								<Label>Provider</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										{providers.map((row) => (
											<ListBox.Item key={row.id} id={row.id} textValue={row.name}>
												<ListBox.ItemIndicator />
												<Label>{row.name}</Label>
											</ListBox.Item>
										))}
									</ListBox>
								</Select.Popover>
							</Select>
							<TextField>
								<Label>RTMP URL</Label>
								<Input variant='secondary' value={url} onChange={(event) => setUrl(event.target.value)} placeholder={editing ? `Keep current destination (${editing.host})` : "rtmp://your-server/live"} />
								<p className='text-xs text-muted'>Connections originate from your Runner. Local and private servers are supported.</p>
							</TextField>
							<TextField>
								<Label>Destination stream key</Label>
								<Input variant='secondary' type='password' autoComplete='new-password' placeholder={savedKeyAvailable ? "••••••••" : undefined} value={key} onChange={(event) => setKey(event.target.value)} />
								<p className='text-xs text-muted'>{provider === "custom" ? "Optional for custom RTMP servers." : "Required for this provider."}</p>
							</TextField>
							{error && (
								<p role='alert' className='text-sm text-danger'>
									{error}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Button
								variant='tertiary'
								isDisabled={saving}
								onPress={() => {
									setKey("");
									setOpen(false);
								}}
							>
								Cancel
							</Button>
							<Button variant='primary' isDisabled={!valid || saving} isPending={saving} onPress={save}>
								Save destination
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}
