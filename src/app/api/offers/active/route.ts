import { NextResponse } from "next/server";
import { getActiveCampaignOffer } from "@lib/campaignOffers";

export async function GET() {
	const offer = await getActiveCampaignOffer();
	return NextResponse.json({ offer });
}

