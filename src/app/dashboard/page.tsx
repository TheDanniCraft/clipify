import { redirect } from "next/navigation";
import OverlayTable from "@components/OverlayTable";
import DashboardNavbar from "@components/dashboardNavbar";
import { validateAuth } from "@actions/auth";
import FeedbackWidget from "@components/feedbackWidget";

export default async function Dashboard() {
	const user = await validateAuth();
	if (!user) {
		redirect("/logout");
	}

	return (
		<>
			<FeedbackWidget />
			<DashboardNavbar user={user} title='Dashboard' tagline='Manage your overlays'>
				<OverlayTable userid={user.id} />
			</DashboardNavbar>
		</>
	);
}
