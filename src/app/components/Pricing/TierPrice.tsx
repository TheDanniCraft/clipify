import type { CampaignOffer } from "@types";
import { frequencies } from "./pricing-catalog";
import { annualSavingsPercent, FrequencyEnum, type RuntimePricing, type Tier } from "./pricing-types";

export default function TierPrice({ campaignOffer, pricing, selectedFrequency, tier }: { campaignOffer: CampaignOffer | null; pricing: RuntimePricing; selectedFrequency: FrequencyEnum; tier: Tier }) {
	const campaignPrice = selectedFrequency === FrequencyEnum.Monthly ? campaignOffer?.pricingMonthlyPromo : campaignOffer?.pricingYearlyPromo;
	const isPro = typeof tier.price !== "string";
	const hasPromo = isPro && campaignOffer?.showPricingTierPromo && typeof campaignPrice === "number";
	const yearlyReference = isPro && selectedFrequency === FrequencyEnum.Yearly && annualSavingsPercent(pricing) !== null ? new Intl.NumberFormat("en", { style: "currency", currency: pricing.pro.monthly.currency }).format(pricing.pro.monthly.amount! * 12) : null;
	const previous = hasPromo ? pricing.pro[selectedFrequency].formatted : yearlyReference;
	const suffix = frequencies.find((frequency) => frequency.key === selectedFrequency)?.priceSuffix;
	return (
		<div>
			{previous ? (
				<span className='sr-only'>
					{hasPromo ? "Regular price" : "Twelve monthly payments"}: {previous}.{" "}
				</span>
			) : null}
			<p className='flex flex-wrap items-baseline gap-2 tabular-nums'>
				{previous ? (
					<span aria-hidden='true' className='text-lg text-foreground/75 line-through'>
						{previous}
					</span>
				) : null}
				<span className={`text-4xl font-bold leading-none tracking-tight ${isPro ? "text-danger" : "text-foreground"}`}>{hasPromo ? `${campaignPrice} EUR` : isPro ? pricing.pro[selectedFrequency].formatted : (tier.price as string)}</span>
				{isPro ? <span className='text-sm font-medium text-foreground/75'>/{suffix}</span> : null}
			</p>
		</div>
	);
}
