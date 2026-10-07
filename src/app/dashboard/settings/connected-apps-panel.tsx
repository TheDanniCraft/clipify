"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Chip, Spinner } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { IconPlugConnected, IconShieldCheck } from "@tabler/icons-react";
import { getConnectedMcpApps, revokeConnectedMcpApp } from "@/app/actions/mcp-connections";
import type { McpConnection } from "@lib/mcpConnection";

export default function ConnectedAppsPanel() {
	const [connections, setConnections] = useState<McpConnection[]>([]);
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
			if (result.cleanupPending) setNotice("Access is revoked. App cleanup will retry automatically. You can also retry cleanup now.");
			const refreshed = await getConnectedMcpApps();
			if (!refreshed.error) setConnections(refreshed.connections);
		} catch {
			setError("Access could not be revoked. Try again.");
		} finally {
			setPending(null);
		}
	}
	return (
		<Card className='p-0' aria-labelledby='connected-apps-title'>
			<Card.Header className='gap-2 p-6'>
				<div className='flex items-center gap-3'>
					<span className='flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent'>
						<IconPlugConnected size={22} aria-hidden='true' />
					</span>
					<h2 id='connected-apps-title' className='text-xl font-semibold'>
						Connected AI apps
					</h2>
				</div>
				<Card.Description>Manage which apps can access your creators. Revoking a connection stops its access immediately.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4 px-6 pb-6'>
				{loading ? (
					<div className='flex items-center gap-2 py-4 text-muted'>
						<Spinner size='sm' />
						<p>Loading connected apps…</p>
					</div>
				) : (
					!connections.length && (
						<EmptyState className='rounded-xl bg-surface-secondary py-8'>
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
				{connections.map((connection) => (
					<article key={connection.id} className='flex flex-col gap-4 rounded-xl border border-border p-4 sm:p-5'>
						<div className='flex items-start justify-between gap-3'>
							<div>
								<h3 className='font-semibold'>{connection.clientName}</h3>
								<p className='mt-1 break-all text-xs text-muted'>{connection.clientId}</p>
							</div>
							<Chip size='sm' variant='soft' color={connection.active ? "success" : "default"}>
								{connection.active ? "Active" : connection.revokedAt ? "Revoked" : "Expired"}
							</Chip>
						</div>
						<div className='flex flex-col gap-2 text-sm text-muted'>
							<p>Creators: {connection.creatorIds.join(", ")}</p>
							<p>Permissions: {connection.scopes.join(", ")}</p>
							<p>Expires: {new Date(connection.expiresAt).toLocaleDateString()}</p>
						</div>
						{confirmation === connection.id ? (
							<Alert status='warning'>
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>Revoke this app’s access?</Alert.Title>
									<Alert.Description>It will need your approval to connect again.</Alert.Description>
									<div className='mt-3 flex flex-wrap gap-2'>
										<Button size='sm' variant='danger' isPending={pending === connection.id} isDisabled={pending !== null} onPress={() => void revoke(connection.id)}>
											Confirm revoke
										</Button>
										<Button size='sm' variant='tertiary' isDisabled={pending !== null} onPress={() => setConfirmation(null)}>
											Cancel
										</Button>
									</div>
								</Alert.Content>
							</Alert>
						) : (
							<div className='flex justify-end'>
								<Button size='sm' variant={connection.active ? "danger-soft" : "tertiary"} isDisabled={pending !== null} aria-label={`${connection.active ? "Revoke" : "Retry cleanup for"} ${connection.clientName}`} onPress={() => setConfirmation(connection.id)}>
									{connection.active ? "Revoke access" : "Retry cleanup"}
								</Button>
							</div>
						)}
					</article>
				))}
			</Card.Content>
		</Card>
	);
}
