import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import RoadmapSections from "@components/roadmap/roadmapSections";
import { getRoadmapItems } from "@lib/roadmap";

export const metadata = {
	title: "Roadmap | Clipify",
	description: "Explore current and upcoming Clipify improvements for Twitch creators.",
	alternates: { canonical: "https://clipify.us/roadmap" },
	openGraph: { title: "Roadmap | Clipify", description: "Explore current and upcoming Clipify improvements for Twitch creators.", url: "https://clipify.us/roadmap" },
};

export default async function RoadmapPage() {
	const roadmapItems = await getRoadmapItems();

	return (
		<>
			<BasicNavbar />

			<main className='min-h-screen bg-background px-6 py-14 sm:px-8 sm:py-20 text-foreground'>
				<div className='max-w-6xl mx-auto'>
					<header className='mb-12 border-b border-separator pb-10 sm:mb-16'>
						<p className='mb-4 text-sm font-medium text-accent dark:text-violet-300'>The Clipify roadmap</p>
						<h1 className='text-4xl font-bold tracking-tight sm:text-6xl'>What we’re building.</h1>
						<p className='mt-5 max-w-xl text-lg leading-relaxed text-foreground/75'>Follow work in progress, upcoming ideas, and the milestones already on your stream.</p>
					</header>

					{roadmapItems.length > 0 ? (
						<RoadmapSections items={roadmapItems} />
					) : (
						<div className='rounded-3xl border border-default bg-surface px-6 py-16 text-center'>
							<h2 className='text-2xl font-semibold'>Roadmap unavailable</h2>
							<p className='mt-3 text-muted'>Can&apos;t load roadmap right now.</p>
						</div>
					)}
				</div>
			</main>

			<Footer />
		</>
	);
}
