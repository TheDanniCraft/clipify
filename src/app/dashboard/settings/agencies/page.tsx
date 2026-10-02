import { redirect } from "next/navigation";
import { IconBuilding, IconCheck, IconLockAccess, IconShieldCheck, IconTrash } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import { acceptAgencyLinkFormAction, getCreatorAgencyLinksAction, revokeAgencyLinkFormAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import { Alert, Button, Card, Checkbox, Chip } from "@components/heroui-client";

export const dynamic = "force-dynamic";

function label(value: string) {
	return value
		.split(/[-:]/)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export default async function CreatorAgencySettingsPage() {
	const user = await validateAuth();
	if (!user) redirect("/login?returnUrl=%2Fdashboard%2Fsettings%2Fagencies");
	const links = await getCreatorAgencyLinksAction();

	return (
		<DashboardNavbar user={user} title='Agency access' tagline='Approve and control external management of your creator account'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				<Alert status='accent'>
					<IconShieldCheck aria-hidden='true' />
					<Alert.Content>
						<Alert.Title>You stay in control</Alert.Title>
						<Alert.Description>An agency can use only the permissions you approve. Revoking access takes effect on its next operation and never transfers ownership of your content or account.</Alert.Description>
					</Alert.Content>
				</Alert>

				{links.length === 0 ? (
					<Card>
						<Card.Header className='items-center text-center'>
							<div className='mb-2 flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent'>
								<IconBuilding aria-hidden='true' size={24} />
							</div>
							<Card.Title>No agency requests</Card.Title>
							<Card.Description>When an agency requests access, you can review its permission ceiling here before anything is granted.</Card.Description>
						</Card.Header>
					</Card>
				) : (
					links.map(({ link, agencyName }) => {
						const isProposed = link.status === "proposed";
						const isRevoked = link.status === "revoked";
						const grouped = Object.entries(Object.groupBy(link.permissionCeiling, (permission) => permission.split(":")[0]));
						return (
							<Card key={link.id}>
								<Card.Header className='gap-3'>
									<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
										<IconBuilding aria-hidden='true' size={20} />
									</div>
									<div className='min-w-0 flex-1'>
										<Card.Title>{agencyName}</Card.Title>
										<Card.Description>{isProposed ? "Review this agency's requested access." : isRevoked ? "This agency can no longer access your account." : "This agency has approved delegated access."}</Card.Description>
									</div>
									<Chip color={isProposed ? "warning" : isRevoked ? "danger" : "success"} size='sm' variant='soft'>
										{label(link.status)}
									</Chip>
								</Card.Header>
								<Card.Content className='flex flex-col gap-5'>
									{isProposed ? (
										<form action={acceptAgencyLinkFormAction} className='flex flex-col gap-5'>
											<input type='hidden' name='linkId' value={link.id} />
											<div>
												<p className='font-medium'>Choose the permission ceiling</p>
												<p className='text-sm text-muted'>Uncheck anything the agency should not be allowed to do. It can assign narrower roles to its staff, but never exceed this ceiling.</p>
											</div>
											<div className='grid gap-4 md:grid-cols-2'>
												{grouped.map(([resource, permissions]) => (
													<fieldset key={resource} className='rounded-2xl bg-surface-secondary p-4'>
														<legend className='px-1 text-sm font-semibold'>{label(resource)}</legend>
														<div className='mt-2 grid gap-2'>
															{permissions?.map((permission) => (
																<Checkbox key={permission} name='permission' value={permission} defaultSelected>
																	{label(permission.split(":")[1])}
																</Checkbox>
															))}
														</div>
													</fieldset>
												))}
											</div>
											<div className='flex justify-end'>
												<Button type='submit' variant='primary'>
													<IconCheck aria-hidden='true' size={18} />
													Approve agency access
												</Button>
											</div>
										</form>
									) : (
										<div>
											<div className='mb-3 flex items-center gap-2 font-medium'>
												<IconLockAccess aria-hidden='true' size={18} />
												Approved permissions
											</div>
											<div className='flex flex-wrap gap-2'>
												{link.permissionCeiling.length ? (
													link.permissionCeiling.map((permission) => (
														<Chip key={permission} size='sm' variant='secondary'>
															{permission}
														</Chip>
													))
												) : (
													<span className='text-sm text-muted'>No delegated permissions</span>
												)}
											</div>
										</div>
									)}
									{!isRevoked ? (
										<div className='flex justify-end border-t border-default pt-4'>
											<form action={revokeAgencyLinkFormAction}>
												<input type='hidden' name='linkId' value={link.id} />
												<Button type='submit' variant='danger-soft'>
													<IconTrash aria-hidden='true' size={17} />
													Revoke access
												</Button>
											</form>
										</div>
									) : null}
								</Card.Content>
							</Card>
						);
					})
				)}
			</div>
		</DashboardNavbar>
	);
}
