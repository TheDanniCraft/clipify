"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Checkbox, Chip, ComboBox, Description, FieldError, Form, Input, Label, ListBox, Modal, Select, Skeleton, Table, TextArea, TextField } from "@heroui/react";
import { IconCopy, IconPlus, IconPlugConnected } from "@tabler/icons-react";
import ConfirmModal from "@components/confirmModal";
import LocalizedDate from "@components/localizedDate";
import { getAdminExplorerPage } from "@actions/adminView";
import { notify } from "@lib/toast";
import { connectionOperations, untilRevokedExpiry, untilRevokedValue } from "@/server/connected-apps/admin-input";

type Operation = (typeof connectionOperations)[number];
const labels: Record<Operation, string> = { search_clips: "Search clips", resolve_clip: "Read clip details", get_clip_playback: "Play clips" };
type Connection = { id: string; name: string | null; clientId: string; creatorId: string; username: string; operations: Operation[]; expiresAt: string; revokedAt: string | null; disabled: boolean | null };
type Credentials = { clientId: string; clientSecret: string; creatorId: string; expiresAt: string; identity?: { clientId: string; clientSecret: string }; callbackUrl?: string; creatorSubject?: string };
async function send(body: unknown) {
	const response = await fetch("/api/connected-apps/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
	const result = await response.json();
	if (!response.ok || !result.ok) throw Error(result.error?.code ?? "SERVICE_UNAVAILABLE");
	return result.data;
}
export default function ApplicationConnections() {
	const [actionError, setActionError] = useState("");
	const [copied, setCopied] = useState(false);
	const [checkedAt, setCheckedAt] = useState(() => Date.now());
	const [items, setItems] = useState<Connection[]>([]),
		[page, setPage] = useState(1),
		[hasNext, setHasNext] = useState(false),
		[loading, setLoading] = useState(true),
		[loadFailed, setLoadFailed] = useState(false);
	const [open, setOpen] = useState(false),
		[pending, setPending] = useState(false),
		[revoke, setRevoke] = useState<Connection | null>(null),
		[credentials, setCredentials] = useState<Credentials | null>(null);
	const [name, setName] = useState(""),
		[creatorId, setCreatorId] = useState<string | null>(null),
		[query, setQuery] = useState(""),
		[creators, setCreators] = useState<{ id: string; username: string }[]>([]),
		[creatorError, setCreatorError] = useState(false),
		[creatorLoading, setCreatorLoading] = useState(false);
	const [duration, setDuration] = useState<string>(untilRevokedValue),
		[operations, setOperations] = useState<Operation[]>([...connectionOperations]),
		[signIn, setSignIn] = useState(false),
		[callbackUrl, setCallbackUrl] = useState("");
	const load = useCallback(
		async (signal?: AbortSignal) => {
			setLoading(true);
			setLoadFailed(false);
			try {
				const response = await fetch(`/api/connected-apps/admin?page=${page}`, { cache: "no-store", signal });
				const result = await response.json();
				if (!response.ok || !result.ok) throw Error();
				setItems(result.data.items);
				setCheckedAt(Date.now());
				setHasNext(result.data.hasNext);
			} catch {
				if (!signal?.aborted) setLoadFailed(true);
			} finally {
				if (!signal?.aborted) setLoading(false);
			}
		},
		[page],
	);
	useEffect(() => {
		const controller = new AbortController();
		const timer = setTimeout(() => void load(controller.signal), 0);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [load]);
	useEffect(() => {
		if (!open) return;
		let active = true;
		const timer = setTimeout(async () => {
			setCreatorLoading(true);
			setCreatorError(false);
			try {
				const result = await getAdminExplorerPage(query, 1, 25);
				if (active) setCreators(result.users.map(({ id, username }) => ({ id, username })));
			} catch {
				if (active) setCreatorError(true);
			} finally {
				if (active) setCreatorLoading(false);
			}
		}, 250);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [open, query]);
	async function create() {
		if (pending) return;
		setPending(true);
		try {
			const expiresAt = duration === untilRevokedValue ? untilRevokedValue : new Date(Date.now() + Number(duration) * 86400000).toISOString();
			const result = await send({ action: "provision", name, creatorId, operations, expiresAt, ...(signIn ? { callbackUrl } : {}) });
			setCredentials(result);
			setCopied(false);
			setOpen(false);
			void load();
		} catch (error) {
			setActionError(error instanceof Error && error.message === "RECENT_AUTH_REQUIRED" ? "Sign in again before creating application credentials." : error instanceof Error && error.message === "ACCESS_DENIED" ? "Access denied. Check your administrator session and the creator’s account." : "Connection could not be created. Check the fields and try again.");
		} finally {
			setPending(false);
		}
	}
	async function revokeAccess() {
		if (!revoke || pending) return;
		setPending(true);
		try {
			await send({ action: "revoke", grantId: revoke.id });
			setRevoke(null);
			notify({ title: "Application access revoked", color: "success" });
			void load();
		} catch (error) {
			setActionError(error instanceof Error && error.message === "RECENT_AUTH_REQUIRED" ? "Sign in again before revoking application access." : "Could not revoke access. Try again.");
		} finally {
			setPending(false);
		}
	}
	const configuration = credentials
		? [
				`CLIPIFY_BASE_URL=${typeof window !== "undefined" ? window.location.origin : ""}`,
				`CLIPIFY_CLIENT_ID=${credentials.clientId}`,
				`CLIPIFY_CLIENT_SECRET=${credentials.clientSecret}`,
				`CLIPIFY_CREATOR_ID=${credentials.creatorId}`,
				...(credentials.creatorSubject ? [`CLIPIFY_CREATOR_SUBJECT=${credentials.creatorSubject}`] : []),
				...(credentials.identity ? [`CLIPIFY_IDENTITY_CLIENT_ID=${credentials.identity.clientId}`, `CLIPIFY_IDENTITY_CLIENT_SECRET=${credentials.identity.clientSecret}`] : []),
			].join("\n")
		: "";
	return (
		<div className='mt-6 space-y-4 pb-8'>
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-4'>
					<div>
						<Card.Title>Approved applications</Card.Title>
						<Card.Description>Each connection is limited to one creator and the permissions you choose.</Card.Description>
					</div>
					<Button
						onPress={() => {
							setName("");
							setCreatorId(null);
							setQuery("");
							setOperations([...connectionOperations]);
							setDuration(untilRevokedValue);
							setSignIn(false);
							setCallbackUrl("");
							setOpen(true);
						}}
					>
						<IconPlus className='size-4' />
						Add connection
					</Button>
				</Card.Header>
				<Card.Content>
					{loading ? (
						<Skeleton className='h-28 rounded-xl' aria-label='Loading application connections' />
					) : loadFailed ? (
						<div className='flex items-center justify-between gap-3'>
							<p className='text-sm text-muted'>Connections could not be loaded.</p>
							<Button variant='secondary' onPress={() => void load()}>
								Retry
							</Button>
						</div>
					) : (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Application connections' className={items.length ? "min-w-[900px]" : undefined}>
									<Table.Header>
										<Table.Column isRowHeader>Application</Table.Column>
										<Table.Column>Creator</Table.Column>
										<Table.Column>Permissions</Table.Column>
										<Table.Column>Clip access</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column>Actions</Table.Column>
									</Table.Header>
									<Table.Body
										renderEmptyState={() => (
											<div className='flex flex-col items-center gap-2 p-8 text-center'>
												<IconPlugConnected className='size-6 text-muted' />
												<p>No applications connected yet.</p>
												<p className='text-sm text-muted'>Add a connection to approve a companion app.</p>
											</div>
										)}
									>
										{items.map((item) => {
											const inactive = Boolean(item.revokedAt || item.disabled),
												expired = new Date(item.expiresAt).getTime() <= checkedAt;
											return (
												<Table.Row key={item.id} id={item.id}>
													<Table.Cell>
														<span className='font-medium'>{item.name ?? "Application"}</span>
													</Table.Cell>
													<Table.Cell>{item.username}</Table.Cell>
													<Table.Cell>
														<div className='flex flex-wrap gap-1'>
															{item.operations.map((value) => (
																<Chip key={value} size='sm' variant='secondary' className='shrink-0 whitespace-nowrap'>
																	{labels[value] ?? value}
																</Chip>
															))}
														</div>
													</Table.Cell>
													<Table.Cell>{item.expiresAt === untilRevokedExpiry ? "Until revoked" : <LocalizedDate value={item.expiresAt} showTime />}</Table.Cell>
													<Table.Cell>
														<Chip size='sm' color={inactive ? "default" : expired ? "warning" : "success"} variant='secondary'>
															{item.revokedAt ? "Revoked" : item.disabled ? "Disabled" : expired ? "Expired" : "Active"}
														</Chip>
													</Table.Cell>
													<Table.Cell>
														<Button size='sm' variant='danger-soft' isDisabled={Boolean(item.revokedAt)} onPress={() => setRevoke(item)}>
															Revoke
														</Button>
													</Table.Cell>
												</Table.Row>
											);
										})}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					)}
					{(page > 1 || hasNext) && (
						<nav aria-label='Connection pages' className='mt-4 flex items-center justify-end gap-3'>
							<Button size='sm' variant='secondary' isDisabled={page === 1 || loading} onPress={() => setPage((value) => value - 1)}>
								Previous
							</Button>
							<span className='text-sm text-muted'>Page {page}</span>
							<Button size='sm' variant='secondary' isDisabled={!hasNext || loading} onPress={() => setPage((value) => value + 1)}>
								Next
							</Button>
						</nav>
					)}
				</Card.Content>
			</Card>
			<Modal.Backdrop
				isOpen={open}
				onOpenChange={(value) => {
					if (!pending) setOpen(value);
				}}
			>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger isDisabled={pending} />
						<Modal.Header>
							<Modal.Heading>Add application connection</Modal.Heading>
						</Modal.Header>
						<Form
							className='w-full'
							onSubmit={(event) => {
								event.preventDefault();
								void create();
							}}
						>
							<Modal.Body className='flex flex-col gap-5'>
								<TextField fullWidth isRequired variant='secondary' value={name} onChange={setName} isDisabled={pending}>
									<Label>Application name</Label>
									<Input fullWidth maxLength={80} placeholder='Babbler Awards' />
									<FieldError />
								</TextField>
								<ComboBox fullWidth isRequired variant='secondary' selectedKey={creatorId} onSelectionChange={(key) => setCreatorId(key ? String(key) : null)} inputValue={query} onInputChange={setQuery} isDisabled={pending} allowsEmptyCollection>
									<Label>Creator</Label>
									<ComboBox.InputGroup>
										<Input placeholder='Search by username or creator ID' />
										<ComboBox.Trigger />
									</ComboBox.InputGroup>
									<Description>{creatorError ? "Creator search failed. Type again to retry." : creatorLoading ? "Searching creators…" : "Access applies only to this creator."}</Description>
									<ComboBox.Popover>
										<ListBox items={creators} renderEmptyState={() => (creatorError ? "Search unavailable" : creatorLoading ? "Searching…" : "No creators found")}>
											{(item) => (
												<ListBox.Item id={item.id} textValue={item.username}>
													<Label>{item.username}</Label>
													<Description>{item.id}</Description>
													<ListBox.ItemIndicator />
												</ListBox.Item>
											)}
										</ListBox>
									</ComboBox.Popover>
									<FieldError />
								</ComboBox>
								<fieldset className='space-y-3'>
									<legend className='mb-2 text-sm font-medium'>Clip permissions</legend>
									{connectionOperations.map((value) => (
										<Checkbox key={value} isSelected={operations.includes(value)} isDisabled={pending} onChange={(selected) => setOperations((current) => (selected ? [...current, value] : current.filter((item) => item !== value)))}>
											<Checkbox.Content>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
												{labels[value]}
											</Checkbox.Content>
										</Checkbox>
									))}
								</fieldset>
								<Select fullWidth aria-label='Clip access duration' variant='secondary' selectedKey={duration} onSelectionChange={(key) => setDuration(String(key))} isDisabled={pending}>
									<Label>Clip access duration</Label>
									<Select.Trigger>
										<Select.Value />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											<ListBox.Item id={untilRevokedValue} textValue='Until revoked'>
												Until revoked
												<ListBox.ItemIndicator />
											</ListBox.Item>
											{["7", "30", "90"].map((value) => (
												<ListBox.Item key={value} id={value} textValue={`${value} days`}>
													{value} days
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
									<Description>Temporary access expires automatically. Until revoked remains active until an administrator revokes it.</Description>
								</Select>
								<Checkbox isSelected={signIn} isDisabled={pending} onChange={setSignIn}>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										Allow sign-in with Clipify
									</Checkbox.Content>
								</Checkbox>
								{signIn && (
									<TextField fullWidth isRequired type='url' variant='secondary' value={callbackUrl} onChange={setCallbackUrl} isDisabled={pending}>
										<Label>Sign-in callback URL</Label>
										<Input fullWidth placeholder='https://awards.example/api/auth/callback/clipify' />
										<Description>Use the app’s exact HTTPS callback address. Users still authorize their own sign-in. This client remains enabled until you revoke the connection.</Description>
										<FieldError />
									</TextField>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button variant='secondary' isDisabled={pending} onPress={() => setOpen(false)}>
									Cancel
								</Button>
								<Button type='submit' isPending={pending} isDisabled={!creatorId || operations.length === 0}>
									Create connection
								</Button>
							</Modal.Footer>
						</Form>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			<Modal.Backdrop isOpen={Boolean(credentials)} isDismissable={false} isKeyboardDismissDisabled>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.Header>
							<Modal.Heading>Save your application credentials</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='flex flex-col gap-4'>
							<p className='text-sm text-muted'>These secrets are shown only once. Store them in the application’s private environment settings.</p>
							<TextField isReadOnly>
								<Label>Connection configuration</Label>
								<TextArea aria-label='Connection configuration' className='min-h-48 font-mono text-xs' value={configuration} />
							</TextField>
							{credentials?.callbackUrl && <p className='break-all text-sm text-muted'>Sign-in callback: {credentials.callbackUrl}</p>}
							<Button
								variant='secondary'
								onPress={async () => {
									try {
										await navigator.clipboard.writeText(configuration);
										setCopied(true);
									} catch {
										setActionError("Copy failed. Select and copy the configuration manually.");
									}
								}}
							>
								<IconCopy className='size-4' />
								{copied ? "Copied" : "Copy configuration"}
							</Button>
						</Modal.Body>
						<Modal.Footer>
							<Button onPress={() => setCredentials(null)}>I’ve saved the credentials</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			<Modal.Backdrop
				isOpen={Boolean(actionError)}
				onOpenChange={(value) => {
					if (!value) setActionError("");
				}}
			>
				<Modal.Container>
					<Modal.Dialog aria-label='Action could not be completed'>
						<Modal.Header>
							<Modal.Heading>Action could not be completed</Modal.Heading>
						</Modal.Header>
						<Modal.Body>
							<p>{actionError}</p>
						</Modal.Body>
						<Modal.Footer>
							<Button onPress={() => setActionError("")}>Close message</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			<ConfirmModal
				isOpen={Boolean(revoke)}
				isPending={pending}
				onOpenChange={(value) => {
					if (!value && !pending) setRevoke(null);
				}}
				title='Revoke application access?'
				description={`Stop ${revoke?.name ?? "this application"} from accessing this creator’s clips and disable its associated sign-in client.`}
				confirmLabel='Revoke access'
				onConfirm={revokeAccess}
			/>
		</div>
	);
}
