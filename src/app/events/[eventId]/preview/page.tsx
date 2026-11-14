import EventPresenter from "@components/events/EventPresenter";
export const metadata = { title: "Event preview | Clipify", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PreviewPage({ params }: { params: Promise<{ eventId: string }> }) {
	const { eventId } = await params;
	return <EventPresenter eventId={eventId} preview />;
}
