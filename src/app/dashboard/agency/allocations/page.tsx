import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowLeft, IconCalendarClock, IconLicense, IconTrash, IconUserCheck } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import { getAgencyOverviewAction, removeAgencyLicenseFormAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import { Alert, Button, Card, Chip, ProgressBar, Table } from "@components/heroui-client";

export const dynamic = "force-dynamic";

function label(value: string) {
	return value
		.split("_")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export default async function AgencyAllocationsPage() {
	const user = await validateAuth();
	if (!user) redirect("/login?returnUrl=%2Fdashboard%2Fagency%2Fallocations");
	const overview = await getAgencyOverviewAction();
	const utilization = overview.account.creatorSeatLimit === 0 ? 0 : Math.round((overview.occupiedSeats / overview.account.creatorSeatLimit) * 100);

	return (
		<DashboardNavbar user={user} title='Creator seat allocations' tagline='Control which linked creators receive agency-sponsored Pro'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				<div>
					<Link href='/dashboard/agency' className='inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-foreground'>
						<IconArrowLeft aria-hidden='true' size={18} />
						Back to agency dashboard
					</Link>
				</div>
				<Alert status='accent'>
					<IconCalendarClock aria-hidden='true' />
					<Alert.Content>
						<Alert.Title>Seven-day removal grace</Alert.Title>
						<Alert.Description>Scheduling removal keeps the creator&apos;s Pro access active and the seat occupied for seven days. Creator data and creator-owned benefits are never deleted.</Alert.Description>
					</Alert.Content>
				</Alert>

				<div className='grid gap-4 md:grid-cols-2'>
					<Card variant='secondary'>
						<Card.Header className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
								<IconLicense aria-hidden='true' size={20} />
							</div>
							<div>
								<Card.Description>Creator seats</Card.Description>
								<Card.Title className='text-3xl'>
									{overview.occupiedSeats} / {overview.account.creatorSeatLimit}
								</Card.Title>
							</div>
						</Card.Header>
					</Card>
					<Card variant='secondary'>
						<Card.Header className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-success/10 text-success'>
								<IconUserCheck aria-hidden='true' size={20} />
							</div>
							<div>
								<Card.Description>Available now</Card.Description>
								<Card.Title className='text-3xl'>{Math.max(0, overview.account.creatorSeatLimit - overview.occupiedSeats)}</Card.Title>
							</div>
						</Card.Header>
					</Card>
				</div>

				<Card>
					<Card.Header>
						<Card.Title>Seat utilization</Card.Title>
						<Card.Description>Active allocations and allocations in grace count toward the contract limit.</Card.Description>
					</Card.Header>
					<Card.Content>
						<ProgressBar aria-label='Agency creator seat utilization' maxValue={100} value={utilization}>
							<ProgressBar.Output />
							<ProgressBar.Track>
								<ProgressBar.Fill />
							</ProgressBar.Track>
						</ProgressBar>
					</Card.Content>
				</Card>

				<Card>
					<Card.Header>
						<Card.Title>Allocation ledger</Card.Title>
						<Card.Description>Every creator seat remains visible through its complete allocation lifecycle.</Card.Description>
					</Card.Header>
					<Card.Content>
						{overview.allocations.length === 0 ? (
							<div className='rounded-2xl bg-surface-secondary p-8 text-center text-sm text-muted'>No creator seats have been allocated.</div>
						) : (
							<Table variant='secondary'>
								<Table.ScrollContainer>
									<Table.Content aria-label='Creator seat allocations' className='min-w-[760px]'>
										<Table.Header>
											<Table.Column isRowHeader>Creator</Table.Column>
											<Table.Column>Status</Table.Column>
											<Table.Column>Effective</Table.Column>
											<Table.Column>Ends</Table.Column>
											<Table.Column className='text-end'>Action</Table.Column>
										</Table.Header>
										<Table.Body>
											{overview.allocations.map((allocation) => (
												<Table.Row key={allocation.id} id={allocation.id} textValue={allocation.creatorId}>
													<Table.Cell>
														<div>
															<p className='font-medium'>{allocation.creatorId}</p>
															<p className='text-xs text-muted'>{allocation.sourceReference}</p>
														</div>
													</Table.Cell>
													<Table.Cell>
														<Chip size='sm' color={allocation.status === "active" ? "success" : allocation.status === "removal_scheduled" ? "warning" : "default"} variant='soft'>
															{label(allocation.status)}
														</Chip>
													</Table.Cell>
													<Table.Cell>
														<span className='text-sm'>{allocation.effectiveAt.toLocaleDateString()}</span>
													</Table.Cell>
													<Table.Cell>
														<span className='text-sm text-muted'>{allocation.endsAt ? allocation.endsAt.toLocaleString() : "—"}</span>
													</Table.Cell>
													<Table.Cell className='text-right'>
														{allocation.status === "active" ? (
															<form action={removeAgencyLicenseFormAction}>
																<input type='hidden' name='allocationId' value={allocation.id} />
																<Button type='submit' size='sm' variant='danger-soft'>
																	<IconTrash aria-hidden='true' size={16} />
																	Schedule removal
																</Button>
															</form>
														) : (
															<span className='text-sm text-muted'>No action</span>
														)}
													</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table.Content>
								</Table.ScrollContainer>
							</Table>
						)}
					</Card.Content>
				</Card>
			</div>
		</DashboardNavbar>
	);
}
