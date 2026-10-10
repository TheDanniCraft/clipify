"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Chip, Label, ListBox, Select, Spinner, Table } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { IconActivity, IconHistory, IconRefresh } from "@tabler/icons-react";
import { getConnectedMcpActivityPage, getMcpActivityCreators } from "@/app/actions/mcp-connections";
import { mcpOperationLabels as operationLabels } from "@lib/mcpOperationLabels";
import type { McpActivityItem } from "@lib/mcpConnection";

export default function McpActivityPanel() {
	const [available, setAvailable] = useState<boolean | null>(null);
	const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);
	const [creatorId, setCreatorId] = useState("");
	const [items, setItems] = useState<McpActivityItem[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const [refresh, setRefresh] = useState(0);
	const generation = useRef(0);
	useEffect(() => {
		let active = true;
		const requests = generation;
		void getMcpActivityCreators()
			.then((result) => {
				if (!active) return;
				setAvailable(result.available);
				setCreators(result.creators);
				setError(result.error);
				setCreatorId(result.creators[0]?.id ?? "");
				if (!result.creators.length) setLoading(false);
			})
			.catch(() => {
				if (!active) return;
				setAvailable(true);
				setError("Creator activity access could not be loaded. Refresh and try again.");
				setLoading(false);
			});
		return () => {
			active = false;
			requests.current++;
		};
	}, []);
	useEffect(() => {
		if (!creatorId) return;
		const requests = generation;
		const current = ++requests.current;
		void getConnectedMcpActivityPage({ creatorId, limit: 25 })
			.then((result) => {
				if (generation.current !== current) return;
				setItems(result.error ? [] : result.items);
				setCursor(result.error ? null : result.nextCursor);
				setError(result.error);
				setLoading(false);
			})
			.catch(() => {
				if (generation.current !== current) return;
				setError("Activity could not be loaded. Refresh and try again.");
				setLoading(false);
			});
		return () => {
			requests.current++;
		};
	}, [creatorId, refresh]);
	function resetHistory() {
		generation.current++;
		setItems([]);
		setCursor(null);
		setError(undefined);
		setLoading(true);
	}
	async function loadOlder() {
		if (!cursor || loading) return;
		const current = generation.current;
		setLoading(true);
		try {
			const result = await getConnectedMcpActivityPage({ creatorId, limit: 25, cursor });
			if (generation.current !== current) return;
			if (result.error) {
				setItems([]);
				setCursor(null);
				setError(result.error);
			} else {
				setItems((previous) => [...previous, ...result.items.filter((item) => !previous.some((existing) => existing.id === item.id))]);
				setCursor(result.nextCursor);
			}
		} catch {
			if (generation.current !== current) return;
			setItems([]);
			setCursor(null);
			setError("Activity could not be loaded. Refresh and try again.");
		} finally {
			if (generation.current === current) setLoading(false);
		}
	}
	if (available === false) return null;
	return (
		<Card className='p-0' role='region' aria-labelledby='mcp-activity-title'>
			<Card.Header className='gap-2 p-4'>
				<div className='flex items-center gap-3'>
					<span className='flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent'>
						<IconActivity size={22} aria-hidden='true' />
					</span>
					<h2 id='mcp-activity-title' className='text-lg font-semibold'>
						AI app activity
					</h2>
				</div>
				<Card.Description>Review what connected apps did and which requests were blocked. Activity follows your current creator access.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-3 px-4 pb-4'>
				{!!creators.length && (
					<div className='flex flex-col items-stretch gap-3 sm:flex-row sm:items-end'>
						<Select aria-label='Creator' fullWidth variant='secondary' value={creatorId || null} onChange={(next) => setCreatorId(String(next ?? ""))}>
							<Label>Creator</Label>
							<Select.Trigger>
								<Select.Value />
								<Select.Indicator />
							</Select.Trigger>
							<Select.Popover>
								<ListBox>
									{creators.map((creator) => (
										<ListBox.Item key={creator.id} id={creator.id} textValue={creator.name}>
											{creator.name}
											<ListBox.ItemIndicator />
										</ListBox.Item>
									))}
								</ListBox>
							</Select.Popover>
						</Select>
						<Button
							variant='secondary'
							aria-label='Refresh activity'
							isDisabled={loading}
							onPress={() => {
								resetHistory();
								setRefresh((value) => value + 1);
							}}
						>
							<IconRefresh size={18} aria-hidden='true' />
							Refresh
						</Button>
					</div>
				)}
				{error && (
					<Alert status='danger' role='alert'>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>Activity unavailable</Alert.Title>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
				{loading && (
					<div className='flex items-center gap-2 py-4 text-muted' role='status'>
						<Spinner size='sm' />
						<p>Loading activity…</p>
					</div>
				)}
				{!loading && !error && !items.length && (
					<EmptyState className='rounded-xl bg-surface-secondary py-4'>
						<EmptyState.Header>
							<EmptyState.Media variant='icon'>
								<IconHistory size={28} aria-hidden='true' />
							</EmptyState.Media>
							<EmptyState.Title>{creators.length ? "No activity yet" : "No creator activity access"}</EmptyState.Title>
							<EmptyState.Description>{creators.length ? "Activity will appear when an approved app uses Clipify tools." : "You need activity permission for a creator to inspect their app history."}</EmptyState.Description>
						</EmptyState.Header>
					</EmptyState>
				)}
				{items.length > 0 && (
					<Table variant='secondary'>
						<Table.ScrollContainer className='max-h-72 overflow-auto'>
							<Table.Content aria-label='AI app activity log' className='w-full min-w-[720px] table-fixed'>
								<Table.Header className='sticky top-0 z-10'>
									<Table.Column id='action' isRowHeader className='w-[26%]'>
										Action
									</Table.Column>
									<Table.Column id='app' className='w-[18%]'>
										App
									</Table.Column>
									<Table.Column id='creator' className='w-[18%]'>
										Creator
									</Table.Column>
									<Table.Column id='result' className='w-[15%]'>
										Result
									</Table.Column>
									<Table.Column id='time' className='w-[23%]'>
										Time
									</Table.Column>
								</Table.Header>
								<Table.Body>
									{items.map((item) => (
										<Table.Row key={item.id} id={item.id} textValue={operationLabels[item.tool] ?? "Unavailable tool"}>
											<Table.Cell className='break-words'>
												<span className='block text-sm font-medium'>{operationLabels[item.tool] ?? "Unavailable tool"}</span>
												<span className='text-xs text-muted'>{item.actor.name}</span>
											</Table.Cell>
											<Table.Cell className='break-words text-sm'>{item.client.name}</Table.Cell>
											<Table.Cell className='break-words text-sm'>{item.creator.name}</Table.Cell>
											<Table.Cell>
												<Chip size='sm' variant='soft' color={item.outcome === "success" ? "success" : item.outcome === "denied" ? "warning" : "danger"}>
													{item.outcome === "success" ? "Completed" : item.outcome === "denied" ? "Blocked" : "Failed"}
												</Chip>
											</Table.Cell>
											<Table.Cell>
												<time className='text-xs text-muted' dateTime={item.occurredAt}>
													{new Date(item.occurredAt).toLocaleString()}
												</time>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				)}

				{cursor && (
					<Button variant='secondary' isPending={loading} onPress={loadOlder}>
						Load older activity
					</Button>
				)}
			</Card.Content>
		</Card>
	);
}
