import type { ReactNode } from "react";
import { validateAuth } from "@actions/auth";
import DashboardContentHost from "@components/dashboardContentHost";
import { getPendingDashboardContent } from "@lib/dashboardContent";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const user = await validateAuth();
	const items = user ? await getPendingDashboardContent(user) : [];
	return (
		<>
			<DashboardContentHost items={items} />
			{children}
		</>
	);
}
