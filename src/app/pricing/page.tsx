import type { Metadata } from "next";
import PricingFaq from "@components/Pricing/pricing-faq";

import BasicNavbar from "@components/LandingPage/basicNavbar";
import Footer from "@components/footer";
import PricingComparison from "@components/Pricing/comparison";
import { getActiveCampaignOffer } from "@lib/campaignOffers";
import { resolveBillingCatalog } from "@/server/billingCatalog";
import { BillingProduct } from "@types";
import { FrequencyEnum, type RuntimePricing } from "@components/Pricing/pricing-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Pricing | Clipify",
	description: "Compare Clipify Free and Pro, including self-hosted Runner broadcasting with unlimited streaming hours.",
	alternates: { canonical: "https://clipify.us/pricing" },
	openGraph: { title: "Pricing | Clipify", url: "https://clipify.us/pricing" },
};

const pricingFaq = [
	{
		title: "Can I use Clipify for free?",
		content: "Yes. Free includes unlimited Twitch clips, one overlay, one 50-clip playlist, a branded gallery, a Creator Page, and essential playback tools.",
	},
	{ title: "Can I try Pro without a card?", content: "Eligible new creators receive seven days of Pro access without entering card details. Afterward, continue on Free unless you choose a paid plan. Returning creators do not receive another new-creator trial." },
	{
		title: "Do I need to keep my computer running?",
		content: "Your OBS computer needs to run while you stream. If you use the optional Runner, the computer running it must also stay on and connected. Runner is not required for an OBS browser-source setup.",
	},
	{
		title: "Can I switch between monthly and yearly billing?",
		content: "Yes. Choose monthly or yearly billing before checkout. Annual plans are billed once per year.",
	},
	{
		title: "What happens if I stop using Pro?",
		content: "Your account returns to Free. Your saved settings and content are kept, and you can use Pro features again by resubscribing.",
	},
];

export default async function PricingPage() {
	const [campaignOffer, catalog] = await Promise.all([getActiveCampaignOffer(), resolveBillingCatalog()]);
	const pricing: RuntimePricing = {
		pro: {
			[FrequencyEnum.Monthly]: catalog[BillingProduct.Pro].monthly,
			[FrequencyEnum.Yearly]: catalog[BillingProduct.Pro].yearly,
		},
	};

	return (
		<div className='min-h-screen bg-background'>
			<BasicNavbar shouldHideOnScroll={false} />
			<main>
				<section className='px-4'>
					<PricingComparison campaignOffer={campaignOffer} pricing={pricing} />
				</section>

				<section id='faq' className='px-4 py-20'>
					<div className='mx-auto max-w-4xl'>
						<div className='mb-10 text-center'>
							<h2 className='text-3xl font-bold'>Pricing questions</h2>
							<p className='mt-3 text-foreground/75'>The details people usually want before choosing a plan.</p>
						</div>
						<PricingFaq items={pricingFaq} />
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
}
