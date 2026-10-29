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
	openGraph: { title: "Twitch Clip Galleries | Clipify", description: "Curate and share Twitch highlights in a gallery.", url: "https://clipify.us/gallery" },
};

export default function GalleryLandingPage() {
	return (
		<>
			<BasicNavbar />
			<main className='mx-auto max-w-6xl px-6 py-14 sm:px-8 sm:py-20'>
				<header className='grid gap-8 border-b border-separator pb-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end'>
					<div>
						<h1 className='max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl'>Your clips, together.</h1>
						<p className='mt-6 max-w-2xl text-lg leading-relaxed text-foreground/75'>Collect your Twitch highlights in one public gallery. Share the link with your community or embed it on your website.</p>
						<Link className={buttonVariants({ variant: "primary", className: "mt-7 no-underline" })} href='/login'>
							Create your gallery
						</Link>
					</div>
					<p className='max-w-md text-sm leading-relaxed text-foreground/75'>Free includes one branded gallery with up to 50 live clips. Choose a playlist or filtered selection, then manage who can see it in your gallery settings.</p>
				</header>
				<PublicGalleryDemo />
			</main>
			<Footer />
		</>
	);
}
