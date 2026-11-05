import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { validateAdminAuth } from "@actions/auth";
import { PERMISSIONS } from "@/auth/permissions";
import DashboardShell from "@components/dashboardShell";
import SentryFeedbackWidget from "@components/SentryFeedbackWidget";
export default async function AdminLayout({ children }: { children: ReactNode }) {
	const user = await validateAdminAuth(true);
	if (!user) notFound();
	return (
		<DashboardShell creatorId={user.id} permissions={[...PERMISSIONS]} isAdmin>
			<SentryFeedbackWidget />
			{children}
		</DashboardShell>
	);
}
