"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Chip, Input, Link, Label, ListBox, Modal, Select, Table, TextField, Tooltip, Tabs, Spinner } from "@heroui/react";
import { IconPlus, IconPencil, IconTrash, IconBrandTwitch, IconBrandYoutube, IconActivity } from "@tabler/icons-react";
import { deleteRunnerDestination, listRunnerDestinations, saveRunnerDestination } from "@/app/actions/runner";
import { useConnectionTest } from "./runner/useConnectionTest";
import { useProviderConnection } from "./runner/useProviderConnection";
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

	const [connectionMethod, setConnectionMethod] = useState("account");

	const [testOpen, setTestOpen] = useState(false);

	const ProviderIcon = provider === "youtube" ? IconBrandYoutube : IconBrandTwitch;
	const providerName = provider === "youtube" ? "YouTube" : "Twitch";
	const [saving, setSaving] = useState(false);
	const [blockedDeletion, setBlockedDeletion] = useState(false);
	const [scheduleUsage, setScheduleUsage] = useState<{ eventId: string; title: string; runnerId: string }[]>([]);
	const [error, setError] = useState<string | null>(null);
	const account = useProviderConnection(ownerId, setError);
	const connectionTest = useConnectionTest(ownerId, runnerId, setError);
	const testRunning = Boolean(connectionTest.test && connectionTest.test.state !== "stopped");
	const accountConnected = Boolean(account.connection && account.connection.provider === provider);
	const credentialAction = key.trim() ? "replace" : savedKeyAvailable ? "keep" : "clear";

	const nameValid = name.trim().length >= 1 && name.trim().length <= 80;
	const credentialValid = provider === "custom" || savedKeyAvailable || key.trim().length > 0;
	const valid = nameValid && (provider !== "custom" && connectionMethod === "account" ? accountConnected && (provider !== "youtube" || (Boolean(account.streamId) && !account.loadingStreams && !account.streamsError)) : Boolean(url.trim() || editing) && Boolean(credentialValid));

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
		setConnectionMethod(destination && !destination.connectionId ? "key" : "account");
		account.setConnectionId(destination?.connectionId ?? account.connections.find((row) => row.provider === (destination?.provider ?? "twitch"))?.id ?? null);
		account.setStreamId(destination?.providerStreamId ?? "");
		setName(destination?.name ?? "");
		setProvider(destination?.provider ?? "twitch");
		setUrl(destination?.provider === "custom" ? "" : endpoints[destination?.provider ?? "twitch"]);
		setKey("");
		setError(null);
		setOpen(true);
	}

	async function save() {
		if (!valid || saving) return;
		setSaving(true);
		setError(null);
		try {
			const result = await saveRunnerDestination({
				ownerId,
				runnerId,
				...(editing ? { id: editing.id, expectedRevision: editing.configurationRevision } : {}),
				name,
				provider,
				...(url.trim() ? { rtmpUrl: url } : {}),
				...(provider !== "custom" && connectionMethod === "account" ? { connectionId: account.connectionId, providerStreamId: provider === "youtube" ? account.streamId : undefined, credentialAction: "keep" as const } : { connectionId: null, credentialAction, ...(credentialAction === "replace" && key.trim() ? { streamKey: key } : {}) }),
			});
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
		if (!deleting || saving || blockedDeletion) return;
		setSaving(true);
		setError(null);
		try {
			const result = await deleteRunnerDestination({ ownerId, id: deleting.id, expectedRevision: deleting.configurationRevision, removeFromSavedBroadcasts: true });
			if (!result.success) {
				setError(result.error);
				if (result.code === "RESOURCE_IN_USE") {
					setBlockedDeletion(true);
					setScheduleUsage("scheduleUsage" in result && Array.isArray(result.scheduleUsage) ? result.scheduleUsage : []);
				}
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
				isConfirmDisabled={blockedDeletion}
				isPending={saving}
				onOpenChange={(next) => {
					if (!next) {
						setDeleting(null);
						setBlockedDeletion(false);
						setScheduleUsage([]);
						setError(null);
					}
				}}
				title='Delete destination?'
				confirmLabel='Delete destination'
				description={
					<div className='space-y-3'>
						<p>Delete “{deleting?.name}” and its saved key? It will also be removed from stopped broadcasts.</p>
						{scheduleUsage.length > 0 && (
							<div className='space-y-2'>
								<p className='text-sm text-muted'>Still used by these scheduled broadcasts:</p>
								{scheduleUsage.map((usage) => (
									<Link key={usage.eventId} href={`/dashboard/runners/${usage.runnerId}?schedule=${encodeURIComponent(usage.eventId)}`} className='block'>
										{usage.title}
									</Link>
								))}
							</div>
						)}
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
					if (testOpen && !next) {
						if (!connectionTest.pending)
							void connectionTest.stop().then((stopped) => {
								if (stopped) setTestOpen(false);
							});
						return;
					}
					if (!saving) {
						setOpen(next);
						if (!next) setKey("");
					}
				}}
			>
				<Modal.Container size={testOpen ? "md" : "lg"}>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						{testOpen ? (
							<>
								<Modal.Header>
									<Modal.Heading>Test Twitch connection</Modal.Heading>
								</Modal.Header>
								<Modal.Body className='space-y-5'>
									<div className='flex items-center gap-3'>
										<IconBrandTwitch size={24} className='text-accent' />
										<div>
											<p className='font-semibold'>{account.connection?.channelName}</p>
											<p className='text-sm text-muted'>Your channel stays offline during the test.</p>
										</div>
									</div>
									{testRunning ? (
										<div role='status' className='flex flex-col items-center gap-3 py-8'>
											<Spinner size='lg' />
											<p className='font-medium'>{connectionTest.test?.state === "running" ? "Testing connection" : connectionTest.test?.state === "stopping" ? "Stopping test" : "Waiting for Runner"}</p>
											<p className='text-sm text-muted'>{connectionTest.test?.outputs.some((output) => output.state === "streaming") ? "Twitch is receiving the test stream." : "Checking stream health"}</p>
										</div>
									) : (
										<Select value={connectionTest.duration} onChange={(value) => connectionTest.setDuration(String(value))} variant='secondary'>
											<Label>Test duration</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													<ListBox.Item id='30'>30 seconds</ListBox.Item>
													<ListBox.Item id='60'>1 minute</ListBox.Item>
													<ListBox.Item id='120'>2 minutes</ListBox.Item>
												</ListBox>
											</Select.Popover>
										</Select>
									)}
									{connectionTest.test?.state === "stopped" && (
										<p role='status' className='text-sm'>
											Test finished.
										</p>
									)}
									{error && (
										<p role='alert' className='text-sm text-danger'>
											{error}
										</p>
									)}
								</Modal.Body>
								<Modal.Footer>
									<Button
										variant={testRunning ? "danger-soft" : "tertiary"}
										isPending={connectionTest.pending}
										onPress={() => {
											void connectionTest.stop().then((stopped) => {
												if (stopped) {
													setTestOpen(false);
													setOpen(true);
												}
											});
										}}
									>
										{testRunning ? "End test" : "Cancel"}
									</Button>
									{!testRunning && (
										<Button
											variant='primary'
											isPending={connectionTest.pending}
											isDisabled={!account.connectionId}
											onPress={() => {
												if (account.connectionId) void connectionTest.start(account.connectionId);
											}}
										>
											<IconActivity size={18} />
											Start test
										</Button>
									)}
								</Modal.Footer>
							</>
						) : (
							<>
								<Modal.Header>
									<Modal.Heading>{editing ? "Edit destination" : "Add destination"}</Modal.Heading>
								</Modal.Header>
								<Modal.Body className='space-y-4'>
									<TextField>
										<Label>Destination name</Label>
										<Input variant='secondary' value={name} onChange={(event) => setName(event.target.value)} />
									</TextField>
									<Select
										variant='secondary'
										value={provider}
										onChange={(value) => {
											const next = String(value) as Provider;
											setProvider(next);
											account.setConnectionId(account.connections.find((row) => row.provider === next)?.id ?? null);
											account.setStreamId("");
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
									{provider !== "custom" && (
										<Tabs selectedKey={connectionMethod} onSelectionChange={(value) => setConnectionMethod(String(value))}>
											<Tabs.ListContainer className='w-full'>
												<Tabs.List aria-label='Connection method' className='w-full'>
													<Tabs.Tab id='account' className='flex-1'>
														Connect account
														<Tabs.Indicator />
													</Tabs.Tab>
													<Tabs.Tab id='key' className='flex-1'>
														Stream key
														<Tabs.Indicator />
													</Tabs.Tab>
												</Tabs.List>
											</Tabs.ListContainer>
											<Tabs.Panel id='account' className='pt-5 text-foreground'>
												{accountConnected ? (
													<div className='flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between'>
														<div className='flex items-center gap-3'>
															<span className='flex size-11 items-center justify-center rounded-full bg-accent/10 text-accent'>
																<ProviderIcon size={24} />
															</span>
															<div>
																<p className='font-semibold'>{account.connection?.channelName}</p>
																<p className='text-sm text-muted'>{providerName} channel</p>
															</div>
														</div>
														<div className='flex items-center justify-between gap-2 sm:justify-end'>
															<Chip color='success' variant='soft' size='sm'>
																Connected
															</Chip>
															<Button
																variant='tertiary'
																size='sm'
																onPress={() => {
																	void account.connect(provider);
																}}
																isPending={account.connecting}
															>
																Change
															</Button>
														</div>
													</div>
												) : (
													<div className='flex items-start gap-3 py-2'>
														<span className='flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent'>
															<ProviderIcon size={24} />
														</span>
														<div>
															<p className='font-semibold'>Connect your {providerName} channel</p>
															<p className='mt-1 text-sm text-muted'>Choose the channel you want to stream to.</p>
														</div>
													</div>
												)}

												{account.connections.filter((row) => row.provider === provider).length > 1 && (
													<Select variant='secondary' className='mt-4' value={account.connectionId ?? ""} onChange={(value) => account.setConnectionId(String(value))}>
														<Label>Channel</Label>
														<Select.Trigger>
															<Select.Value />
															<Select.Indicator />
														</Select.Trigger>
														<Select.Popover>
															<ListBox>
																{account.connections
																	.filter((row) => row.provider === provider)
																	.map((row) => (
																		<ListBox.Item id={row.id} key={row.id} textValue={row.channelName}>
																			{row.channelName}
																		</ListBox.Item>
																	))}
															</ListBox>
														</Select.Popover>
													</Select>
												)}
												{provider === "youtube" && accountConnected && (
													<div className='mt-4 space-y-2'>
														<Select variant='secondary' value={account.streamId} onChange={(value) => account.setStreamId(String(value))} isDisabled={account.loadingStreams}>
															<Label>YouTube stream key</Label>
															<Select.Trigger>
																<Select.Value />
																<Select.Indicator />
															</Select.Trigger>
															<Select.Popover>
																<ListBox>
																	{account.streams.map((row) => (
																		<ListBox.Item id={row.id} key={row.id} textValue={row.name}>
																			{row.name}
																		</ListBox.Item>
																	))}
																</ListBox>
															</Select.Popover>
														</Select>
														{account.loadingStreams && (
															<p role='status' className='flex items-center gap-2 text-sm text-muted'>
																<Spinner size='sm' />
																Loading stream keys…
															</p>
														)}
														{account.streamsError && (
															<div className='space-y-2'>
																<p role='alert' className='text-sm text-danger'>
																	{account.streamsError}
																</p>
																<Button
																	variant='secondary'
																	size='sm'
																	onPress={() => {
																		if (account.streamsErrorCode === "RECONNECT_REQUIRED") void account.connect("youtube");
																		else account.retryStreams();
																	}}
																>
																	{account.streamsErrorCode === "RECONNECT_REQUIRED" ? "Reconnect YouTube" : "Retry"}
																</Button>
															</div>
														)}
														{!account.loadingStreams && !account.streamsError && !account.streams.length && <p className='text-sm text-muted'>Create a stream key in YouTube Studio, then refresh this list.</p>}
														{!account.loadingStreams && !account.streamsError && !account.streams.length && (
															<Button variant='secondary' size='sm' onPress={account.retryStreams}>
																Refresh stream keys
															</Button>
														)}
													</div>
												)}
											</Tabs.Panel>
											<Tabs.Panel id='key' className='pt-5'>
												<TextField type='password'>
													<Label>Destination stream key</Label>
													<Input variant='secondary' type='password' autoComplete='new-password' placeholder={savedKeyAvailable ? "••••••••" : undefined} value={key} onChange={(event) => setKey(event.target.value)} />
												</TextField>
											</Tabs.Panel>
										</Tabs>
									)}
									{provider === "custom" && (
										<TextField>
											<Label>RTMP URL</Label>
											<Input variant='secondary' value={url} onChange={(event) => setUrl(event.target.value)} placeholder={editing ? `Keep current destination (${editing.host})` : "rtmp://your-server/live"} />
											<p className='text-xs text-muted'>Connections originate from your Runner. Local and private servers are supported.</p>
										</TextField>
									)}
									{provider === "custom" && (
										<TextField type='password'>
											<Label>Destination stream key</Label>
											<Input variant='secondary' type='password' autoComplete='new-password' placeholder={savedKeyAvailable ? "••••••••" : undefined} value={key} onChange={(event) => setKey(event.target.value)} />
											<p className='text-xs text-muted'>{provider === "custom" ? "Optional for custom RTMP servers." : "Required for this provider."}</p>
										</TextField>
									)}
									{error && (
										<p role='alert' className='text-sm text-danger'>
											{error}
										</p>
									)}
								</Modal.Body>
								<Modal.Footer className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
									{provider === "twitch" && accountConnected && connectionMethod === "account" && (
										<Button
											className='w-full sm:w-auto'
											variant='secondary'
											onPress={() => {
												connectionTest.reset();
												setError(null);
												setTestOpen(true);
											}}
										>
											<IconActivity size={18} />
											Test connection
										</Button>
									)}
									<div className='flex w-full justify-end gap-2 sm:ml-auto sm:w-auto'>
										<Button className='flex-1 sm:flex-none' variant='tertiary' onPress={() => setOpen(false)}>
											Cancel
										</Button>
										{provider !== "custom" && connectionMethod === "account" && !accountConnected ? (
											<Button
												className='flex-[2] sm:flex-none'
												variant='primary'
												isPending={account.connecting}
												onPress={() => {
													void account.connect(provider);
												}}
											>
												<ProviderIcon size={18} />
												Connect {providerName}
											</Button>
										) : (
											<Button className='flex-[2] sm:flex-none' variant='primary' isDisabled={!valid || account.connecting} isPending={saving} onPress={save}>
												Save destination
											</Button>
										)}
									</div>
								</Modal.Footer>
							</>
						)}
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}
