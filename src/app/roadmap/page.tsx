import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { RoadmapItem } from "@components/roadmap/roadmapItem";
import { getRoadmapItems } from "@lib/roadmap";

export default async function RoadmapPage() {
	const roadmapItems = await getRoadmapItems();

	return (
		<>
			<BasicNavbar />

			<div className='min-h-screen bg-background text-foreground p-6'>
				<div className='max-w-5xl mx-auto'>
					<h1 className='text-4xl font-bold text-center mb-2 flex items-center justify-center gap-2'>
						<span className='text-primary'>✨</span>
						Product Roadmap
						<span className='text-primary'>✨</span>
					</h1>
					<p className='text-center text-default-400 mb-12'>See what we&apos;re building next and help shape the future of Clipify</p>

					{roadmapItems.length > 0 ? (
						<div className='relative'>
							<div className='absolute left-3.5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-default-400 via-default-400 to-transparent opacity-20 z-0'></div>

							<div className='space-y-6'>
								{roadmapItems.map((item, index) => (
									<RoadmapItem key={index} icon={item.icon} color={item.color} title={item.title} description={item.description} status={item.status} timeframe={item.timeframe} features={item.features} />
								))}
							</div>
						</div>
					) : (
						<div className='rounded-3xl border border-default-200 bg-content1 px-6 py-16 text-center'>
							<h2 className='text-2xl font-semibold'>Roadmap unavailable</h2>
							<p className='mt-3 text-default-400'>The roadmap is currently not available from the CMS. Please try again shortly.</p>
						</div>
					)}
				</div>
			</div>

			<Footer />
		</>
	);
}
