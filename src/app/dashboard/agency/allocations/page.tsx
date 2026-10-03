import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowLeft, IconCalendarClock, IconLicense, IconTrash, IconUserCheck } from "@tabler/icons-react";
import { getAgencyOverviewAction, removeAgencyLicenseFormAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import { AlertContent, AlertDescription, AlertRoot, AlertTitle, Button, CardContent, CardDescription, CardHeader, CardRoot, CardTitle, Chip, ProgressBarFill, ProgressBarOutput, ProgressBarRoot, ProgressBarTrack, TableBody, TableCell, TableColumn, TableContent, TableHeader, TableRoot, TableRow, TableScrollContainer } from "@components/heroui-client";
import { getDashboardNavbarUser } from "@/auth/navigation-user";

export const dynamic = "force-dynamic";

function label(value: string) {
	return value
		.split("_")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export default async function AgencyAllocationsPage() {
	const user = await getDashboardNavbarUser();
	if (!user) redirect("/login?returnUrl=%2Fdashboard%2Fagency%2Fallocations");
	const overview = await getAgencyOverviewAction();
	const utilization = overview.account.creatorSeatLimit === 0 ? 0 : Math.round((overview.occupiedSeats / overview.account.creatorSeatLimit) * 100);

	return (
		<DashboardNavbar user={user} title='Creator seat allocations' tagline='Control which linked creators receive agency-sponsored Pro' organizationId={overview.account.organizationId}>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				<div>
					<Link href='/dashboard/agency' className='inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-foreground'>
						<IconArrowLeft aria-hidden='true' size={18} />
						Back to agency dashboard
					</Link>
				</div>
				<AlertRoot status='accent'>
					<IconCalendarClock aria-hidden='true' />
					<AlertContent>
						<AlertTitle>Seven-day removal grace</AlertTitle>
						<AlertDescription>Scheduling removal keeps the creator&apos;s Pro access active and the seat occupied for seven days. Creator data and creator-owned benefits are never deleted.</AlertDescription>
					</AlertContent>
				</AlertRoot>

				<div className='grid gap-4 md:grid-cols-2'>
					<CardRoot variant='secondary'>
						<CardHeader className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
								<IconLicense aria-hidden='true' size={20} />
							</div>
							<div>
								<CardDescription>Creator seats</CardDescription>
								<CardTitle className='text-3xl'>
									{overview.occupiedSeats} / {overview.account.creatorSeatLimit}
								</CardTitle>
							</div>
						</CardHeader>
					</CardRoot>
					<CardRoot variant='secondary'>
						<CardHeader className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-success/10 text-success'>
								<IconUserCheck aria-hidden='true' size={20} />
							</div>
							<div>
								<CardDescription>Available now</CardDescription>
								<CardTitle className='text-3xl'>{Math.max(0, overview.account.creatorSeatLimit - overview.occupiedSeats)}</CardTitle>
							</div>
						</CardHeader>
					</CardRoot>
				</div>

				<CardRoot>
					<CardHeader>
						<CardTitle>Seat utilization</CardTitle>
						<CardDescription>Active allocations and allocations in grace count toward the contract limit.</CardDescription>
					</CardHeader>
					<CardContent>
						<ProgressBarRoot aria-label='Agency creator seat utilization' maxValue={100} value={utilization}>
							<ProgressBarOutput />
							<ProgressBarTrack>
								<ProgressBarFill />
							</ProgressBarTrack>
						</ProgressBarRoot>
					</CardContent>
				</CardRoot>

				<CardRoot>
					<CardHeader>
						<CardTitle>Allocation ledger</CardTitle>
						<CardDescription>Every creator seat remains visible through its complete allocation lifecycle.</CardDescription>
					</CardHeader>
					<CardContent>
						{overview.allocations.length === 0 ? (
							<div className='rounded-2xl bg-surface-secondary p-8 text-center text-sm text-muted'>No creator seats have been allocated.</div>
						) : (
							<TableRoot variant='secondary'>
								<TableScrollContainer>
									<TableContent aria-label='Creator seat allocations' className='min-w-[760px]'>
										<TableHeader>
											<TableColumn isRowHeader>Creator</TableColumn>
											<TableColumn>Status</TableColumn>
											<TableColumn>Effective</TableColumn>
											<TableColumn>Ends</TableColumn>
											<TableColumn className='text-end'>Action</TableColumn>
										</TableHeader>
										<TableBody>
											{overview.allocations.map((allocation) => (
												<TableRow key={allocation.id} id={allocation.id} textValue={allocation.creatorId}>
													<TableCell>
														<div>
															<p className='font-medium'>{allocation.creatorId}</p>
															<p className='text-xs text-muted'>{allocation.sourceReference}</p>
														</div>
													</TableCell>
													<TableCell>
														<Chip size='sm' color={allocation.status === "active" ? "success" : allocation.status === "removal_scheduled" ? "warning" : "default"} variant='soft'>
															{label(allocation.status)}
														</Chip>
													</TableCell>
													<TableCell>
														<span className='text-sm'>{allocation.effectiveAt.toLocaleDateString()}</span>
													</TableCell>
													<TableCell>
														<span className='text-sm text-muted'>{allocation.endsAt ? allocation.endsAt.toLocaleString() : "—"}</span>
													</TableCell>
													<TableCell className='text-right'>
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
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</TableContent>
								</TableScrollContainer>
							</TableRoot>
						)}
					</CardContent>
				</CardRoot>
			</div>
		</DashboardNavbar>
	);
}
