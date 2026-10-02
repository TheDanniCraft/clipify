import { redirect } from "next/navigation";
import { IconCalendarClock, IconDatabase, IconRefresh, IconShieldLock } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import { Alert, Button, Card, Chip } from "@components/heroui-client";
import { getAuthActorContext } from "@/auth/session";
import { getAccountDeletionOverview, recoverAccountDeletion } from "@actions/subscription";

export default async function AccountRecoveryPage() {
	const actor = await getAuthActorContext();
	if (!actor) redirect("/login?returnUrl=%2Fdashboard%2Fsettings%2Faccount%2Frecovery");
	const user = actor.user;
	const request = await getAccountDeletionOverview();
	if (!request) redirect("/dashboard/settings");
	const requestId = request.id;

	async function recover() {
		"use server";
		await recoverAccountDeletion(requestId);
		redirect("/dashboard");
	}

	const purgeDate = request.purgeEligibleAt ? new Date(request.purgeEligibleAt) : null;

	return (
		<DashboardNavbar user={user} title='Recover account' tagline='Cancel deletion during the protected recovery period'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				<Alert status={request.recoveryPeriodEnded ? "danger" : "warning"}>
					<IconCalendarClock aria-hidden='true' />
					<Alert.Content>
						<Alert.Title>{request.recoveryPeriodEnded ? "Recovery period ended" : "Account suspended pending deletion"}</Alert.Title>
						<Alert.Description>{request.recoveryPeriodEnded ? "This account can no longer be restored through self-service recovery." : "Your resources are retained and can still be restored before permanent-erasure eligibility."}</Alert.Description>
					</Alert.Content>
				</Alert>

				<div className='grid gap-4 md:grid-cols-2'>
					<Card variant='secondary'>
						<Card.Header className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning'>
								<IconShieldLock aria-hidden='true' size={20} />
							</div>
							<div>
								<Card.Description>Deletion timing</Card.Description>
								<Card.Title>{request.choice === "paid_through" ? "After paid access" : "Immediate suspension"}</Card.Title>
							</div>
						</Card.Header>
						<Card.Footer>
							<Chip size='sm' color='warning' variant='soft'>
								Recovery protected
							</Chip>
						</Card.Footer>
					</Card>
					<Card variant='secondary'>
						<Card.Header className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
								<IconDatabase aria-hidden='true' size={20} />
							</div>
							<div>
								<Card.Description>Permanent-erasure eligibility</Card.Description>
								<Card.Title>{purgeDate ? purgeDate.toLocaleDateString() : "30 days after suspension"}</Card.Title>
							</div>
						</Card.Header>
						<Card.Footer className='text-sm text-muted'>{purgeDate ? purgeDate.toLocaleString() : "The exact date will be set when suspension begins."}</Card.Footer>
					</Card>
				</div>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconRefresh aria-hidden='true' size={20} />
						</div>
						<div>
							<Card.Title>Restore Clipify access</Card.Title>
							<Card.Description>Recovery restores dashboard, overlay, and integration access. It does not restart billing or reclaim an agency-sponsored seat that has already ended.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content className='flex flex-col gap-5'>
						<div className='rounded-2xl bg-surface-secondary p-5'>
							<p className='font-medium'>Security check required</p>
							<p className='mt-1 text-sm text-muted'>You must complete a normal sign-in and identity confirmation within the last five minutes. A recovery link never signs you in by itself.</p>
						</div>
						<div className='flex justify-end'>
							{request.recoveryPeriodEnded ? (
								<Button isDisabled variant='secondary'>
									Recovery unavailable
								</Button>
							) : (
								<form action={recover}>
									<Button type='submit' variant='primary'>
										<IconRefresh aria-hidden='true' size={18} />
										Recover my account
									</Button>
								</form>
							)}
						</div>
					</Card.Content>
				</Card>
			</div>
		</DashboardNavbar>
	);
}
