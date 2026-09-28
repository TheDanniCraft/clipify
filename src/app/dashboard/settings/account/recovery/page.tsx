import { redirect } from "next/navigation";
import { Button, Card } from "@heroui/react";
import DashboardNavbar from "@components/dashboardNavbar";
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

	return (
		<DashboardNavbar user={user} title='Recover account' tagline='Cancel deletion during the 30-day recovery period'>
			<Card className='mt-4'>
				<Card.Header>
					<p className='text-xl font-semibold'>Account suspended pending deletion</p>
					<p className='text-sm text-muted'>Your resources are retained. Recovery restores dashboard, overlay, and integration access, but does not restart billing or reclaim an agency allocation.</p>
				</Card.Header>
				<Card.Content className='space-y-4'>
					<div className='rounded-xl border border-default/60 bg-surface-secondary p-4 text-sm'>
						<p>
							Deletion choice: <strong>{request.choice === "paid_through" ? "after paid access" : "immediate"}</strong>
						</p>
						<p>
							Permanent-erasure eligibility: <strong>{request.purgeEligibleAt ? new Date(request.purgeEligibleAt).toLocaleString() : "30 days after suspension"}</strong>
						</p>
					</div>
					<p className='text-sm'>For security, recovery requires a normal sign-in and identity confirmation within the last five minutes. The recovery link itself never signs you in.</p>
					<form action={recover}>
						<Button type='submit' variant='primary'>
							Recover my account
						</Button>
					</form>
				</Card.Content>
			</Card>
		</DashboardNavbar>
	);
}
