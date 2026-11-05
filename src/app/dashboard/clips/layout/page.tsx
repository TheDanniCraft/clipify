import { redirect } from "next/navigation";
import { Link } from "@heroui/react";
import { validateAuth } from "@actions/auth";
import { getCreatorClipDetail } from "@actions/creatorLibrary";
import DashboardNavbar from "@components/dashboardNavbar";
import ClipLayoutEditor from "@components/creator/clipLayoutEditor";
export default async function ClipLayoutPage({ searchParams }: { searchParams: Promise<{ clips?: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { clips } = await searchParams;
	const ids = typeof clips === "string" && clips.length <= 10000 ? [...new Set(clips.split(",").filter(Boolean))] : [];
	if (!ids.length || ids.length > 50 || ids.some((id) => id.length > 200))
		return (
			<DashboardNavbar user={user} title='Portrait layout' tagline='Choose clips to export'>
				<Link href='/dashboard/clips'>Select clips in your inventory</Link>
			</DashboardNavbar>
		);
	const data = await getCreatorClipDetail({ creatorId: user.id, clipId: ids[0] });
	return (
		<DashboardNavbar user={user} title='Portrait layout' tagline='Frame your gameplay, camera and credits'>
			<ClipLayoutEditor key={`${user.id}:${ids.join(",")}`} creatorId={user.id} ids={ids} data={data} />
		</DashboardNavbar>
	);
}
