"use client";

import React, { useState } from "react";
import type { CampaignOffer } from "@types";
import { Button, Card, Chip, Separator, Link, Tabs, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { IconArrowRight, IconCheck, IconHeart } from "@tabler/icons-react";
import { usePlausible } from "next-plausible";

import { frequencies, runnerAddon, tiers } from "./pricing-catalog";
import { FrequencyEnum, resolveRuntimePricing, type RuntimePricing } from "./pricing-types";
import { trackPaywallEvent } from "@lib/paywallTracking";
import ProSetupModal from "./ProSetupModal";

type TiersComponentProps = {
	campaignOffer?: CampaignOffer | null;
	context?: "public" | "dashboard";
	showComparisonLink?: boolean;
	showPlanActions?: boolean;
	showRunner?: boolean;
	pricing?: RuntimePricing | null;
};

export default function TiersComponent({ campaignOffer = null, context = "public", showComparisonLink = true, showPlanActions = true, showRunner = true, pricing = null }: TiersComponentProps) {
	const [selectedFrequency, setSelectedFrequency] = useState(frequencies.find((frequency) => frequency.key === FrequencyEnum.Yearly) ?? frequencies[0]);
	const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
	const runtimePricing = resolveRuntimePricing(pricing);
	const plausible = usePlausible();
	const proPromoEnabled = Boolean(campaignOffer?.showPricingTierPromo);
	const pricingPromoByFrequency = {
		[FrequencyEnum.Monthly]: campaignOffer?.pricingMonthlyPromo ?? null,
		[FrequencyEnum.Yearly]: campaignOffer?.pricingYearlyPromo ?? null,
	};

	const onFrequencyChange = (selectedKey: React.Key) => {
		const frequency = frequencies.find((item) => item.key === selectedKey);
		if (frequency) setSelectedFrequency(frequency);
	};

	const integrationHref = (kind: "plan" | "runner") => {
		const query = kind === "runner" ? `addon=runner&cycle=${selectedFrequency.key}&source=pricing_page` : `upgrade&cycle=${selectedFrequency.key}&source=pricing_page&feature=plan`;
		const dashboardHref = `/dashboard/settings?${query}`;
		if (context === "dashboard") return dashboardHref;
		return kind === "runner" ? `/checkout/start?runner=true&cycle=${selectedFrequency.key}&entrypoint=runner_addon` : `/checkout/start?plan=pro&cycle=${selectedFrequency.key}&entrypoint=direct_cta`;
	};
	const openProSetup = () => {
		trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: "pro", cycle: selectedFrequency.key });
		setIsPlanModalOpen(true);
	};

	return (
		<div className='relative mx-auto flex w-full max-w-3xl flex-col items-center'>
			<Tabs className='mx-auto w-fit max-w-full' onSelectionChange={onFrequencyChange} selectedKey={selectedFrequency.key}>
				<Tabs.ListContainer className='mx-auto w-fit max-w-full'>
					<Tabs.List aria-label='Billing frequency' className='mx-auto w-fit max-w-full *:w-fit'>
						<Tabs.Tab id={FrequencyEnum.Monthly} className='flex-none whitespace-nowrap px-3 data-[hover-unselected=true]:opacity-90'>
							Pay Monthly
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id={FrequencyEnum.Yearly} aria-label='Pay Yearly' className='flex-none px-3 data-[hover-unselected=true]:opacity-90'>
							<div className='flex min-w-0 items-center gap-1'>
								<span className='whitespace-nowrap'>Pay Yearly</span>
								<Chip color='accent' size='sm' variant='primary'>
									2 months free
								</Chip>
							</div>
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>
			</Tabs>

			<div className='mt-8 grid w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2'>
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
									Most Popular
								</Chip>
							) : null}
							<Card.Header className='flex flex-col items-start gap-2 pb-5 pe-28'>
								<h2 className='text-xl font-semibold'>{tier.title}</h2>
								<p className='text-sm text-muted'>{tier.description}</p>
							</Card.Header>
							<Separator />
							<Card.Content className='flex flex-col gap-5'>
								<div className='flex min-h-20 flex-col justify-end'>
									<p className='flex flex-wrap items-end gap-2 pt-2 tabular-nums'>
										{typeof tier.price !== "string" && hasPromoPrice ? (
											<>
												<span className='text-xl font-medium text-muted/60 line-through decoration-2' aria-hidden='true'>
													{runtimePricing.pro[selectedFrequency.key].formatted}
												</span>
												<span className='text-4xl font-extrabold leading-none tracking-tight text-brand-secondary'>{promoPrice} EUR</span>
											</>
										) : (
											<span className='text-4xl font-extrabold leading-none tracking-tight'>{typeof tier.price === "string" ? tier.price : runtimePricing.pro[selectedFrequency.key].formatted}</span>
										)}
										{typeof tier.price !== "string" ? <span className='text-sm font-medium leading-none text-muted'>/{selectedFrequency.priceSuffix}</span> : null}
									</p>
									<p className={cn("mt-2 h-4 text-xs font-medium", tier.key === "pro" && selectedFrequency.key === FrequencyEnum.Yearly ? "text-success" : "invisible")}>Save 2 months with yearly billing</p>
								</div>
								<ul className='flex flex-col gap-2.5'>
									{tier.summaryFeatures?.map((feature) => (
										<li key={feature} className='flex items-start gap-2'>
											<IconCheck className='mt-0.5 shrink-0 text-accent' width={20} />
											<span className='text-sm text-muted'>{feature}</span>
										</li>
									))}
								</ul>
								{tier.personalNote ? (
									<div className='mt-auto flex items-start gap-2 rounded-xl bg-surface-secondary p-3 text-xs text-muted'>
										<IconHeart className='mt-0.5 shrink-0 text-accent' width={17} />
										<p>{tier.personalNote}</p>
									</div>
								) : null}
							</Card.Content>
							{showPlanActions ? (
								<Card.Footer>
									{tier.key === "pro" && context === "public" ? (
										<Button fullWidth variant='primary' className='shadow-md' onPress={openProSetup}>
											{tier.buttonText}
										</Button>
									) : (
										<Link href={tier.key === "free" ? (context === "dashboard" ? "/dashboard" : "/checkout/clear") : integrationHref("plan")} aria-label={tier.buttonText} onPress={() => trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: tier.key, cycle: selectedFrequency.key })} className={buttonVariants({ fullWidth: true, variant: tier.mostPopular ? "primary" : "secondary", className: cn("no-underline", tier.mostPopular && "shadow-md") })}>
											{tier.buttonText}
										</Link>
									)}
								</Card.Footer>
							) : null}
						</Card>
					);
				})}
			</div>

			{showComparisonLink ? (
				<Link href='/pricing' className={buttonVariants({ variant: "outline", fullWidth: true, className: "mt-4 gap-2 no-underline sm:w-auto sm:min-w-64" })}>
					Compare all features
					<IconArrowRight width={18} />
				</Link>
			) : null}

			{showRunner ? (
				<Card variant='secondary' className='mt-4 w-full border border-accent/30'>
					<Card.Content className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
						<div className='min-w-0 flex-1'>
							<div className='flex flex-wrap items-center gap-2'>
								<h2 className='font-semibold'>{runnerAddon.title} add-on</h2>
								<Chip size='sm' variant='tertiary'>
									Optional
								</Chip>
							</div>
							<p className='mt-1 text-sm text-muted'>{runnerAddon.description}</p>
							<p className='mt-1 text-xs font-medium text-muted'>{runnerAddon.availability}</p>
							<Link className='mt-2 text-xs' href='mailto:contact@clipify.us?subject=Managed%20Runner'>
								Need a managed Runner?
							</Link>
						</div>
						<div className='flex shrink-0 flex-col gap-2 sm:items-end sm:text-right'>
							<p className='font-semibold tabular-nums'>
								{runtimePricing.runner[selectedFrequency.key].formatted} / {selectedFrequency.key === FrequencyEnum.Monthly ? "month" : "year"}
							</p>
							{context === "dashboard" ? (
								<Link href={integrationHref("runner")} className={buttonVariants({ variant: "primary", className: "no-underline" })}>
									Add Runner
								</Link>
							) : (
								<p className='max-w-52 text-xs text-muted'>Select Get Pro to include it during setup.</p>
							)}
						</div>
					</Card.Content>
				</Card>
			) : null}

			{context === "public" ? <ProSetupModal isOpen={isPlanModalOpen} onOpenChange={setIsPlanModalOpen} pricing={runtimePricing} selectedFrequency={selectedFrequency.key} entrypoint='direct_cta' /> : null}
		</div>
	);
}
