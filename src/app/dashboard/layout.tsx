import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { validateAuth } from "@actions/auth";
import { UserTourProvider } from "@components/user-tour/provider";
import SentryFeedbackWidget from "@components/SentryFeedbackWidget";
import { getUserTourProgress } from "@actions/userTour";
import DashboardContentHost from "@components/dashboardContentHost";
import { getPendingDashboardContent } from "@lib/dashboardContent";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	await connection();
	const user = await validateAuth();
	const [items, guide] = await Promise.all([user ? getPendingDashboardContent(user) : Promise.resolve([]), user ? getUserTourProgress(user.id) : Promise.resolve(null)]);
	return (
		<>
			<SentryFeedbackWidget />
			<DashboardContentHost items={items} />
			{user && guide ? (
				<Suspense fallback={children}>
					<UserTourProvider key={user.id} accountId={user.id} initialProgress={guide.progress} importLegacy={guide.importLegacy} appearanceAvailable={(user.entitlements?.effectivePlan ?? user.plan) === "pro"}>
						{children}
					</UserTourProvider>
				</Suspense>
			) : (
				children
			)}
		</>
	);
}
