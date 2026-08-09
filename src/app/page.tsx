import HomePageClient from "./HomePageClient";
import { getActiveCampaignOffer } from "@lib/campaignOffers";
import { resolveBillingCatalog } from "@/server/billingCatalog";
import { BillingProduct } from "@types";
import { FrequencyEnum, type RuntimePricing } from "@components/Pricing/pricing-types";

export const dynamic = "force-dynamic";

export default async function Home() {
	const [campaignOffer, catalog] = await Promise.all([getActiveCampaignOffer(), resolveBillingCatalog()]);
	const pricing: RuntimePricing = {
		pro: { [FrequencyEnum.Monthly]: catalog[BillingProduct.Pro].monthly, [FrequencyEnum.Yearly]: catalog[BillingProduct.Pro].yearly },
		runner: { [FrequencyEnum.Monthly]: catalog[BillingProduct.RunnerSelfHosted].monthly, [FrequencyEnum.Yearly]: catalog[BillingProduct.RunnerSelfHosted].yearly },
	};

	return <HomePageClient campaignOffer={campaignOffer} pricing={pricing} />;
}
