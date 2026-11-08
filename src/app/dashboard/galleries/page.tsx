import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import OverlayTable from "@components/OverlayTable";
export default async function Page() {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	return (
		<DashboardNavbar user={user} title='Galleries' tagline='Manage your galleries'>
			<OverlayTable key={user.id} userId={user.id} resourceType='galleries' />
		</DashboardNavbar>
	);
}
