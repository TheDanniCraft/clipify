"use client";
import { useEffect, useState } from "react";
import { Accordion, Alert, Button, Card, Chip, Spinner, Table } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { IconPlugConnected, IconShieldCheck } from "@tabler/icons-react";
import { getConnectedMcpApps, revokeConnectedMcpApp } from "@/app/actions/mcp-connections";
import { MCP_EXAMPLE_PROMPTS } from "@lib/mcpPrompts";
import type { McpConnection } from "@lib/mcpConnection";

function connectionStatus(connection: McpConnection) {
	if (connection.active) return "Active";
	if (connection.revokedAt) return "Revoked";
	return new Date(connection.expiresAt) <= new Date() ? "Expired" : "Inactive";
}
function connectionAccessLabel(scopes: string[]) {
	if (scopes.some((scope) => scope.endsWith(":delete"))) return "Read, edit and delete";
	return scopes.some((scope) => /:(create|update|manage|control|publish|rotate)$/.test(scope)) ? "Read and edit" : "Read only";
}
export default function ConnectedAppsPanel() {
	const [connections, setConnections] = useState<McpConnection[]>([]);
	const [showInactive, setShowInactive] = useState(false);
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
				setError(result.error ?? "Access could not be revoked. Try again.");
				return;
			}
			setConnections((current) => current.map((connection) => (connection.id === id ? { ...connection, active: false, revokedAt: new Date().toISOString() } : connection)));
			setConfirmation(null);
			setShowInactive(true);
			if (result.cleanupPending) setNotice("Access is revoked. App cleanup will retry automatically. You can also retry cleanup now.");
			const refreshed = await getConnectedMcpApps();
			if (!refreshed.error) setConnections(refreshed.connections);
		} catch {
			setError("Access could not be revoked. Try again.");
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
				<Card.Description>Manage which apps can access your creators. Revoking a connection stops its access immediately.</Card.Description>
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
				{error && (
					<Alert status='danger' role='alert'>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>Connection update failed</Alert.Title>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
				{notice && (
					<Alert status='warning' role='status'>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>Access revoked</Alert.Title>
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
					<Button size='sm' variant='tertiary' className='self-start' aria-expanded={showInactive} onPress={() => setShowInactive((value) => !value)}>
						{showInactive ? "Hide inactive connections" : `Show inactive connections (${inactiveConnections.length})`}
					</Button>
				)}
				{visibleConnections.length > 0 && (
					<Table className='min-w-0 w-full'>
						<Table.ScrollContainer className='max-h-80 overflow-auto'>
							<Table.Content aria-label='Connected AI apps' className='w-full min-w-[640px] table-fixed'>
								<Table.Header className='sticky top-0 z-10 bg-surface-secondary'>
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
													<Button size='sm' variant='tertiary' aria-label={`Details for ${connection.clientName}`} aria-expanded={detailsId === connection.id} onPress={() => setDetailsId(detailsId === connection.id ? null : connection.id)}>
														Details
													</Button>
													<Button size='sm' variant={connection.active ? "danger-soft" : "tertiary"} isDisabled={pending !== null} aria-label={`${connection.active ? "Revoke" : "Retry cleanup for"} ${connection.clientName}`} onPress={() => setConfirmation(connection.id)}>
														{connection.active ? "Revoke" : "Retry cleanup"}
													</Button>
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
					<section aria-label={`Connection details for ${selectedConnection.clientName}`} className='space-y-2 rounded-lg bg-surface-secondary p-3 text-sm'>
						<div className='flex items-center justify-between gap-2'>
							<h3 className='font-medium'>{selectedConnection.clientName} details</h3>
							<Button size='sm' variant='tertiary' onPress={() => setDetailsId(null)}>
								Close details
							</Button>
						</div>
						<p className='break-all text-xs text-muted'>Client ID: {selectedConnection.clientId}</p>
						<p className='text-muted'>Creators: {selectedConnection.creatorIds.join(", ")}</p>
						{(selectedConnection.creatorPermissions ?? selectedConnection.creatorIds.map((creatorId) => ({ creatorId, scopes: selectedConnection.scopes }))).map((creator) => (
							<p key={creator.creatorId} className='break-words text-xs text-muted'>
								Permissions for {creator.creatorId}: {creator.scopes.join(", ")}
							</p>
						))}
					</section>
				)}
				{confirmation && (
					<Alert status='warning'>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>Revoke this app&apos;s access?</Alert.Title>
							<Alert.Description>It will need your approval to connect again.</Alert.Description>
							<div className='mt-3 flex flex-wrap gap-2'>
								<Button size='sm' variant='danger' isPending={pending === confirmation} isDisabled={pending !== null} onPress={() => void revoke(confirmation)}>
									Confirm revoke
								</Button>
								<Button size='sm' variant='tertiary' isDisabled={pending !== null} onPress={() => setConfirmation(null)}>
									Cancel
								</Button>
							</div>
						</Alert.Content>
					</Alert>
				)}
			</Card.Content>
		</Card>
	);
}
