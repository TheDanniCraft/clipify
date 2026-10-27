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
			<main className='mx-auto flex min-h-[70dvh] max-w-4xl flex-col items-center justify-center gap-6 px-6 py-20 text-center'>
				<p className='font-semibold text-accent'>Clipify Galleries</p>
				<h1 className='text-4xl font-bold sm:text-6xl'>Turn your best clips into a gallery people remember.</h1>
				<p className='max-w-2xl text-lg text-muted'>Choose a curated playlist or a filtered selection of Twitch highlights. Share a public gallery link or embed the gallery on your own website.</p>
				<p className='max-w-2xl leading-relaxed text-foreground/75'>Free includes one branded gallery with up to 50 live clips. Pro adds more galleries and customization. Gallery visibility is managed in your settings; share public gallery links rather than private streaming-source URLs.</p>
				<div className='flex flex-wrap justify-center gap-3'>
					<Link className='rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground' href='/login'>
						Create your gallery
					</Link>
					<Link className='rounded-xl bg-default px-5 py-3 font-semibold' href='/'>
						Learn about Clipify
					</Link>
				</div>
			</main>
			<Footer />
		</>
	);
}
