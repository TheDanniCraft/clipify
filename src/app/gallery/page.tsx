import Link from "next/link";

export default function GalleryLandingPage() {
	return (
		<main className='mx-auto flex min-h-[70dvh] max-w-4xl flex-col items-center justify-center gap-6 px-6 py-20 text-center'>
			<p className='font-semibold text-accent'>Clipify Galleries</p>
			<h1 className='text-4xl font-bold sm:text-6xl'>Turn your best clips into a gallery people remember.</h1>
			<p className='max-w-2xl text-lg text-muted'>Publish curated highlights or automatically show your newest and most-viewed clips. Free galleries include Clipify attribution; Pro unlocks precision and branding control.</p>
			<div className='flex flex-wrap justify-center gap-3'>
				<Link className='rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground' href='/login'>
					Create your gallery
				</Link>
				<Link className='rounded-xl bg-default px-5 py-3 font-semibold' href='/'>
					Learn about Clipify
				</Link>
			</div>
		</main>
	);
}
