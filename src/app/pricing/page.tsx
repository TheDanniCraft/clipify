import type { Metadata } from "next";
import { Accordion } from "@heroui/react";

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
	description: "Compare Clipify Free and Pro, explore every feature, and add a self-hosted Runner when you need one.",
};

const pricingFaq = [
	{
		title: "Can I use Clipify for free?",
		content: "Yes. Free includes unlimited Twitch clips, one overlay, one 50-clip playlist, a branded gallery, a Creator Page, and essential playback tools.",
	},
	{
		title: "Is the Self-hosted Runner a separate plan?",
		content: "No. The Runner is an optional add-on that works with either Free or Pro and runs on your own hardware.",
	},
	{
		title: "Can I switch between monthly and yearly billing?",
		content: "Yes. Pro and the Runner support monthly and yearly billing. Yearly billing includes two months free compared with monthly billing.",
	},
	{
		title: "What happens if I stop using Pro?",
		content: "Your account returns to the Free limits. Clipify preserves supported data according to the downgrade rules shown in the relevant feature settings.",
	},
];

export default async function PricingPage() {
	const [campaignOffer, catalog] = await Promise.all([getActiveCampaignOffer(), resolveBillingCatalog()]);
	const pricing: RuntimePricing = {
		pro: {
			[FrequencyEnum.Monthly]: catalog[BillingProduct.Pro].monthly,
			[FrequencyEnum.Yearly]: catalog[BillingProduct.Pro].yearly,
		},
		runner: {
			[FrequencyEnum.Monthly]: catalog[BillingProduct.RunnerSelfHosted].monthly,
			[FrequencyEnum.Yearly]: catalog[BillingProduct.RunnerSelfHosted].yearly,
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
							<p className='mt-3 text-muted'>The details people usually want before choosing a plan.</p>
						</div>
						<Accordion variant='surface'>
							{pricingFaq.map((item) => (
								<Accordion.Item key={item.title} id={item.title}>
									<Accordion.Heading>
										<Accordion.Trigger>
											{item.title}
											<Accordion.Indicator />
										</Accordion.Trigger>
									</Accordion.Heading>
									<Accordion.Panel>
										<Accordion.Body>{item.content}</Accordion.Body>
									</Accordion.Panel>
								</Accordion.Item>
							))}
						</Accordion>
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
}
