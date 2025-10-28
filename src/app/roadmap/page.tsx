import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { roadmapData } from "@components/roadmap/roadmapData";
import { RoadmapItem } from "@components/roadmap/roadmapItem";

export default function RoadmapPage() {
	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>
			<BasicNavbar />

			<div className='min-h-screen bg-background text-foreground p-6'>
				<div className='max-w-5xl mx-auto'>
					<h1 className='text-4xl font-bold text-center mb-2 flex items-center justify-center gap-2'>
						<span className='text-primary'>✨</span>
						Product Roadmap
						<span className='text-primary'>✨</span>
					</h1>
					<p className='text-center text-default-400 mb-12'>See what we&apos;re building next and help shape the future of Clipify</p>

					<div className='relative'>
						<div className='absolute left-3.5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-default-400 via-default-400 to-transparent opacity-20 z-0'></div>

						<div className='space-y-6'>
							{roadmapData.map((item, index) => (
								<RoadmapItem key={index} icon={item.icon} color={item.color} title={item.title} description={item.description} status={item.status} timeframe={item.timeframe} features={item.features} />
							))}
						</div>
					</div>
				</div>
			</div>

			<Footer />
		</>
	);
}
