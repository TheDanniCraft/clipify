import type { ReactNode } from "react";
import { connection } from "next/server";
import { validateAuth } from "@actions/auth";
import SentryFeedbackWidget from "@components/SentryFeedbackWidget";
import DashboardContentHost from "@components/dashboardContentHost";
import { getPendingDashboardContent } from "@lib/dashboardContent";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	await connection();
	const user = await validateAuth();
	const items = user ? await getPendingDashboardContent(user) : [];
	return (
		<>
			<SentryFeedbackWidget />
			<DashboardContentHost items={items} />
			{children}
		</>
	);
}
