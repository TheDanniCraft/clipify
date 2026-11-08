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
import DashboardContentHost from "@components/dashboardContentHost";
import { getPendingDashboardContent } from "@lib/dashboardContent";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	await connection();
	const creator = await validateAuth();
	const user = creator || (await getDashboardNavbarUser());
	const grant = creator ? await authorizeCreatorOperation({ creatorId: creator.id, resourceOwnerId: creator.id, permission: "creator:read" }) : null;
	const needed: Permission[] = ["creator:read", "overlay:read", "playlist:read", "gallery:read", "runner:read", "account:read", "member:read", "billing:read"];
	const permissions: Permission[] = grant?.allowed && grant.accessPath === "owner" ? [...PERMISSIONS] : creator ? (await Promise.all(needed.map(async (permission) => ({ permission, result: await authorizeCreatorOperation({ creatorId: creator.id, resourceOwnerId: creator.id, permission }) })))).filter((item) => item.result.allowed).map((item) => item.permission) : [];
	const content = user ? (
		<DashboardShell key={user.id} creatorId={user.id} permissions={permissions} isAdmin={user.role === "admin" && !user.adminView?.active}>
			{children}
		</DashboardShell>
	) : (
		children
	);

	const [items, guide] = await Promise.all([creator ? getPendingDashboardContent(creator) : Promise.resolve([]), creator ? getUserTourProgress(creator.id) : Promise.resolve(null)]);
	return (
		<>
			<SentryFeedbackWidget />
			{user && guide ? (
				<Suspense fallback={content}>
					<UserTourProvider key={user.id} accountId={user.id} initialProgress={guide.progress} importLegacy={guide.importLegacy} dashboardContent={items} appearanceAvailable={Boolean(creator && (creator.entitlements?.effectivePlan ?? creator.plan) === "pro")}>
						{content}
					</UserTourProvider>
				</Suspense>
			) : (
				<>
					<DashboardContentHost items={items} />
					{content}
				</>
			)}
		</>
	);
}
