import { validateAuth } from "@actions/auth";
import { getAllOverlays } from "@actions/database";
import { getAllGalleries } from "@actions/gallery";
import { getBaseUrl } from "@actions/utils";
import DashboardNavbar from "@components/dashboardNavbar";
import ToolsClient from "@components/tools/ToolsClient";
import { redirect } from "next/navigation";

export default async function ToolsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const params = await searchParams;
	const origin = (await getBaseUrl()).origin;
	const [overlays, galleries] = await Promise.all([getAllOverlays(user.id), getAllGalleries(user.id)]);
	const tool = (Array.isArray(params.tool) ? params.tool[0] : params.tool) === "gallery" ? "gallery" : "player";
	const galleryId = Array.isArray(params.gallery) ? params.gallery[0] : params.gallery;
	return (
		<DashboardNavbar user={user} title='Tools' tagline='Install Clipify on your website'>
			<ToolsClient key={user.id} overlays={(overlays ?? []).filter((overlay) => overlay.ownerId === user.id)} galleries={(galleries ?? []).filter((gallery) => gallery.ownerId === user.id)} initialTool={tool} initialGalleryId={galleryId} origin={origin} />
		</DashboardNavbar>
	);
}
