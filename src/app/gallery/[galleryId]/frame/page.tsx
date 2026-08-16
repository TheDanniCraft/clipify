import { getPublicGallery } from "@actions/gallery";
import GalleryFrame from "@components/gallery/GalleryFrame";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function GalleryFramePage({ params }: { params: Promise<{ galleryId: string }> }) {
	const requestHeaders = await headers();
	if (requestHeaders.get("sec-fetch-dest") !== "iframe") notFound();
	const { galleryId } = await params;
	const bundle = await getPublicGallery(galleryId);
	if (!bundle) notFound();
	return (
		<>
			<style>{`html,body,#root{height:100%;background:transparent!important}body{margin:0;padding:0;min-height:100%!important}`}</style>
			<script dangerouslySetInnerHTML={{ __html: "window.$chatwoot = window.$chatwoot || {}; window.$chatwoot.disabled = true;" }} />
			<GalleryFrame gallery={bundle.gallery} clips={bundle.clips} ownerName={bundle.owner.username} showAttribution={bundle.showAttribution} />
		</>
	);
}
