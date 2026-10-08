"use client";
import { useState } from "react";
import { Card, Table, Chip } from "@heroui/react";
import type { McpMetricsSnapshot } from "@/app/lib/mcpMetrics";
export default function AdminMcpMetrics({ metrics }: { metrics: McpMetricsSnapshot }) {
	const [sort, setSort] = useState<{ column: string; direction: "ascending" | "descending" }>({ column: "calls", direction: "descending" });
	const rows = Object.entries(metrics.tools)
		.filter(([, tool]) => tool.started_total > 0)
		.sort(([a, x], [b, y]) => {
			const order = sort.column === "name" ? a.localeCompare(b) : x.started_total - y.started_total;
			return (sort.direction === "ascending" ? order : -order) || a.localeCompare(b);
		});
	const cards = [
		["Calls", metrics.calls.started_total],
		["Succeeded", metrics.calls.success_total],
		["Denied", metrics.calls.denied_total],
		["Failed", metrics.calls.error_total],
		["Cancelled", metrics.calls.cancelled_total],
		["In flight", metrics.calls.inFlight],
	] as const;
	return (
		<Card>
			<Card.Header>
				<h2 className='text-lg font-semibold'>MCP activity</h2>
				<Card.Description>This process, since {metrics.processStartedAt}. Deployments reset these counters. Historical connection activity remains in the audit history.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4'>
				<div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6'>
					{cards.map(([label, value]) => (
						<div key={label} className='rounded-lg border border-border p-3'>
							<p className='text-xs text-muted'>{label}</p>
							<p className='text-xl font-semibold tabular-nums'>{value.toLocaleString()}</p>
						</div>
					))}
				</div>
				<p className='text-sm text-muted'>Average duration: {metrics.duration.count ? `${((metrics.duration.seconds_sum / metrics.duration.count) * 1000).toFixed(1)} ms` : "No completed calls"}. Windowed rates and histogram latency are available in Grafana.</p>
				<div className='flex flex-wrap gap-2'>
					{Object.entries(metrics.reasons)
						.filter(([, n]) => n > 0)
						.map(([reason, n]) => (
							<Chip key={reason} variant='tertiary'>
								{reason.replace(/_total$/, "")}: {n}
							</Chip>
						))}
				</div>
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='MCP tool usage' sortDescriptor={sort} onSortChange={(value) => setSort({ column: String(value.column), direction: value.direction })}>
							<Table.Header>
								<Table.Column id='name' isRowHeader allowsSorting>
									Tool
								</Table.Column>
								<Table.Column id='calls' allowsSorting>
									Calls
								</Table.Column>
								<Table.Column>Success</Table.Column>
								<Table.Column>Denied</Table.Column>
								<Table.Column>Failed</Table.Column>
								<Table.Column>Average</Table.Column>
								<Table.Column>Last used</Table.Column>
							</Table.Header>
							<Table.Body renderEmptyState={() => <p className='p-4 text-muted'>No tool calls recorded.</p>}>
								{rows.map(([name, tool]) => (
									<Table.Row key={name} id={name}>
										<Table.Cell>{name}</Table.Cell>
										<Table.Cell>{tool.started_total}</Table.Cell>
										<Table.Cell>{tool.success_total}</Table.Cell>
										<Table.Cell>{tool.denied_total}</Table.Cell>
										<Table.Cell>{tool.error_total}</Table.Cell>
										<Table.Cell>{tool.duration.count ? `${((tool.duration.seconds_sum / tool.duration.count) * 1000).toFixed(1)} ms` : "—"}</Table.Cell>
										<Table.Cell>{tool.lastUsedAt ?? "—"}</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			</Card.Content>
		</Card>
	);
}
