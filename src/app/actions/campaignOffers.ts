"use server";

import { getActiveCampaignOffer } from "@lib/campaignOffers";

export async function getActiveCampaignOfferAction() {
	return getActiveCampaignOffer();
}
