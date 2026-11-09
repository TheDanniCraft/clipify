import EventDiscovery from "@components/events/EventDiscovery";
import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
export const metadata = { title: "Community events | Clipify", description: "Find community award shows, suggest your favorite moments and vote for the winners." };
export default function EventsPage() {
	return (
		<>
			<BasicNavbar />
			<main className='mx-auto min-h-[70vh] max-w-7xl px-4 py-12 sm:px-8'>
				<EventDiscovery />
			</main>
			<Footer />
		</>
	);
}
