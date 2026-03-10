import { redirect } from "next/navigation";
import OverlayTable from "@components/OverlayTable";
import DashboardNavbar from "@components/dashboardNavbar";
import { validateAuth } from "@actions/auth";
import FeedbackWidget from "@components/feedbackWidget";
import { getAccessTokenResult } from "@actions/database";
import ChatwootData from "@components/chatwootData";

export default async function Dashboard() {
	const user = await validateAuth();
	if (!user) {
		redirect("/logout");
	}
	const tokenResult = await getAccessTokenResult(user.id);
	if (!tokenResult.token) {
		redirect(tokenResult.reason === "user_disabled" ? "/logout?error=accountDisabled" : "/logout");
	}

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<ChatwootData user={user} />
			<FeedbackWidget />
			<DashboardNavbar user={user} title='Dashboard' tagline='Manage your overlays'>
				<OverlayTable userId={user.id} accessToken={tokenResult.token.accessToken} />
			</DashboardNavbar>
		</>
	);
}
