import { socialPreview } from "@lib/socialPreview";
import { connection } from "next/server";
import { getDemoGalleryClips } from "@actions/gallery";
import PublicPageHeader from "@components/LandingPage/publicPageHeader";
import PublicGalleryDemo from "@components/gallery/PublicGalleryDemo";
import { buttonVariants } from "@heroui/styles";
import type { Metadata } from "next";
import { Link } from "@components/heroui-client";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import Footer from "@components/footer";
export const metadata: Metadata = {
	title: "Twitch Clip Galleries for Your Website | Clipify",
	description: "Curate Twitch highlights in a public Clipify gallery or embed a clip collection on your own website.",
	alternates: { canonical: "https://clipify.us/gallery" },
	openGraph: { ...socialPreview, title: "Twitch Clip Galleries | Clipify", description: "Curate and share Twitch highlights in a gallery.", url: "https://clipify.us/gallery" },
};

export default async function GalleryLandingPage() {
	await connection();
	const initialBundle = await getDemoGalleryClips().catch(() => null);
	return (
		<>
			<BasicNavbar />
			<main className='mx-auto max-w-6xl px-6 py-14 sm:px-8 sm:py-20'>
				<PublicPageHeader title='Your clips, together.' description='Collect your Twitch highlights in one public gallery. Share the link with your community or embed it on your website.'>
					<Link className={buttonVariants({ variant: "primary", className: "mt-7 no-underline" })} href='/login'>
						Create your gallery
					</Link>
				</PublicPageHeader>
				<PublicGalleryDemo initialBundle={initialBundle} />
			</main>
			<Footer />
		</>
	);
}
