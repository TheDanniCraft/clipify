import HomePageClient from "./HomePageClient";
import type { Metadata } from "next";
import { getActiveCampaignOffer } from "@lib/campaignOffers";
import { resolveBillingCatalog } from "@/server/billingCatalog";
import { BillingProduct } from "@types";
import { FrequencyEnum, type RuntimePricing } from "@components/Pricing/pricing-types";

export const dynamic = "force-dynamic";

const title = "Twitch Clip Player for OBS Break Screens | Clipify";
const description = "Turn your Twitch highlights into a BRB or Starting Soon screen. Choose clips, save your overlay, and add a browser source in OBS. Start with Clipify Free.";

export const metadata: Metadata = {
	title,
	description,
	alternates: { canonical: "https://clipify.us/" },
	openGraph: { title, description, url: "https://clipify.us/", siteName: "Clipify", type: "website", images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Clipify Twitch clip player for OBS" }] },
	twitter: { card: "summary_large_image", title, description },
};

export default async function Home() {
	const [campaignOffer, catalog] = await Promise.all([getActiveCampaignOffer(), resolveBillingCatalog()]);
	const pricing: RuntimePricing = {
		pro: { [FrequencyEnum.Monthly]: catalog[BillingProduct.Pro].monthly, [FrequencyEnum.Yearly]: catalog[BillingProduct.Pro].yearly },
	};

	return <HomePageClient campaignOffer={campaignOffer} pricing={pricing} />;
}
