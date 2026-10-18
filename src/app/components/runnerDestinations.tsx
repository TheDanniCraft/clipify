"use client";

import { useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
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

export default function RunnerDestinations({ ownerId, runnerId, onChange }: { ownerId: string; runnerId: string; onChange?: () => void }) {
	const [destinations, setDestinations] = useState<RunnerDestinationView[]>([]);
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<RunnerDestinationView | null>(null);
	const [deleting, setDeleting] = useState<RunnerDestinationView | null>(null);
	const [name, setName] = useState("");
	const [provider, setProvider] = useState<Provider>("twitch");
	const [url, setUrl] = useState(endpoints.twitch);
	const [key, setKey] = useState("");
	const [credentialAction, setCredentialAction] = useState<"keep" | "replace" | "clear">("replace");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const nameValid = name.trim().length >= 1 && name.trim().length <= 80;
	const credentialValid = provider === "custom" || (editing && credentialAction === "clear") || (credentialAction === "keep" && editing?.credentialConfigured) || (credentialAction === "replace" && key.trim().length > 0);
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

	function edit(destination: RunnerDestinationView | null) {
		setEditing(destination);
		setName(destination?.name ?? "");
		setProvider(destination?.provider ?? "twitch");
		setUrl(destination ? "" : endpoints.twitch);
		setKey("");
		setCredentialAction(destination ? "keep" : "replace");
		setError(null);
		setOpen(true);
	}

	async function save() {
		if (!valid || saving) return;
		setSaving(true);
		setError(null);
		try {
			const result = await saveRunnerDestination({ ownerId, runnerId: editing ? editing.runnerId : runnerId, ...(editing ? { id: editing.id, expectedRevision: editing.configurationRevision } : {}), name, provider, ...(url.trim() ? { rtmpUrl: url } : {}), credentialAction: !editing && provider === "custom" && !key.trim() ? "clear" : credentialAction, ...(credentialAction === "replace" && key.trim() ? { streamKey: key } : {}) });
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
			const result = await deleteRunnerDestination({ ownerId, id: deleting.id, expectedRevision: deleting.configurationRevision });
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
			onChange?.();
			setDeleting(null);
		} catch {
			setError("Could not delete the destination. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-3'>
					<div>
						<h2 className='text-lg font-semibold'>Destinations</h2>
						<p className='text-sm text-muted'>Save your streaming destinations and manage their protected keys.</p>
					</div>
					<Button variant='secondary' onPress={() => edit(null)}>
						<IconPlus size={16} />
						Add destination
					</Button>
				</Card.Header>
				<Card.Content className='space-y-3'>
					{error && !open && !deleting && (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					)}
					{destinations.length === 0 ? (
						<p className='text-sm text-muted'>No saved destinations yet.</p>
					) : (
						<ul className='grid grid-cols-1 gap-3 md:grid-cols-2'>
							{destinations.map((destination) => (
								<li key={destination.id} className='flex items-center justify-between gap-3 rounded-xl border border-divider p-4'>
									<div className='min-w-0'>
										<p className='truncate font-medium'>{destination.name}</p>
										<p className='truncate text-sm text-muted'>
											{providers.find((row) => row.id === destination.provider)?.name} · {destination.host}
										</p>
										<Chip size='sm' variant='soft' className='mt-2'>
											{destination.credentialConfigured ? "Key saved" : destination.provider === "custom" ? "No key configured" : "Key required"}
										</Chip>
									</div>
									<div className='flex shrink-0 items-center gap-1'>
										<Button size='sm' variant='tertiary' aria-label={`Edit ${destination.name}`} onPress={() => edit(destination)}>
											<IconPencil size={16} />
											Edit
										</Button>
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
									</div>
								</li>
							))}
						</ul>
					)}
				</Card.Content>
			</Card>
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
						<p>Remove “{deleting?.name}” and its saved key?</p>
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
								<Input value={name} onChange={(event) => setName(event.target.value)} />
								{!nameValid && <p className='text-sm text-danger'>Use 1–80 characters.</p>}
							</TextField>
							<Select
								value={provider}
								onChange={(value) => {
									const next = String(value) as Provider;
									setProvider(next);
									setUrl(endpoints[next]);
									setCredentialAction("replace");
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
								<Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={editing ? `Keep current destination (${editing.host})` : "rtmp://your-server/live"} />
								<p className='text-xs text-muted'>Connections originate from your Runner. Local and private servers are supported.</p>
							</TextField>
							{editing && (
								<Select
									value={credentialAction}
									onChange={(value) => {
										setCredentialAction(String(value) as typeof credentialAction);
										setKey("");
									}}
								>
									<Label>Stream key action</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{[
												{ id: "keep", name: "Keep saved key" },
												{ id: "replace", name: "Replace key" },
												{ id: "clear", name: "Clear saved key" },
											].map((row) => (
												<ListBox.Item key={row.id} id={row.id} textValue={row.name}>
													<ListBox.ItemIndicator />
													<Label>{row.name}</Label>
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>
							)}
							{credentialAction === "replace" && (
								<TextField>
									<Label>Destination stream key</Label>
									<Input type='password' autoComplete='new-password' value={key} onChange={(event) => setKey(event.target.value)} />
									<p className='text-xs text-muted'>{provider === "custom" ? "Optional for custom RTMP servers." : "Required for this provider."}</p>
								</TextField>
							)}
							{editing && credentialAction === "clear" && <p className='text-sm text-muted'>The destination stays saved. A new broadcast will require a key for Twitch or YouTube.</p>}
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
