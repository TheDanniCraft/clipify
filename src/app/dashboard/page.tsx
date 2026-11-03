import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import CreatorOverview from "@components/creator/creatorOverview";
import ChatwootData from "@components/chatwootData";
export default async function Dashboard({ searchParams }: { searchParams?: Promise<{ tab?: string | string[] }> } = {}) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const tab = (await searchParams)?.tab;
	if (typeof tab === "string" && ["overlays", "playlists", "galleries", "runners"].includes(tab)) redirect(`/dashboard/${tab}`);
	return (
		<>
			<ChatwootData user={user} />
			<DashboardNavbar user={user} title='Home' tagline='Your streams and clips at a glance'>
				<CreatorOverview key={user.id} creatorId={user.id} />
			</DashboardNavbar>
		</>
	);
}
