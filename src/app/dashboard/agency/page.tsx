import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowRight, IconBuildingCommunity, IconCheck, IconCreditCard, IconExternalLink, IconLicense, IconLink, IconUsersGroup } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import { allocateAgencyLicenseFormAction, changeAgencySeatQuantityFormAction, getAgencyOverviewAction, openAgencyBillingPortalFormAction, proposeAgencyLinkFormAction, startAgencyBillingFormAction } from "@/app/actions/agency";
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

async function loadAgencyOverview(requestedCreatorOrganizationId?: string) {
	try {
		return await getAgencyOverviewAction(requestedCreatorOrganizationId);
	} catch (error) {
		if (error instanceof Error && ["AGENCY_CONTEXT_REQUIRED", "ACTIVE_AGENCY_MEMBERSHIP_REQUIRED"].includes(error.message)) redirect("/dashboard?agency=unavailable");
		throw error;
	}
}

export default async function AgencyDashboardPage({ searchParams }: { searchParams: Promise<{ creator?: string | string[]; error?: string | string[]; allocated?: string | string[]; billing?: string | string[]; billingError?: string | string[] }> }) {
	const user = await validateAuth();
	if (!user) redirect("/login?returnUrl=%2Fdashboard%2Fagency");
	const params = await searchParams;
	const requestedCreator = params.creator;
	const overview = await loadAgencyOverview(typeof requestedCreator === "string" ? requestedCreator : undefined);
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
				{typeof params.billingError === "string" ? (
					<Alert status='danger'>
						<Alert.Content>
							<Alert.Title>Billing change failed</Alert.Title>
							<Alert.Description>{label(params.billingError)}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconCreditCard aria-hidden='true' size={20} />
						</div>
						<div className='flex-1'>
							<Card.Title>Agency billing</Card.Title>
							<Card.Description>Stripe controls paid capacity. Upgrades are prorated and charged now; permitted reductions start next billing period.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content className='space-y-4'>
						{overview.billing ? (
							<>
								<div className='grid gap-3 sm:grid-cols-3'>
									<div className='rounded-xl bg-surface-secondary p-4'>
										<p className='text-xs text-muted'>Billing status</p>
										<p className='font-semibold capitalize'>{overview.billing.status.replace("_", " ")}</p>
									</div>
									<div className='rounded-xl bg-surface-secondary p-4'>
										<p className='text-xs text-muted'>Creator seats</p>
										<p className='font-semibold tabular-nums'>
											{overview.billing.creatorSeatQuantity} <span className='text-xs font-normal text-muted'>(minimum {overview.billing.creatorSeatMinimum})</span>
										</p>
									</div>
									<div className='rounded-xl bg-surface-secondary p-4'>
										<p className='text-xs text-muted'>Runner seats</p>
										<p className='font-semibold tabular-nums'>
											{overview.billing.runnerSeatQuantity} <span className='text-xs font-normal text-muted'>(minimum {overview.billing.runnerSeatMinimum})</span>
										</p>
									</div>
								</div>
								<div className='grid gap-3 lg:grid-cols-2'>
									<form action={changeAgencySeatQuantityFormAction} className='flex items-end gap-2 rounded-xl bg-surface-secondary p-4'>
										<input type='hidden' name='kind' value='creator' />
										<TextField name='quantity' type='number' className='flex-1'>
											<Label>Creator-seat quantity</Label>
											<Input variant='secondary' min={Math.max(overview.billing.creatorSeatMinimum, overview.occupiedSeats)} defaultValue={String(overview.billing.pendingCreatorSeatQuantity ?? overview.billing.creatorSeatQuantity)} />
										</TextField>
										<Button type='submit' variant='secondary'>
											Update
										</Button>
									</form>
									<form action={changeAgencySeatQuantityFormAction} className='flex items-end gap-2 rounded-xl bg-surface-secondary p-4'>
										<input type='hidden' name='kind' value='runner' />
										<TextField name='quantity' type='number' className='flex-1'>
											<Label>Runner-seat quantity</Label>
											<Input variant='secondary' min={Math.max(overview.billing.runnerSeatMinimum, overview.occupiedRunnerSeats)} defaultValue={String(overview.billing.pendingRunnerSeatQuantity ?? overview.billing.runnerSeatQuantity)} />
										</TextField>
										<Button type='submit' variant='secondary'>
											Update
										</Button>
									</form>
								</div>
								<div className='flex justify-end'>
									{overview.billing.stripeSubscriptionId ? (
										<form action={openAgencyBillingPortalFormAction}>
											<Button type='submit' variant='secondary'>
												Manage invoices and payment methods
											</Button>
										</form>
									) : (
										<form action={startAgencyBillingFormAction}>
											<Button type='submit' variant='primary'>
												Start negotiated billing
											</Button>
										</form>
									)}
								</div>
							</>
						) : (
							<p className='text-sm text-muted'>Billing terms have not been configured. Contact Clipify to complete agency setup.</p>
						)}
					</Card.Content>
				</Card>

				<div className='grid gap-4 md:grid-cols-2'>
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
								const hasCreatorAllocation = overview.allocations.some((allocation) => allocation.linkId === link.id && allocation.product !== "runner" && ["active", "removal_scheduled"].includes(allocation.status));
								const hasRunnerAllocation = overview.allocations.some((allocation) => allocation.linkId === link.id && allocation.product === "runner" && ["active", "removal_scheduled"].includes(allocation.status));
								return (
									<div key={link.id} className='rounded-2xl bg-surface-secondary p-4'>
										<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
											<div className='min-w-0'>
												<p className='truncate font-medium'>{link.creatorOrganizationId}</p>
												<div className='mt-1 flex flex-wrap items-center gap-2'>
													<Chip size='sm' color={link.status === "accepted" ? "success" : link.status === "revoked" ? "danger" : "warning"} variant='soft'>
														{label(link.status)}
													</Chip>
													{hasCreatorAllocation ? (
														<Chip size='sm' color='accent' variant='soft'>
															Pro allocated
														</Chip>
													) : null}
													{hasRunnerAllocation ? (
														<Chip size='sm' color='accent' variant='soft'>
															Runner allocated
														</Chip>
													) : null}
												</div>
											</div>
											{link.status === "accepted" && (!hasCreatorAllocation || !hasRunnerAllocation) ? (
												<div className='flex w-full flex-col gap-2 sm:max-w-xl'>
													{[
														{ product: "creator_pro", actionLabel: "Allocate Pro seat", allocated: hasCreatorAllocation },
														{ product: "runner", actionLabel: "Allocate Runner seat", allocated: hasRunnerAllocation },
													]
														.filter((entry) => !entry.allocated)
														.map(({ product, actionLabel }) => (
															<form key={product} action={allocateAgencyLicenseFormAction} className='flex flex-col gap-2 sm:flex-row'>
																<input type='hidden' name='linkId' value={link.id} />
																<input type='hidden' name='creatorOrganizationId' value={link.creatorOrganizationId} />
																<input type='hidden' name='product' value={product} />
																<TextField className='flex-1' name='sourceReference' isRequired aria-label={`${actionLabel} commercial reference`}>
																	<Input variant='secondary' placeholder='Commercial allocation reference' />
																</TextField>
																<Button type='submit' variant='secondary'>
																	{actionLabel}
																</Button>
															</form>
														))}
												</div>
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
