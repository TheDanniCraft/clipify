import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowRight, IconBuildingCommunity, IconCheck, IconExternalLink, IconLicense, IconLink, IconLockAccess, IconUsersGroup } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import { allocateAgencyLicenseFormAction, getAgencyOverviewAction, proposeAgencyLinkFormAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import { Button, Checkbox, Chip, Input, Label, TextField } from "@components/heroui-client";
import { Alert, Card, ProgressBar } from "@components/heroui-server";
import { PERMISSIONS } from "@/auth/permissions";

export const dynamic = "force-dynamic";

function label(value: string) {
	return value
		.split(/[-:]/)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export default async function AgencyDashboardPage({ searchParams }: { searchParams: Promise<{ creator?: string | string[]; error?: string | string[]; allocated?: string | string[] }> }) {
	const user = await validateAuth();
	if (!user) redirect("/login?returnUrl=%2Fdashboard%2Fagency");
	const params = await searchParams;
	const requestedCreator = params.creator;
	const overview = await getAgencyOverviewAction(typeof requestedCreator === "string" ? requestedCreator : undefined);
	const creatorContext = overview.creatorContext;
	const availableSeats = Math.max(0, overview.account.creatorSeatLimit - overview.occupiedSeats);
	const utilization = overview.account.creatorSeatLimit === 0 ? 0 : Math.round((overview.occupiedSeats / overview.account.creatorSeatLimit) * 100);
	const permissionGroups = Object.entries(
		PERMISSIONS.reduce<Record<string, string[]>>((groups, permission) => {
			const [resource, action] = permission.split(":");
			(groups[resource] ??= []).push(action);
			return groups;
		}, {}),
	);

	return (
		<DashboardNavbar user={user} title='Agency dashboard' tagline='Manage creator access, staff, and Pro seat allocation'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				{params.allocated === "1" ? (
					<Alert status='success'>
						<IconCheck aria-hidden='true' />
						<Alert.Content>
							<Alert.Description>Creator Pro seat allocated.</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}
				{typeof params.error === "string" ? (
					<Alert status='danger'>
						<Alert.Content>
							<Alert.Title>Allocation failed</Alert.Title>
							<Alert.Description>{label(params.error)}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<div className='grid gap-4 md:grid-cols-3'>
					<Card variant='secondary'>
						<Card.Header>
							<Card.Description>Seat plan</Card.Description>
							<Card.Title className='text-3xl'>{overview.account.creatorSeatLimit}</Card.Title>
						</Card.Header>
						<Card.Footer className='text-sm text-muted'>Contracted creator seats</Card.Footer>
					</Card>
					<Card variant='secondary'>
						<Card.Header>
							<Card.Description>Occupied</Card.Description>
							<Card.Title className='text-3xl'>{overview.occupiedSeats}</Card.Title>
						</Card.Header>
						<Card.Footer className='text-sm text-muted'>Active or in removal grace</Card.Footer>
					</Card>
					<Card variant='secondary'>
						<Card.Header>
							<Card.Description>Available</Card.Description>
							<Card.Title className='text-3xl'>{availableSeats}</Card.Title>
						</Card.Header>
						<Card.Footer className='text-sm text-muted'>Ready to allocate</Card.Footer>
					</Card>
				</div>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconLicense aria-hidden='true' size={20} />
						</div>
						<div className='flex-1'>
							<Card.Title>Creator seat utilization</Card.Title>
							<Card.Description>Team members never consume creator seats. A scheduled removal continues to occupy its seat through the seven-day grace period.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<ProgressBar aria-label='Creator seat utilization' maxValue={100} value={utilization}>
							<ProgressBar.Output />
							<ProgressBar.Track>
								<ProgressBar.Fill />
							</ProgressBar.Track>
						</ProgressBar>
					</Card.Content>
				</Card>

				<div className='grid gap-4 md:grid-cols-3'>
					<Link href='/dashboard/agency/allocations' className='group rounded-2xl border border-default bg-surface p-5 transition-colors hover:bg-surface-secondary'>
						<IconLicense className='mb-4 text-accent' size={22} />
						<div className='flex items-center justify-between gap-3 font-semibold'>
							Manage allocations
							<IconArrowRight className='transition-transform group-hover:translate-x-1' size={18} />
						</div>
						<p className='mt-1 text-sm text-muted'>Schedule removals and review grace periods.</p>
					</Link>
					<Link href={`/dashboard/settings/team?organization=${encodeURIComponent(overview.account.organizationId)}`} className='group rounded-2xl border border-default bg-surface p-5 transition-colors hover:bg-surface-secondary'>
						<IconUsersGroup className='mb-4 text-accent' size={22} />
						<div className='flex items-center justify-between gap-3 font-semibold'>
							Agency team
							<IconArrowRight className='transition-transform group-hover:translate-x-1' size={18} />
						</div>
						<p className='mt-1 text-sm text-muted'>Invite staff without using creator seats.</p>
					</Link>
					<Link href={`/dashboard/settings/roles?organization=${encodeURIComponent(overview.account.organizationId)}`} className='group rounded-2xl border border-default bg-surface p-5 transition-colors hover:bg-surface-secondary'>
						<IconLockAccess className='mb-4 text-accent' size={22} />
						<div className='flex items-center justify-between gap-3 font-semibold'>
							Agency roles
							<IconArrowRight className='transition-transform group-hover:translate-x-1' size={18} />
						</div>
						<p className='mt-1 text-sm text-muted'>Define what agency staff can manage.</p>
					</Link>
				</div>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconBuildingCommunity aria-hidden='true' size={20} />
						</div>
						<div>
							<h2 className='font-semibold'>Creator management</h2>
							<Card.Description>Switch between accepted creator relationships without adding agency staff directly to the creator&apos;s team.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						{creatorContext.options.length ? (
							<nav className='flex flex-wrap gap-2' aria-label='Linked creator context'>
								{creatorContext.options.map((link) => (
									<Link key={link.id} href={`/dashboard/agency?creator=${encodeURIComponent(link.creatorOrganizationId)}`} aria-current={creatorContext.selected?.id === link.id ? "page" : undefined} className={`inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors ${creatorContext.selected?.id === link.id ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-foreground hover:bg-surface-tertiary"}`}>
										{link.creatorOrganizationId}
									</Link>
								))}
							</nav>
						) : (
							<div className='rounded-2xl bg-surface-secondary p-5 text-sm text-muted'>No accepted creator links yet.</div>
						)}
					</Card.Content>
				</Card>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconLink aria-hidden='true' size={20} />
						</div>
						<div>
							<Card.Title>Request creator access</Card.Title>
							<Card.Description>The creator must approve the request and may narrow the requested permission ceiling.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<form action={proposeAgencyLinkFormAction} className='flex flex-col gap-5'>
							<TextField name='creatorOrganizationId' isRequired>
								<Label>Creator account ID</Label>
								<Input variant='secondary' placeholder='Creator organization ID' />
							</TextField>
							<div className='grid gap-4 lg:grid-cols-2'>
								{permissionGroups.map(([resource, actions]) => (
									<fieldset key={resource} className='rounded-2xl bg-surface-secondary p-4'>
										<legend className='px-1 text-sm font-semibold'>{label(resource)}</legend>
										<div className='mt-2 grid gap-2 sm:grid-cols-2'>
											{actions.map((action) => {
												const permission = `${resource}:${action}`;
												return (
													<Checkbox key={permission} name='permission' value={permission}>
														{label(action)}
													</Checkbox>
												);
											})}
										</div>
									</fieldset>
								))}
							</div>
							<div className='flex justify-end'>
								<Button type='submit' variant='primary'>
									<IconExternalLink aria-hidden='true' size={18} />
									Send access request
								</Button>
							</div>
						</form>
					</Card.Content>
				</Card>

				<Card>
					<Card.Header>
						<Card.Title>Linked creators</Card.Title>
						<Card.Description>Review relationship status and allocate contracted Pro seats to approved creators.</Card.Description>
					</Card.Header>
					<Card.Content className='flex flex-col gap-3'>
						{overview.links.length === 0 ? (
							<div className='rounded-2xl bg-surface-secondary p-5 text-center text-sm text-muted'>No creator relationships yet.</div>
						) : (
							overview.links.map((link) => {
								const hasAllocation = overview.allocations.some((allocation) => allocation.linkId === link.id && ["active", "removal_scheduled"].includes(allocation.status));
								return (
									<div key={link.id} className='rounded-2xl bg-surface-secondary p-4'>
										<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
											<div className='min-w-0'>
												<p className='truncate font-medium'>{link.creatorOrganizationId}</p>
												<div className='mt-1 flex flex-wrap items-center gap-2'>
													<Chip size='sm' color={link.status === "accepted" ? "success" : link.status === "revoked" ? "danger" : "warning"} variant='soft'>
														{label(link.status)}
													</Chip>
													{hasAllocation ? (
														<Chip size='sm' color='accent' variant='soft'>
															Pro allocated
														</Chip>
													) : null}
												</div>
											</div>
											{link.status === "accepted" && !hasAllocation ? (
												<form action={allocateAgencyLicenseFormAction} className='flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row'>
													<input type='hidden' name='linkId' value={link.id} />
													<input type='hidden' name='creatorOrganizationId' value={link.creatorOrganizationId} />
													<TextField className='flex-1' name='sourceReference' isRequired aria-label='Commercial allocation reference'>
														<Input variant='secondary' placeholder='Commercial allocation reference' />
													</TextField>
													<Button type='submit' variant='secondary'>
														Allocate Pro seat
													</Button>
												</form>
											) : null}
										</div>
									</div>
								);
							})
						)}
					</Card.Content>
				</Card>
			</div>
		</DashboardNavbar>
	);
}
