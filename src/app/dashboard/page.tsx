import { redirect } from "next/navigation";
import OverlayTable from "@components/OverlayTable";
import DashboardNavbar from "@components/dashboardNavbar";
import { validateAuth } from "@actions/auth";
import FeedbackWidget from "@components/feedbackWidget";
import { getAccessToken } from "@actions/database";

export default async function Dashboard() {
	const user = await validateAuth();
	if (!user) {
		redirect("/logout");
	}
	const token = await getAccessToken(user.id);
	if (!token) {
		redirect("/logout");
	}

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<FeedbackWidget />
			<DashboardNavbar user={user} title='Dashboard' tagline='Manage your overlays'>
				<OverlayTable userId={user.id} accessToken={token.accessToken} />
			</DashboardNavbar>
		</>
	);
}
