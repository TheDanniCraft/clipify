"use client";
import { Card, Table, Link } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import type { McpClientStats } from "@/app/lib/mcpMetrics";
export default function AdminMcpClients({ stats }: { stats: McpClientStats | null }) {
	return (
		<Card>
			<Card.Header>
				<h2 className='text-lg font-semibold'>MCP client adoption</h2>
				<Card.Description>Application names are self-reported, not verified vendor identities. Registrations, current authorizations and retained tool activity are separate counts.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4'>
				{!stats ? (
					<p>Client statistics are currently unavailable.</p>
				) : (
					<>
						<p className='text-sm text-muted'>
							{stats.summary.registeredClients} registered clients · {stats.summary.authorizedClients} authorized clients · {stats.summary.activeClients30d} clients with calls in the last 30 days · {stats.summary.calls30d} retained calls. Custom apps are included. Historical usage is limited by audit retention.
						</p>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='MCP client adoption'>
									<Table.Header>
										<Table.Column isRowHeader>App name</Table.Column>
										<Table.Column>Registered</Table.Column>
										<Table.Column>Authorized</Table.Column>
										<Table.Column>Active connections</Table.Column>
										<Table.Column>Active clients (30d)</Table.Column>
										<Table.Column>Calls (30d)</Table.Column>
										<Table.Column>Last used</Table.Column>
									</Table.Header>
									<Table.Body renderEmptyState={() => <p className='p-4 text-muted'>No MCP clients recorded.</p>}>
										{stats.items.map((client) => (
											<Table.Row key={client.name} id={client.name}>
												<Table.Cell>{client.name}</Table.Cell>
												<Table.Cell>{client.registeredClients}</Table.Cell>
												<Table.Cell>{client.authorizedClients}</Table.Cell>
												<Table.Cell>{client.activeConnections}</Table.Cell>
												<Table.Cell>{client.activeClients30d}</Table.Cell>
												<Table.Cell>{client.calls30d}</Table.Cell>
												<Table.Cell>{client.lastUsedAt ?? "Never"}</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						<nav aria-label='MCP client pages' className='flex items-center justify-between gap-3'>
							{stats.page > 1 ? (
								<Link className={buttonVariants({ variant: "secondary" })} href={`/admin?mcpClientsPage=${stats.page - 1}`}>
									Previous
								</Link>
							) : (
								<span />
							)}
							<p className='text-sm text-muted'>
								Page {stats.page} of {Math.max(1, Math.ceil(stats.summary.applicationNames / stats.pageSize))}
							</p>
							{stats.page * stats.pageSize < stats.summary.applicationNames ? (
								<Link className={buttonVariants({ variant: "secondary" })} href={`/admin?mcpClientsPage=${stats.page + 1}`}>
									Next
								</Link>
							) : (
								<span />
							)}
						</nav>
					</>
				)}
			</Card.Content>
		</Card>
	);
}
