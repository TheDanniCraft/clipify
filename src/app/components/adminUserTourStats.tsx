"use client";
import { Card, Table } from "@heroui/react";
import type { UserTourStats } from "@lib/userTour";

export default function AdminUserTourStats({ stats }: { stats: UserTourStats }) {
	const percent = (value: number) => (stats.trackedAccounts ? `${(value * 100).toFixed(1)}%` : "—");
	const cards = [
		["Accounts with a guide", stats.trackedAccounts.toLocaleString()],
		["With recorded progress", stats.accountsWithProgress.toLocaleString()],
		["All guides completed", stats.completedAccounts.toLocaleString()],
		["Completion rate", percent(stats.completionRate)],
		["Average progress", percent(stats.averageProgress)],
	] as const;
	return (
		<Card role='region' aria-label='Onboarding guides'>
			<Card.Header>
				<h2 className='text-lg font-semibold'>Onboarding guides</h2>
				<Card.Description>Current saved progress. Percentages use accounts with a guide record. Skipped tasks do not count as completed; progress can include existing resources.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4'>
				<div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5'>
					{cards.map(([label, value]) => (
						<div key={label} className='rounded-lg border border-border p-3'>
							<p className='text-xs text-muted'>{label}</p>
							<p className='text-xl font-semibold tabular-nums'>{value}</p>
						</div>
					))}
				</div>
				<p className='text-sm text-muted'>
					{stats.untrackedAccounts.toLocaleString()} accounts have no saved guide record. {stats.completedTasks.toLocaleString()} completed tasks and {stats.skippedTasks.toLocaleString()} skipped tasks.
				</p>
				{stats.invalidProgressAccounts > 0 && (
					<p role='status' className='text-sm text-warning'>
						Unreadable guide records: {stats.invalidProgressAccounts.toLocaleString()}. Counted as incomplete.
					</p>
				)}
				{!stats.trackedAccounts ? (
					<p>No guide progress recorded yet.</p>
				) : (
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Onboarding completion by guide section' className='min-w-[900px]'>
								<Table.Header>
									<Table.Column isRowHeader>Guide section</Table.Column>
									<Table.Column>With progress</Table.Column>
									<Table.Column>Completed accounts</Table.Column>
									<Table.Column>Completion rate</Table.Column>
									<Table.Column>Average progress</Table.Column>
									<Table.Column>Skipped tasks</Table.Column>
								</Table.Header>
								<Table.Body>
									{Object.entries(stats.sections).map(([id, section]) => (
										<Table.Row key={id} id={id}>
											<Table.Cell>{section.title}</Table.Cell>
											<Table.Cell>{section.accountsWithProgress.toLocaleString()}</Table.Cell>
											<Table.Cell>{section.completedAccounts.toLocaleString()}</Table.Cell>
											<Table.Cell>{percent(section.completionRate)}</Table.Cell>
											<Table.Cell>{percent(section.averageProgress)}</Table.Cell>
											<Table.Cell>{section.skippedTasks.toLocaleString()}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				)}
			</Card.Content>
		</Card>
	);
}
