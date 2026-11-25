import DashboardShell from "@components/dashboardShell";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { PERMISSIONS, type Permission } from "@/auth/permissions";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { getDashboardNavbarUser } from "@/auth/navigation-user";
import { validateAuth } from "@actions/auth";
import { UserTourProvider } from "@components/user-tour/provider";
import SentryFeedbackWidget from "@components/SentryFeedbackWidget";
import { getUserTourProgress } from "@actions/userTour";
import DashboardBillingNotice from "@components/dashboardBillingNotice";
import { findOverdueProSubscription } from "@lib/overdueSubscription";
import { getTrialEndingNotice, type BillingNotice } from "@lib/billingNotice";
import DashboardContentHost from "@components/dashboardContentHost";
import { getPendingDashboardContent } from "@lib/dashboardContent";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	await connection();
	const creator = await validateAuth();
	const user = creator || (await getDashboardNavbarUser());
	const grant = creator ? await authorizeCreatorOperation({ creatorId: creator.id, resourceOwnerId: creator.id, permission: "creator:read" }) : null;
	const needed: Permission[] = ["creator:read", "overlay:read", "overlay:create", "overlay:update", "playlist:read", "gallery:read", "runner:read", "account:read", "member:read", "billing:read", "subscription:manage"];
	const permissions: Permission[] = grant?.allowed && grant.accessPath === "owner" ? [...PERMISSIONS] : creator ? (await Promise.all(needed.map(async (permission) => ({ permission, result: await authorizeCreatorOperation({ creatorId: creator.id, resourceOwnerId: creator.id, permission }) })))).filter((item) => item.result.allowed).map((item) => item.permission) : [];
	const content = user ? (
		<DashboardShell key={user.id} creatorId={user.id} permissions={permissions} isAdmin={user.role === "admin" && !user.adminView?.active}>
			{children}
		</DashboardShell>
	) : (
		children
	);

	const billingOwner = creator && grant?.allowed && grant.accessPath === "owner" && !creator.adminView?.active ? creator : undefined;
	const [items, guide, overdue] = await Promise.all([creator ? getPendingDashboardContent(creator) : Promise.resolve([]), creator ? getUserTourProgress(creator.id) : Promise.resolve(null), billingOwner?.stripeCustomerId ? findOverdueProSubscription(billingOwner.id, billingOwner.stripeCustomerId) : Promise.resolve(undefined)]);
	const billingNotice: BillingNotice | null = overdue ? { kind: "overdue", period: (overdue.period ?? overdue.createdAt).toISOString() } : billingOwner?.entitlements?.reverseTrialActive ? getTrialEndingNotice(billingOwner.entitlements.trialEndsAt) : null;
	return (
		<>
			<SentryFeedbackWidget />
			{user && guide ? (
				<Suspense fallback={content}>
					<UserTourProvider key={user.id} accountId={user.id} setupAvailable={permissions.includes("overlay:create") && permissions.includes("overlay:update")} initialProgress={guide.progress} importLegacy={guide.importLegacy} dashboardContent={items} billingNotice={billingNotice} appearanceAvailable={Boolean(creator && (creator.entitlements?.effectivePlan ?? creator.plan) === "pro")} upgradeUser={creator && permissions.includes("subscription:manage") ? creator : undefined}>
						{content}
					</UserTourProvider>
				</Suspense>
			) : (
				<>
					<DashboardBillingNotice notice={billingNotice} user={billingOwner}>
						<DashboardContentHost items={items} />
					</DashboardBillingNotice>
					{content}
				</>
			)}
		</>
	);
}
