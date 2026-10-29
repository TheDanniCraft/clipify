import { buttonVariants } from "@heroui/styles";
import type { Metadata } from "next";
import { Link, LinkIcon } from "@components/heroui-client";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import ProductImage from "@components/LandingPage/productImage";
import Footer from "@components/footer";

export const metadata: Metadata = {
	title: "Twitch Clip Playlists, OBS Overlays & Live Controls | Clipify",
	description: "Explore Clipify's saved Twitch clip playlists, OBS browser-source overlays, Theme Studio, live playback controls, galleries, and self-hosted Runner.",
	alternates: { canonical: "https://clipify.us/features" },
	openGraph: { title: "Explore Clipify's Twitch streaming tools", description: "Choose your clips, build a break scene, and control playback with Clipify.", url: "https://clipify.us/features" },
};
const features = [
	{
		id: "playlists",
		label: "Clip playlists",
		title: "Keep the moments you want to come back to.",
		text: "The clutch. The running joke. The clip your chat still brings up. Put them together in a saved playlist, change the selection, and have it ready for the next stream.",
		detail: "Pick clips yourself or narrow the selection with filters. Requested imports let you review a fresh selection before saving it.",
		image: "playlist",
		href: "https://help.clipify.us/hc/clipify/articles/create-manage-clip-playlists",
		action: "Read the playlist guide",
	},
	{ id: "overlays", label: "OBS overlays", title: "Your break scene. With something worth watching.", text: "Clipify plays inside a browser source in OBS or Streamlabs. Set up your BRB or Starting Soon scene once, then manage the clips in Clipify without rebuilding the scene.", detail: "Choose a playlist or clip source, save the overlay, and copy its private browser-source URL into your scene. Runner is not required.", image: "overlay", href: "/#demo", action: "Watch the player in action" },
	{
		id: "styling",
		label: "Theme Studio",
		title: "Make room for your own style.",
		text: "Choose the layout, colors, typography, timers, and progress styles that fit your channel. Position the clip and channel information around the moments that matter.",
		detail: "Pro includes Theme Studio. Arrange the layout on desktop; adjust colors and text from your phone.",
		image: null,
		href: "https://help.clipify.us/hc/clipify/articles/1769328012-getting-started-with-clipify",
		action: "Read the overlay setup guide",
	},
	{
		id: "controls",
		label: "Live controls",
		title: "Keep the show moving. Even from your phone.",
		text: "Skip a clip, pause playback, or mute the player from a second screen. Give a trusted moderator their own access so you can step away from your desk.",
		detail: "Pro includes the remote panel, Twitch chat commands, channel points, and collaboration controls.",
		image: "controls",
		href: "https://help.clipify.us/hc/clipify/articles/1765998791-controlling-the-overlay-via-chat-commands",
		action: "See the chat controls",
	},
] as const;
export default function FeaturesPage() {
	return (
		<>
			<BasicNavbar />
			<main className='overflow-hidden'>
				<header className='border-b border-separator bg-surface-secondary/50 px-6 py-14 sm:px-8 sm:py-20'>
					<div className='mx-auto max-w-6xl'>
						<h1 className='max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl'>Build your break screen.</h1>
						<p className='mt-6 max-w-2xl text-lg leading-relaxed text-foreground/75'>Choose Twitch clips, save an OBS overlay, and keep playback under control.</p>
					</div>
				</header>
				<div className='mx-auto max-w-6xl px-6 sm:px-8'>
					{features.map((feature, index) => (
						<section key={feature.id} id={feature.id} className='grid scroll-mt-24 gap-6 border-b border-separator py-14 sm:py-20 md:grid-cols-2 md:gap-x-14 md:gap-y-4'>
							<header className={feature.image && index % 2 ? "md:col-start-2" : ""}>
								<p className='mb-4 text-sm font-medium text-accent dark:text-violet-300'>{feature.label}</p>
								<h2 className='text-3xl font-semibold leading-tight tracking-tight sm:text-4xl'>{feature.title}</h2>
							</header>
							{feature.image && <ProductImage view={feature.image} className={`md:row-start-1 md:row-span-2 ${index % 2 ? "md:col-start-1" : "md:col-start-2"}`} />}
							<div className={feature.image ? `md:row-start-2 ${index % 2 ? "md:col-start-2" : "md:col-start-1"}` : "md:col-start-2"}>
								<p className='text-lg leading-relaxed text-foreground/75'>{feature.text}</p>
								<p className='mt-4 text-sm leading-relaxed text-foreground/70'>{feature.detail}</p>
								<p className='mt-5 text-sm leading-relaxed text-foreground/75'>
									<Link href={feature.href} className='inline font-semibold'>
										{feature.action}
									</Link>{" "}
									for the full workflow.
								</p>
							</div>
						</section>
					))}
					<div className='grid gap-10 border-b border-separator py-14 sm:py-20 md:grid-cols-2 md:gap-16'>
						<section id='galleries' className='scroll-mt-24'>
							<p className='mb-4 text-sm font-medium text-accent dark:text-violet-300'>Galleries & Creator Pages</p>
							<h2 className='text-2xl font-semibold'>Good clips don’t have to end with the stream.</h2>
							<p className='mt-4 leading-relaxed text-foreground/75'>Give viewers a public place to browse your highlights. Share a gallery or Creator Page while keeping your OBS source private.</p>
							<Link href='/gallery' className='mt-5 gap-2'>
								Try the gallery
								<LinkIcon />
							</Link>
						</section>
						<section id='runner' className='scroll-mt-24'>
							<p className='mb-4 text-sm font-medium text-accent dark:text-violet-300'>Self-hosted Runner</p>
							<h2 className='text-2xl font-semibold'>Take the broadcast into your own hands.</h2>
							<p className='mt-4 leading-relaxed text-foreground/75'>Broadcast from your Windows, Linux, or macOS computer. Runner is optional, with manual broadcasting included on Free and advanced broadcasting tools on Pro.</p>
							<Link href='https://help.clipify.us/hc/clipify/articles/self-hosted-clipify-runner' className='mt-5 gap-2'>
								Meet Runner
								<LinkIcon />
							</Link>
						</section>
					</div>
					<section className='grid gap-6 py-14 sm:py-20 md:grid-cols-2 md:gap-14'>
						<div>
							<h2 className='text-3xl font-semibold tracking-tight'>Ready for your next stream?</h2>
							<Link href='/login' className={buttonVariants({ variant: "primary", className: "mt-6 no-underline" })}>
								Start free with Twitch
							</Link>
						</div>
						<div>
							<h3 className='text-lg font-semibold'>Need a hand setting it up?</h3>
							<p className='mt-3 leading-relaxed text-foreground/75'>The Help Center has the full setup instructions and troubleshooting.</p>
							<Link href='https://help.clipify.us/hc/clipify/articles/1769328012-getting-started-with-clipify' className='mt-5 gap-2'>
								Getting started with Clipify
								<LinkIcon />
							</Link>
						</div>
					</section>
				</div>
			</main>
			<Footer />
		</>
	);
}
