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
			<ChatwootData user={user} />
			<FeedbackWidget />
			<DashboardNavbar user={user} title='Dashboard' tagline='Manage your overlays'>
				<OverlayTable userId={user.id} accessToken={tokenResult.token.accessToken} />
			</DashboardNavbar>
		</>
	);
}
