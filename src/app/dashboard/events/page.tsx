import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import EventLibrary from "@components/events/EventLibrary";
export default async function EventsPage() {
	const user = await validateAuth();
	if (!user) redirect("/login");
	return (
		<DashboardNavbar stickyHeading user={user} title='Events' tagline='Your community, your award show'>
			<EventLibrary creatorId={user.id} />
		</DashboardNavbar>
	);
}
