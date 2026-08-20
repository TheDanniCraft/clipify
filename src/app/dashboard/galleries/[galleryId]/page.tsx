import { validateAuth } from "@actions/auth";
import { getAllPlaylists } from "@actions/database";
import { getGallery, getGalleryPreview } from "@actions/gallery";
import DashboardNavbar from "@components/dashboardNavbar";
import GalleryEditor from "@components/gallery/GalleryEditor";
import { notFound, redirect } from "next/navigation";

export default async function GalleryConfigurationPage({ params }: { params: Promise<{ galleryId: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { galleryId } = await params;
	const [gallery, playlists, preview] = await Promise.all([getGallery(galleryId), getAllPlaylists(user.id), getGalleryPreview(galleryId)]);
	if (!gallery) notFound();
	return (
		<DashboardNavbar user={user} title='Gallery' tagline='Configure and publish your clip gallery'>
			<GalleryEditor initialGallery={gallery} playlists={playlists ?? []} canUseAdvanced={preview?.canUseAdvanced ?? false} canUseStyling={preview?.canUseAdvanced ?? false} previewClips={preview?.clips ?? []} previewOwnerName={preview?.ownerName ?? user.username} showPreviewAttribution={preview?.showAttribution ?? true} />
		</DashboardNavbar>
	);
}
