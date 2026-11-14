import { redirect, notFound } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getEventAction } from "@actions/events";
import DashboardNavbar from "@components/dashboardNavbar";
import { resolveUserEntitlements } from "@lib/entitlements";
import EventEditor from "@components/events/EventEditor";
export default async function EventPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
	const user = await validateAuth();
	if (!user) redirect("/login");
	const { eventId } = await params;
	const query = await searchParams;
	const connectionStatus = query?.connection === "connected" || query?.connection === "retry" ? query.connection : undefined;
	const result = await getEventAction(user.id, eventId);
	if (!result.ok) notFound();
	return (
		<DashboardNavbar stickyHeading user={user} title='Event' tagline='Set up your community event'>
			<EventEditor connectionStatus={connectionStatus} creatorId={user.id} user={user} canWhiteLabel={(await resolveUserEntitlements(user)).proAccess} initial={result.event} />
		</DashboardNavbar>
	);
}
