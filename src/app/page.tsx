import HomePageClient from "./HomePageClient";
import { getActiveCampaignOffer } from "@lib/campaignOffers";
import { getCommunitySnapshot } from "@lib/community";

export default async function Home() {
	const campaignOffer = await getActiveCampaignOffer();
	const communityPreview = await getCommunitySnapshot();

	return <HomePageClient campaignOffer={campaignOffer} communityPreview={communityPreview} />;
}
