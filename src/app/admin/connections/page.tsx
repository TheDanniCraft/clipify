import { notFound } from "next/navigation";
import { validateAdminAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import ApplicationConnections from "./application-connections";
export const dynamic = "force-dynamic";
export default async function ConnectionsPage() {
	const user = await validateAdminAuth(true);
	if (!user) notFound();
	return (
		<DashboardNavbar user={user} title='Connections' tagline='Approve companion applications and control their access'>
			<ApplicationConnections />
		</DashboardNavbar>
	);
}
