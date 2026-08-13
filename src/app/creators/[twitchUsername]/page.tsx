import { getCreatorPage } from "@actions/creatorPage";
import CreatorPageClient from "@components/creator/CreatorPageClient";
import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { resolveCreatorPageMetadata } from "@lib/creatorPage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ twitchUsername: string }> }): Promise<Metadata> {
	const { twitchUsername } = await params;
	const data = await getCreatorPage(twitchUsername, { pageSize: 1 });
	if (!data) return {};
	const preview = resolveCreatorPageMetadata(data.creator.username, data.creator.socialTitle, data.creator.socialDescription);
	return {
		title: preview.title,
		description: preview.description,
		robots: data.creator.visibility === "discoverable" ? { index: true, follow: true } : { index: false, follow: false },
		openGraph: { title: preview.openGraphTitle, description: preview.openGraphDescription, images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Clipify Creator Page" }] },
	};
}

export default async function CreatorPage({ params }: { params: Promise<{ twitchUsername: string }> }) {
	const { twitchUsername } = await params;
	const today = new Date().toISOString().slice(0, 10);
	const end = new Date(`${today}T00:00:00.000Z`);
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - 30);
	const data = await getCreatorPage(twitchUsername, { sort: "most_viewed", start, end, pageSize: 24 });
	if (!data) notFound();
	return (
		<>
			<BasicNavbar />
			<CreatorPageClient creator={data.creator} initialItems={data.items} initialCursor={data.nextCursor} initialTotal={data.total} today={today} />
			<Footer />
		</>
	);
}
