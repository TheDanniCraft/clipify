"use client";

import React, { useState } from "react";
import type { CampaignOffer } from "@types";
import { Card, Chip, Separator, Link, Tabs, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";


import { tiers, frequencies } from "./pricing-tiers";
import { IconCheck } from "@tabler/icons-react";
import { FrequencyEnum } from "./pricing-types";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";

type TiersComponentProps = {
	campaignOffer?: CampaignOffer | null;
};

export default function TiersComponent({ campaignOffer = null }: TiersComponentProps) {
	const [selectedFrequency, setSelectedFrequency] = useState(frequencies.find((f) => f.key === FrequencyEnum.Yearly) ?? frequencies[0]);
	const plausible = usePlausible();
	const proPromoEnabled = Boolean(campaignOffer?.showPricingTierPromo);
	const pricingPromoByFrequency = {
		[FrequencyEnum.Monthly]: campaignOffer?.pricingMonthlyPromo ?? null,
		[FrequencyEnum.Yearly]: campaignOffer?.pricingYearlyPromo ?? null,
	};

	const formatPromoPrice = (value: number | null) => (typeof value === "number" ? `${value} EUR` : null);

	const onFrequencyChange = (selectedKey: React.Key) => {
		const frequencyIndex = frequencies.findIndex((f) => f.key === selectedKey);

		setSelectedFrequency(frequencies[frequencyIndex]);
	};

	return (
		<div className='relative mx-auto flex max-w-3xl flex-col items-center'>
			<Tabs
				className='mx-auto w-fit max-w-full'
				onSelectionChange={onFrequencyChange}
				selectedKey={selectedFrequency.key}
			>
				<Tabs.ListContainer className='mx-auto w-fit max-w-full'><Tabs.List aria-label='Billing frequency' className='mx-auto w-fit max-w-full *:w-fit'>
					<Tabs.Tab id={FrequencyEnum.Monthly} className='flex-none whitespace-nowrap px-3 data-[hover-unselected=true]:opacity-90'>Pay Monthly<Tabs.Indicator /></Tabs.Tab>
					<Tabs.Tab id={FrequencyEnum.Yearly} aria-label='Pay Yearly' className='flex-none px-3 data-[hover-unselected=true]:opacity-90'>
						<div className='flex min-w-0 items-center gap-1'>
							<p className='whitespace-nowrap'>Pay Yearly</p>
							<Chip color='accent' size='sm' variant='primary'>2 months free</Chip>
						</div>
						<Tabs.Indicator />
					</Tabs.Tab>
				</Tabs.List></Tabs.ListContainer>
			</Tabs>
			<div className='h-12' aria-hidden='true' />
			{/* Grid ---> "xs" to "lg" */}
			<div className='grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2'>
				{tiers.slice(0, 2).map((tier) => {
					const checkoutHref = `/login?returnUrl=${encodeURIComponent(`/dashboard/settings?upgrade&cycle=${selectedFrequency.key}&source=pricing_page&feature=plan`)}`;
					const hasPromoPrice = pricingPromoByFrequency[selectedFrequency.key] !== null;

					return (
						<Card key={tier.key} variant='default' className={cn("h-full shadow-md", {
							"border border-accent/50": tier.mostPopular,
						})}>
							{tier.key === "pro" && proPromoEnabled && hasPromoPrice ? (
								<Chip className='absolute right-4 top-4 shadow-lg' variant='primary' color='accent'>
									Limited offer
								</Chip>
							) : tier.mostPopular ? (
								<Chip className='absolute right-4 top-4' color='accent' variant='primary'>
									Most Popular
								</Chip>
							) : null}
							<Card.Header className='flex flex-col items-start gap-2 pb-6'>
								<h2 className='text-lg font-medium'>{tier.title}</h2>
								<p className='text-base text-muted'>{tier.description}</p>
							</Card.Header>
							<Separator />
							<Card.Content className='gap-8'>
								<div className='min-h-[5.5rem] flex flex-col justify-end'>
									<p className='flex items-end gap-2 pt-2 tabular-nums'>
										{typeof tier.price !== "string" && tier.key === "pro" && proPromoEnabled && hasPromoPrice ? (
											<>
												{/* Old price - smaller, muted, clean strike */}
												<span className='inline text-xl md:text-2xl font-medium text-muted/60 line-through decoration-2 decoration-muted/50 underline-offset-4' aria-hidden='true'>
													{tier.price[selectedFrequency.key]}
												</span>

												{/* New price - bold, tight leading */}
												<span className='inline text-4xl md:text-5xl font-extrabold leading-none tracking-tight text-brand-secondary'>{formatPromoPrice(pricingPromoByFrequency[selectedFrequency.key])}</span>

												{/* Suffix */}
												<span className='text-sm font-medium text-muted leading-none'>/{selectedFrequency.priceSuffix}</span>
											</>
										) : (
											<>
												<span className='inline text-4xl md:text-5xl font-extrabold leading-none tracking-tight'>{typeof tier.price === "string" ? tier.price : tier.price[selectedFrequency.key]}</span>
												{typeof tier.price !== "string" && <span className='text-sm font-medium text-muted leading-none'>/{selectedFrequency.priceSuffix}</span>}
											</>
										)}
									</p>
								</div>
								<p
									className={cn("text-xs font-medium h-4", {
										"text-success": tier.key === "pro" && selectedFrequency.key === FrequencyEnum.Yearly,
										"invisible": !(tier.key === "pro" && selectedFrequency.key === FrequencyEnum.Yearly),
									})}
								>
									Save 2 months with yearly billing
								</p>
							<ul className='flex flex-col gap-2'>
								{tier.features?.map((feature) => (
									<li key={feature} className='flex items-center gap-2'>
										<IconCheck className='text-accent' width={24} />
										<p className='text-muted'>{feature}</p>
									</li>
								))}
							</ul>
						</Card.Content>
						<Card.Footer>
							<Link href={checkoutHref} aria-label={tier.buttonText} onPress={() => {
									trackPaywallEvent(plausible, "paywall_cta_click", {
										source: "pricing_page",
										feature: "plan",
										plan: tier.key,
										cycle: selectedFrequency.key,
									});
								}} className={buttonVariants({
									fullWidth: true,
									variant: tier.mostPopular ? "primary" : "secondary",
									className: cn("no-underline", tier.mostPopular && "shadow-md"),
								})}>
								{tier.buttonText}
							</Link>
						</Card.Footer>
					</Card>
				);
				})}
			</div>
			<div className='h-12' aria-hidden='true' />
		</div>
	);
}
