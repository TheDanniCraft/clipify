"use client";

import TierPrice from "./TierPrice";

import React, { useState } from "react";
import type { CampaignOffer } from "@types";
import { Button, Card, Chip, Separator, Link, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { IconArrowRight, IconCheck, IconHeart } from "@tabler/icons-react";

import { frequencies, runnerIncluded, tiers } from "./pricing-catalog";
import { FrequencyEnum, resolveRuntimePricing, type RuntimePricing } from "./pricing-types";
import { trackPaywallEvent } from "@lib/paywallTracking";
import ProSetupModal from "./ProSetupModal";
import BillingFrequency from "./BillingFrequency";

type TiersComponentProps = {
	source?: "homepage" | "pricing_page";
	campaignOffer?: CampaignOffer | null;
	context?: "public" | "dashboard";
	showComparisonLink?: boolean;
	showPlanActions?: boolean;
	showRunner?: boolean;
	pricing?: RuntimePricing | null;
};

export default function TiersComponent({ source = "pricing_page", campaignOffer = null, context = "public", showComparisonLink = true, showPlanActions = true, showRunner = true, pricing = null }: TiersComponentProps) {
	const [selectedFrequency, setSelectedFrequency] = useState(frequencies.find((frequency) => frequency.key === FrequencyEnum.Yearly) ?? frequencies[0]);
	const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
	const runtimePricing = resolveRuntimePricing(pricing);

	const proPromoEnabled = Boolean(campaignOffer?.showPricingTierPromo);
	const pricingPromoByFrequency = {
		[FrequencyEnum.Monthly]: campaignOffer?.pricingMonthlyPromo ?? null,
		[FrequencyEnum.Yearly]: campaignOffer?.pricingYearlyPromo ?? null,
	};

	const onFrequencyChange = (selectedKey: React.Key) => {
		const frequency = frequencies.find((item) => item.key === selectedKey);
		if (frequency) setSelectedFrequency(frequency);
	};

	const integrationHref = () => (context === "dashboard" ? `/dashboard/settings?upgrade&cycle=${selectedFrequency.key}&source=pricing_page&feature=plan` : `/checkout/start?plan=pro&cycle=${selectedFrequency.key}&entrypoint=direct_cta`);
	const openProSetup = () => {
		trackPaywallEvent("paywall_cta_click", { source, feature: "plan", plan: "pro", cycle: selectedFrequency.key });
		setIsPlanModalOpen(true);
	};

	return (
		<div className='@container relative mx-auto flex w-full max-w-3xl flex-col items-center'>
			<BillingFrequency value={selectedFrequency.key} onChange={onFrequencyChange} pricing={proPromoEnabled ? null : pricing} />

			<div className='mt-8 grid w-full grid-cols-1 items-stretch gap-4 @min-[32rem]:grid-cols-2'>
				{tiers.map((tier) => {
					const promoPrice = pricingPromoByFrequency[selectedFrequency.key];
					const hasPromoPrice = tier.key === "pro" && proPromoEnabled && promoPrice !== null;

					return (
						<Card key={tier.key} variant='default' className={cn("h-full shadow-md", tier.mostPopular && "border border-accent/50 bg-accent/3")}>
							{hasPromoPrice ? (
								<Chip className='absolute right-4 top-4 shadow-lg' variant='primary' color='accent'>
									Limited offer
								</Chip>
							) : tier.mostPopular ? (
								<Chip className='absolute right-4 top-4' color='accent' variant='primary'>
									More control
								</Chip>
							) : null}
							<Card.Header className='flex flex-col items-start gap-2 pb-5'>
								<h2 className='pe-28 text-xl font-semibold'>{tier.title}</h2>
								<p className='text-sm text-foreground/75'>{tier.description}</p>
							</Card.Header>
							<Separator />
							<Card.Content className='flex flex-col gap-5'>
								<div className='flex min-h-20 flex-col justify-end'>
									<TierPrice campaignOffer={campaignOffer} pricing={runtimePricing} selectedFrequency={selectedFrequency.key} tier={tier} />
								</div>
								<ul className='flex flex-col gap-2.5'>
									{tier.summaryFeatures?.map((feature) => (
										<li key={feature} className='flex items-start gap-2'>
											<IconCheck className='mt-0.5 shrink-0 text-accent' width={20} />
											<span className='text-sm text-foreground/75'>{feature}</span>
										</li>
									))}
								</ul>
								{tier.personalNote ? (
									<div className='mt-auto flex items-start gap-2 rounded-xl bg-surface-secondary p-3 text-xs text-foreground/75'>
										<IconHeart className='mt-0.5 shrink-0 text-accent' width={17} />
										<p>{tier.personalNote}</p>
									</div>
								) : null}
							</Card.Content>
							{showPlanActions ? (
								<Card.Footer>
									{tier.key === "pro" && context === "public" ? (
										<Button fullWidth variant='primary' isDisabled={runtimePricing.pro[selectedFrequency.key].amount === null} className='shadow-md' onPress={openProSetup}>
											{tier.buttonText}
										</Button>
									) : (
										<Link
											href={tier.key === "free" ? (context === "dashboard" ? "/dashboard" : "/checkout/clear") : integrationHref()}
											aria-label={tier.buttonText}
											onPress={() => trackPaywallEvent("paywall_cta_click", { source, feature: "plan", plan: tier.key, cycle: selectedFrequency.key })}
											className={buttonVariants({ fullWidth: true, variant: tier.mostPopular ? "primary" : "secondary", className: cn("no-underline", tier.key === "free" && "text-foreground", tier.mostPopular && "shadow-md") })}
										>
											{tier.buttonText}
										</Link>
									)}
								</Card.Footer>
							) : null}
						</Card>
					);
				})}
			</div>

			{runtimePricing.pro[selectedFrequency.key].amount === null ? (
				<p role='status' className='mt-4 text-sm text-foreground/75'>
					Pro pricing is temporarily unavailable. <Link href='/pricing'>Check current pricing</Link> or continue with Free.
				</p>
			) : null}

			<Card variant='secondary' className='mt-4 w-full border border-accent/30'>
				<Card.Content className='flex flex-col gap-4 @min-[40rem]:flex-row @min-[40rem]:items-center @min-[40rem]:justify-between'>
					<div>
						<h2 className='font-semibold'>Agency or enterprise?</h2>
						<p className='mt-1 text-sm text-foreground/75'>Manage multiple independent creators, team permissions, and centrally assigned Pro seats with custom commercial terms.</p>
					</div>
					<Link href='mailto:contact@clipify.us?subject=Clipify%20Agency%20or%20Enterprise' className={buttonVariants({ variant: "outline", className: "shrink-0 no-underline" })}>
						Contact us for custom pricing
					</Link>
				</Card.Content>
			</Card>

			{showComparisonLink ? (
				<Link href='/pricing' className={buttonVariants({ variant: "outline", fullWidth: true, className: "mt-4 gap-2 no-underline sm:w-auto sm:min-w-64" })}>
					Compare Free and Pro
					<IconArrowRight width={18} />
				</Link>
			) : null}

			{showRunner ? (
				<Card variant='secondary' className='mt-4 w-full border border-default/60'>
					<Card.Content className='flex flex-col gap-4 @min-[40rem]:flex-row @min-[40rem]:items-center @min-[40rem]:justify-between'>
						<div className='min-w-0 flex-1'>
							<h2 className='font-semibold'>{runnerIncluded.title}</h2>
							<p className='mt-1 text-sm text-foreground/75'>{runnerIncluded.description}</p>
							<p className='mt-1 text-xs font-medium text-foreground/75'>{runnerIncluded.availability}</p>
						</div>
						<Link href='/runner/enroll' className={buttonVariants({ variant: "secondary", className: "shrink-0 no-underline" })}>
							Set up Runner
						</Link>
					</Card.Content>
				</Card>
			) : null}

			{context === "public" ? <ProSetupModal source={source} isOpen={isPlanModalOpen} onOpenChange={setIsPlanModalOpen} pricing={runtimePricing} selectedFrequency={selectedFrequency.key} entrypoint='direct_cta' /> : null}
		</div>
	);
}
