import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@components/heroui-client";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import Footer from "@components/footer";
import { publicGuides } from "@lib/publicGuides";

export const metadata: Metadata = {
	title: "Twitch Clip Playlists, OBS Overlays & Live Controls | Clipify",
	description: "Explore Clipify's saved Twitch clip playlists, OBS browser-source overlays, Theme Studio, live playback controls, galleries, and self-hosted Runner.",
	alternates: { canonical: "https://clipify.us/features" },
	openGraph: { title: "Explore Clipify's Twitch streaming tools", description: "Choose your clips, build a break scene, and control playback with Clipify.", url: "https://clipify.us/features" },
};
const features = [
	{
		id: "playlists",
		title: "Keep a playlist ready for every kind of stream",
		text: "Handpick highlights, reorder your selection, and save it for your next break. Use basic filters to find clips or explore advanced filters, Top and Smart Shuffle playback, and requested imports with Pro.",
		availability: "Free includes one playlist with up to 50 clips and Random playback. Pro adds more playlists and advanced selection tools.",
		href: "/guides/twitch-clip-playlists",
		action: "Build a clip playlist",
	},
	{ id: "overlays", title: "Bring your clips into OBS", text: "Save your overlay once and add its URL as a browser source. Switch to your BRB or Starting Soon scene and let your selection play. Your existing gameplay setup stays in OBS.", availability: "One overlay is included with Free. Pro supports more overlays. Runner is not required for browser-source playback.", href: "/guides/twitch-clips-in-obs", action: "Set up clips in OBS" },
	{ id: "styling", title: "Give your break scene its own look", text: "Theme Studio brings layouts, colors, fonts, timers, and progress styling into your overlay setup. Match the player to your stream rather than rebuilding your scene each time you change clips.", availability: "Custom Theme Studio styling requires Pro. Free includes the standard player.", href: "/#demo", action: "Try the playback demo" },
	{ id: "controls", title: "Skip, pause, and bring your moderators along", text: "Use the remote panel from a phone or second screen. Configure Twitch chat commands and channel points interactions, or give editors and managers access through their own accounts.", availability: "Remote playback controls, chat controls, channel points, and team access require Pro.", href: "/guides/control-twitch-clip-playback", action: "Explore playback controls" },
	{ id: "sharing", title: "Give your clips a home beyond the live stream", text: "Publish a Creator Page, curate a gallery, or embed clips on your own website. Manage your page's visibility in your settings and share its public link instead of your private OBS source URL.", availability: "Free includes a Creator Page and one branded gallery. Pro adds more galleries and customization.", href: "/gallery", action: "Explore galleries" },
	{ id: "runner", title: "Broadcast from your own computer", text: "The optional Runner runs on Windows, Linux, or macOS. Use manual broadcasting or explore Pro's advanced broadcasting tools. Your computer needs to stay online; this is not hosted streaming infrastructure.", availability: "Runner is included with Free and Pro, with unlimited streaming hours. Advanced capabilities require Pro.", href: "https://help.clipify.us/", action: "Read the Runner documentation" },
];
export default function FeaturesPage() {
	return (
		<>
			<BasicNavbar />
			<main>
				<header className='overflow-hidden bg-gradient-to-br from-brand-900 to-brand-600 px-6 py-16 text-white sm:py-24'>
					<div className='mx-auto max-w-6xl'>
						<p className='text-sm font-semibold text-violet-200'>Your stream. Your highlights.</p>
						<h1 className='mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl'>More of the moments worth watching again.</h1>
						<p className='mt-6 max-w-2xl text-lg leading-relaxed text-violet-100'>Choose clips, save your setup, and bring your highlights into the scenes you already use.</p>
						<Image src='/appSkew.webp' alt='Clipify dashboard showing saved overlays and playback settings' width={1920} height={1080} sizes='(max-width: 1152px) 100vw, 1152px' className='mt-10 h-auto w-full rounded-2xl' />
					</div>
				</header>
				<div className='mx-auto max-w-6xl px-6 py-14 sm:px-8'>
					<nav aria-label='Feature topics' className='mb-12 flex flex-wrap gap-3'>
						{features.map((feature) => (
							<Link key={feature.id} href={`#${feature.id}`} className='rounded-full border border-border px-4 py-2 text-sm'>
								{feature.id === "styling" ? "Theme Studio" : feature.id.charAt(0).toUpperCase() + feature.id.slice(1)}
							</Link>
						))}
					</nav>
					{features.map((feature, index) => (
						<section key={feature.id} id={feature.id} className='grid scroll-mt-24 gap-5 border-t border-border py-10 md:grid-cols-[0.8fr_1.2fr] md:gap-12'>
							<h2 className='text-2xl font-semibold sm:text-3xl'>
								<span className='mb-3 block text-sm text-accent dark:text-violet-300'>0{index + 1}</span>
								{feature.title}
							</h2>
							<div>
								<p className='text-lg leading-relaxed text-foreground/75'>{feature.text}</p>
								<p className='mt-4 text-sm leading-relaxed text-foreground/75'>{feature.availability}</p>
								<Link href={feature.href} className='mt-5 font-semibold'>
									{feature.action} →
								</Link>
							</div>
						</section>
					))}
					<section className='border-t border-border pt-12'>
						<h2 className='text-3xl font-bold'>Take it into your next stream.</h2>
						<div className='mt-6 grid gap-4 md:grid-cols-3'>
							{publicGuides.map((guide) => (
								<Link key={guide.slug} href={`/guides/${guide.slug}`} className='rounded-2xl border border-border p-6 font-semibold'>
									{guide.title} →
								</Link>
							))}
						</div>
						<Link href='/login' className='mt-8 rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground'>
							Start free with Twitch
						</Link>
					</section>
				</div>
			</main>
			<Footer />
		</>
	);
}
