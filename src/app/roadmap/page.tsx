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

			<main className='min-h-screen bg-background px-6 py-12 text-foreground'>
				<div className='max-w-5xl mx-auto'>
					<h1 className='text-4xl font-bold text-center mb-2 flex items-center justify-center gap-2'>
						<span className='text-accent'>✨</span>
						Product Roadmap
						<span className='text-accent'>✨</span>
					</h1>
					<p className='text-center text-muted mb-12'>See what we&apos;re building next and help shape the future of Clipify</p>

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
