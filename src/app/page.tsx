import HomePageClient from "./HomePageClient";
import { getActiveCampaignOffer } from "@lib/campaignOffers";

export default async function Home() {
	const campaignOffer = await getActiveCampaignOffer();

	return <HomePageClient campaignOffer={campaignOffer} />;
}
