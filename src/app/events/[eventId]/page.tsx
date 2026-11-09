import { notFound } from "next/navigation";
import { getPublicEventAction } from "@actions/events";
import PublicEventView from "@components/events/PublicEventView";
import { readCreatorBrand } from "@/server/creator-brand";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
export const metadata = { title: "Community awards | Clipify", robots: { index: false, follow: false } };
export default async function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
	const { eventId } = await params;
	const result = await getPublicEventAction(eventId);
	if (!result.ok) notFound();
	const [creator] = await db.select({ username: usersTable.username, disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, result.event.ownerId)).limit(1);
	if (!creator || creator.disabled) notFound();
	const { brand } = await readCreatorBrand(result.event.ownerId);
	return <PublicEventView initial={result} creatorName={creator.username} brand={brand} />;
}
