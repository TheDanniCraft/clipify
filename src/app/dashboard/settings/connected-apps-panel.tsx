"use client";
import { useEffect, useState } from "react";
import { Accordion, Alert, Button, Card, Chip, Modal, Spinner, Table } from "@heroui/react";
import ConfirmModal from "@components/confirmModal";
import { EmptyState } from "@heroui-pro/react";
import { IconPlugConnected, IconShieldCheck } from "@tabler/icons-react";
import { getConnectedMcpApps, revokeConnectedMcpApp, purgeInactiveConnectedMcpApps } from "@/app/actions/mcp-connections";
import { MCP_EXAMPLE_PROMPTS } from "@lib/mcpPrompts";
import type { McpConnection } from "@lib/mcpConnection";

function connectionStatus(connection: McpConnection) {
	if (connection.active) return "Active";
	if (connection.revokedAt) return "Disconnected";
	return new Date(connection.expiresAt) <= new Date() ? "Expired" : "Inactive";
}
function connectionAccessLabel(scopes: string[]) {
	if (scopes.some((scope) => scope.endsWith(":delete"))) return "Read, edit and delete";
	return scopes.some((scope) => /:(create|update|manage|control|publish|rotate)$/.test(scope)) ? "Read and edit" : "Read only";
}
export default function ConnectedAppsPanel() {
	const [connections, setConnections] = useState<McpConnection[]>([]);
	const [showInactive, setShowInactive] = useState(false);
	const [purgeOpen, setPurgeOpen] = useState(false);
	const [purgeTargetId, setPurgeTargetId] = useState<string | undefined>(undefined);
	const [detailsId, setDetailsId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState<string | null>(null);
	const [confirmation, setConfirmation] = useState<string | null>(null);
	const [error, setError] = useState<string>();
	const [notice, setNotice] = useState<string>();
	useEffect(() => {
		let active = true;
		void getConnectedMcpApps()
			.then((result) => {
				if (active) {
					setConnections(result.connections);
					setError(result.error);
					setLoading(false);
				}
			})
			.catch(() => {
				if (active) {
					setError("Connected apps could not be loaded. Try again.");
					setLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, []);
	async function revoke(id: string) {
		setPending(id);
		setError(undefined);
		setNotice(undefined);
		try {
			const result = await revokeConnectedMcpApp(id);
			if (result.error || !result.revoked) {
				setError(result.error ?? "The app could not be disconnected. Try again.");
				return;
			}
			setConnections((current) => current.map((connection) => (connection.id === id ? { ...connection, active: false, revokedAt: new Date().toISOString() } : connection)));
			setConfirmation(null);
			setNotice("The app is disconnected. It no longer has access to your creators.");
			const refreshed = await getConnectedMcpApps();
			if (!refreshed.error) setConnections(refreshed.connections);
		} catch {
			setError("The app could not be disconnected. Try again.");
		} finally {
			setPending(null);
		}
	}
	async function purgeInactive() {
		setPending("purge");
		setError(undefined);
		setNotice(undefined);
		try {
			const result = await (purgeTargetId === undefined ? purgeInactiveConnectedMcpApps() : purgeInactiveConnectedMcpApps(purgeTargetId));
			if (result.error || !result.purgedIds) {
				setError(result.error ?? "Inactive connections could not be purged. Try again.");
				return;
			}
			const removed = new Set(result.purgedIds);
			setConnections((current) => current.filter((connection) => !removed.has(connection.id)));
			if (detailsId && removed.has(detailsId)) setDetailsId(null);
			setPurgeOpen(false);
		} catch {
			setError("Inactive connections could not be purged. Try again.");
		} finally {
			setPending(null);
		}
	}
	const inactiveConnections = connections.filter((connection) => !connection.active);
	const visibleConnections = connections.filter((connection) => connection.active || showInactive);
	const selectedConnection = connections.find((connection) => connection.id === detailsId);
	return (
		<Card className='p-0' aria-labelledby='connected-apps-title'>
			<Card.Header className='gap-2 p-4'>
				<div className='flex items-center gap-3'>
					<span className='flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent'>
						<IconPlugConnected size={22} aria-hidden='true' />
					</span>
					<h2 id='connected-apps-title' className='text-lg font-semibold'>
						Connected AI apps
					</h2>
				</div>
				<Card.Description>Manage which apps can access your creators. Disconnecting an app stops its access immediately.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-3 px-4 pb-4'>
				{loading ? (
					<div className='flex items-center gap-2 py-4 text-muted'>
						<Spinner size='sm' />
						<p>Loading connected apps…</p>
					</div>
				) : (
					!connections.length && (
						<EmptyState className='rounded-xl bg-surface-secondary py-4'>
							<EmptyState.Header>
								<EmptyState.Media variant='icon'>
									<IconShieldCheck size={28} aria-hidden='true' />
								</EmptyState.Media>
								<EmptyState.Title>No connected apps.</EmptyState.Title>
								<EmptyState.Description>Apps you approve through Clipify will appear here.</EmptyState.Description>
							</EmptyState.Header>
						</EmptyState>
					)
				)}
				{error && !confirmation && !purgeOpen && (
					<Alert status='danger' role='alert'>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>Connection update failed</Alert.Title>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
				{notice && (
					<Alert status='success' role='status'>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>App disconnected</Alert.Title>
							<Alert.Description>{notice}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
				<Accordion className='rounded-xl border border-border px-4'>
					<Accordion.Item id='ai-example-prompts'>
						<Accordion.Heading>
							<Accordion.Trigger>
								Ideas to try with your AI app
								<Accordion.Indicator />
							</Accordion.Trigger>
						</Accordion.Heading>
						<Accordion.Panel>
							<Accordion.Body className='space-y-4 pb-4'>
								<p className='text-sm text-muted'>Try one of these prompts in your connected AI app. Available actions depend on the permissions you approved and your creator’s plan.</p>
								<ul className='space-y-3'>
									{MCP_EXAMPLE_PROMPTS.map((prompt) => (
										<li key={prompt.name} className='rounded-lg bg-surface-secondary p-3'>
											<p className='text-sm font-medium'>{prompt.title}</p>
											<p className='mt-1 select-text text-sm text-muted'>{prompt.example}</p>
										</li>
									))}
								</ul>
							</Accordion.Body>
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>
				{inactiveConnections.length > 0 && (
					<div className='flex flex-wrap gap-2'>
						<Button size='sm' variant='secondary' aria-expanded={showInactive} onPress={() => setShowInactive((value) => !value)}>
							{showInactive ? "Hide inactive" : `Show inactive (${inactiveConnections.length})`}
						</Button>
						<Button
							size='sm'
							variant='danger-soft'
							isDisabled={pending !== null}
							onPress={() => {
								setError(undefined);
								setPurgeTargetId(undefined);
								setPurgeOpen(true);
							}}
						>
							Purge all inactive
						</Button>
					</div>
				)}
				{visibleConnections.length > 0 && (
					<Table variant='secondary'>
						<Table.ScrollContainer className='max-h-80 overflow-auto'>
							<Table.Content aria-label='Connected AI apps' className='w-full min-w-[640px] table-fixed'>
								<Table.Header className='sticky top-0 z-10'>
									<Table.Column id='app' isRowHeader className='w-[24%]'>
										App
									</Table.Column>
									<Table.Column id='access' className='w-[24%]'>
										Access
									</Table.Column>
									<Table.Column id='status' className='w-[15%]'>
										Status
									</Table.Column>
									<Table.Column id='expires' className='w-[15%]'>
										Expires
									</Table.Column>
									<Table.Column id='actions' className='w-[22%]'>
										Actions
									</Table.Column>
								</Table.Header>
								<Table.Body>
									{visibleConnections.map((connection) => (
										<Table.Row key={connection.id} id={connection.id} textValue={connection.clientName}>
											<Table.Cell className='break-words font-medium'>{connection.clientName}</Table.Cell>
											<Table.Cell>
												<span className='block text-sm'>{connectionAccessLabel(connection.scopes)}</span>
												<span className='text-xs text-muted'>
													{connection.creatorIds.length} {connection.creatorIds.length === 1 ? "creator" : "creators"}
												</span>
											</Table.Cell>
											<Table.Cell>
												<Chip size='sm' variant='soft' color={connection.active ? "success" : "default"}>
													{connectionStatus(connection)}
												</Chip>
											</Table.Cell>
											<Table.Cell className='text-xs text-muted'>{new Date(connection.expiresAt).toLocaleDateString()}</Table.Cell>
											<Table.Cell>
												<div className='flex flex-wrap gap-1'>
													<Button size='sm' variant='tertiary' aria-label={`Details for ${connection.clientName}`} aria-haspopup='dialog' onPress={() => setDetailsId(detailsId === connection.id ? null : connection.id)}>
														Details
													</Button>
													{connection.active && (
														<Button
															size='sm'
															variant='danger-soft'
															isDisabled={pending !== null}
															aria-label={`Disconnect ${connection.clientName}`}
															onPress={() => {
																setError(undefined);
																setConfirmation(connection.id);
															}}
														>
															Disconnect
														</Button>
													)}
													{!connection.active && (
														<Button
															size='sm'
															variant='danger-soft'
															isDisabled={pending !== null}
															aria-label={`Remove ${connection.clientName}`}
															onPress={() => {
																setError(undefined);
																setPurgeTargetId(connection.id);
																setPurgeOpen(true);
															}}
														>
															Remove
														</Button>
													)}
												</div>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				)}
				{!loading && connections.length > 0 && !visibleConnections.length && <p className='text-sm text-muted'>No active connections.</p>}
				{selectedConnection && (
					<Modal.Backdrop
						isOpen
						onOpenChange={(open) => {
							if (!open) setDetailsId(null);
						}}
						variant='blur'
					>
						<Modal.Container size='lg' scroll='inside'>
							<Modal.Dialog aria-label={`Connection details for ${selectedConnection.clientName}`}>
								<Modal.CloseTrigger aria-label='Close connection details' />
								<Modal.Header>
									<Modal.Heading>{selectedConnection.clientName} details</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<p className='break-all text-sm text-muted'>Client ID: {selectedConnection.clientId}</p>
									<p>Creators: {selectedConnection.creatorIds.join(", ")}</p>
									{(selectedConnection.creatorPermissions ?? selectedConnection.creatorIds.map((creatorId) => ({ creatorId, scopes: selectedConnection.scopes }))).map((creator) => (
										<p key={creator.creatorId} className='break-words text-sm text-muted'>
											Permissions for {creator.creatorId}: {creator.scopes.join(", ")}
										</p>
									))}
								</Modal.Body>
								<Modal.Footer>
									<Button variant='secondary' onPress={() => setDetailsId(null)}>
										Close details
									</Button>
								</Modal.Footer>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				)}
				<ConfirmModal
					isOpen={confirmation !== null}
					onOpenChange={(open) => {
						if (!open && !pending) setConfirmation(null);
					}}
					title='Disconnect this app?'
					confirmLabel='Disconnect'
					isPending={pending !== null}
					onConfirm={() => {
						if (confirmation) return revoke(confirmation);
					}}
					content={
						<>
							<p>This app will lose access to your creators. You can connect it again at any time.</p>
							{error && (
								<Alert status='danger' role='alert'>
									<Alert.Indicator />
									<Alert.Content>
										<Alert.Title>Could not disconnect</Alert.Title>
										<Alert.Description>{error}</Alert.Description>
									</Alert.Content>
								</Alert>
							)}
						</>
					}
				/>
				<Modal.Backdrop
					isOpen={purgeOpen}
					onOpenChange={(open) => {
						if (!pending) setPurgeOpen(open);
					}}
					variant='blur'
				>
					<Modal.Container size='sm'>
						<Modal.Dialog aria-label={purgeTargetId ? "Remove inactive connection" : "Purge inactive connections"}>
							<Modal.CloseTrigger isDisabled={pending !== null} aria-label='Cancel purge' />
							<Modal.Header>
								<Modal.Heading>{purgeTargetId ? "Remove this connection?" : "Purge inactive connections?"}</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p>{purgeTargetId ? "Permanently remove this inactive connection. Your activity history will be kept." : "Permanently remove expired, revoked and inactive connections. Active connections and your activity history will be kept."}</p>
								{error && (
									<Alert status='danger' role='alert'>
										<Alert.Indicator />
										<Alert.Content>
											<Alert.Title>Purge failed</Alert.Title>
											<Alert.Description>{error}</Alert.Description>
										</Alert.Content>
									</Alert>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button variant='secondary' isDisabled={pending !== null} onPress={() => setPurgeOpen(false)}>
									Cancel
								</Button>
								<Button variant='danger' isPending={pending === "purge"} isDisabled={pending !== null} onPress={() => void purgeInactive()}>
									{purgeTargetId ? "Confirm removal" : "Confirm purge"}
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Card.Content>
		</Card>
	);
}
