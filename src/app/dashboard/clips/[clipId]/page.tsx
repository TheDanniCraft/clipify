import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getCreatorClipDetail } from "@actions/creatorLibrary";
import DashboardNavbar from "@components/dashboardNavbar";
import ClipDetails from "@components/creator/clipDetails";

export default async function ClipDetailPage({ params }: { params: Promise<{ clipId: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { clipId } = await params;
	const data = await getCreatorClipDetail({ creatorId: user.id, clipId });
	return (
		<DashboardNavbar user={user} title='Clip details' tagline='Watch, review and download your clip'>
			<ClipDetails key={`${user.id}:${clipId}`} creatorId={user.id} data={data} />
		</DashboardNavbar>
	);
}
