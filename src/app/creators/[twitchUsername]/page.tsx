import { getCreatorPage, getCreatorPageMetadata } from "@actions/creatorPage";
import CreatorPageClient from "@components/creator/CreatorPageClient";
import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { resolveCreatorPageMetadata } from "@lib/creatorPage";
import { memberCardImagePath } from "@lib/memberCardLinks";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ twitchUsername: string }> }): Promise<Metadata> {
	const { twitchUsername } = await params;
	const creator = await getCreatorPageMetadata(twitchUsername);
	if (!creator) return {};
	const preview = resolveCreatorPageMetadata(creator.username, creator.socialTitle, creator.socialDescription);
	return {
		title: preview.title,
		description: preview.description,
		robots: creator.visibility === "discoverable" ? { index: true, follow: true } : { index: false, follow: false },
		openGraph: { title: preview.openGraphTitle, description: preview.openGraphDescription, images: [{ url: memberCardImagePath(creator.memberCardId), width: 1200, height: 1200, alt: `${creator.username}'s Clipify Member Card` }] },
		twitter: { card: "summary_large_image", title: preview.openGraphTitle, description: preview.openGraphDescription, images: [memberCardImagePath(creator.memberCardId)] },
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
