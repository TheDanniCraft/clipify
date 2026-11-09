import { redirect, notFound } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getEventAction } from "@actions/events";
import DashboardNavbar from "@components/dashboardNavbar";
import { resolveUserEntitlements } from "@lib/entitlements";
import EventEditor from "@components/events/EventEditor";
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/login");
	const { eventId } = await params;
	const result = await getEventAction(user.id, eventId);
	if (!result.ok) notFound();
	return (
		<DashboardNavbar stickyHeading user={user} title='Event' tagline='Prepare your award show'>
			<EventEditor creatorId={user.id} user={user} canWhiteLabel={(await resolveUserEntitlements(user)).proAccess} initial={result.event} />
		</DashboardNavbar>
	);
}
