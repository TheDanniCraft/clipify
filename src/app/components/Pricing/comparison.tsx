"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CampaignOffer } from "@types";
import { Button, Card, Chip, Link, Separator, Tooltip, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { IconCheck, IconHeart, IconInfoCircle, IconMinus } from "@tabler/icons-react";
import { usePlausible } from "next-plausible";

import { frequencies, pricingFeatures, tiers } from "./pricing-catalog";
import type { PricingFeatureItem } from "./pricing-comparison-types";
import { FrequencyEnum, resolveRuntimePricing, type RuntimePricing, type Tier } from "./pricing-types";
import { trackPaywallEvent } from "@lib/paywallTracking";
import ProSetupModal from "./ProSetupModal";
import BillingFrequency from "./BillingFrequency";

function FeatureValue({ plan, value }: { plan: string; value: boolean | string }) {
	if (value === true) {
		return (
			<>
				<IconCheck aria-hidden className='mx-auto text-success' width={21} />
				<span className='sr-only'>Included in {plan}</span>
			</>
		);
	}
	if (value === false) {
		return (
			<>
				<IconMinus aria-hidden className='mx-auto text-foreground/75' width={21} />
				<span className='sr-only'>Not included in {plan}</span>
			</>
		);
	}
	return <span className='text-sm font-medium text-foreground/75'>{value}</span>;
}

function FeatureTitle({ item }: { item: PricingFeatureItem }) {
	const [isHoverOpen, setIsHoverOpen] = useState(false);
	const [isPinnedOpen, setIsPinnedOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const isOpen = isHoverOpen || isPinnedOpen;

	useEffect(() => {
		if (!isPinnedOpen) return;

		const closeOnOutsidePress = (event: PointerEvent) => {
			if (!triggerRef.current?.contains(event.target as Node)) setIsPinnedOpen(false);
		};

		document.addEventListener("pointerdown", closeOnOutsidePress, true);
		return () => document.removeEventListener("pointerdown", closeOnOutsidePress, true);
	}, [isPinnedOpen]);

	return (
		<div className='flex items-center gap-1.5'>
			<span>{item.title}</span>
			<Tooltip delay={0} closeDelay={100} isOpen={isOpen} onOpenChange={setIsHoverOpen}>
				<Button ref={triggerRef} isIconOnly aria-expanded={isOpen} aria-label={`About ${item.title}`} className='h-6 min-h-6 w-6 min-w-6 shrink-0 text-foreground/75' size='sm' variant='ghost' onBlur={() => setIsPinnedOpen(false)} onPress={() => setIsPinnedOpen((current) => !current)}>
					<IconInfoCircle aria-hidden width={17} />
				</Button>
				<Tooltip.Content showArrow placement='right' className='w-80 max-w-[calc(100vw-2rem)] break-normal text-sm leading-relaxed'>
					<Tooltip.Arrow />
					<p>{item.helpText}</p>
				</Tooltip.Content>
			</Tooltip>
		</div>
	);
}

function TierPrice({ campaignOffer, pricing, selectedFrequency, tier }: { campaignOffer: CampaignOffer | null; pricing: RuntimePricing; selectedFrequency: FrequencyEnum; tier: Tier }) {
	const campaignPrice = selectedFrequency === FrequencyEnum.Monthly ? campaignOffer?.pricingMonthlyPromo : campaignOffer?.pricingYearlyPromo;
	const hasPromo = tier.key === "pro" && campaignOffer?.showPricingTierPromo && typeof campaignPrice === "number";
	const suffix = frequencies.find((frequency) => frequency.key === selectedFrequency)?.priceSuffix;

	return (
		<div>
			<p className='flex flex-wrap items-baseline gap-2 tabular-nums'>
				{typeof tier.price !== "string" && hasPromo ? (
					<>
						<span aria-hidden className='text-lg text-foreground/75 line-through'>
							{pricing.pro[selectedFrequency].formatted}
						</span>
						<span className='text-4xl font-semibold leading-8 tracking-tight text-brand-secondary'>{campaignPrice} EUR</span>
					</>
				) : (
					<span className='text-4xl font-semibold leading-8 tracking-tight'>{typeof tier.price === "string" ? tier.price : pricing.pro[selectedFrequency].formatted}</span>
				)}
				{typeof tier.price !== "string" ? <span className='text-sm font-medium text-foreground/75'>/{suffix}</span> : null}
			</p>
		</div>
	);
}

export default function PricingComparison({ campaignOffer = null, pricing }: { campaignOffer?: CampaignOffer | null; pricing?: RuntimePricing | null }) {
	const resolvedPricing = resolveRuntimePricing(pricing);
	const [selectedFrequency, setSelectedFrequency] = useState(FrequencyEnum.Yearly);
	const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
	const plausible = usePlausible();
	const onFrequencyChange = (key: React.Key) => {
		if (key === FrequencyEnum.Monthly || key === FrequencyEnum.Yearly) setSelectedFrequency(key);
	};
	const freeHref = "/checkout/clear";
	const openProSetup = () => {
		trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: "pro", cycle: selectedFrequency });
		setIsPlanModalOpen(true);
	};

	return (
		<div className='mx-auto flex w-full max-w-7xl flex-col items-center py-24'>
			<div className='flex max-w-xl flex-col text-center'>
				<Chip color='accent' variant='primary' className='mx-auto mb-4'>
					Pricing
				</Chip>
				<h1 className='text-4xl font-medium tracking-tight'>Compare plans &amp; features.</h1>
				<p className='mt-4 text-lg text-foreground/75'>Discover the ideal plan for your Clipify setup, starting free.</p>
			</div>
			<div className='mt-8'>
				<BillingFrequency value={selectedFrequency} onChange={onFrequencyChange} pricing={campaignOffer?.showPricingTierPromo ? null : pricing} />
			</div>

			{resolvedPricing.pro[selectedFrequency].amount === null ? (
				<p role='status' className='mt-4 text-center text-sm text-foreground/75'>
					Pro pricing is temporarily unavailable. Please try again later or continue with Free.
				</p>
			) : null}

			<div className='mt-12 w-full lg:hidden'>
				<div className='grid gap-4 sm:grid-cols-2'>
					{tiers.map((tier) => (
						<Card key={tier.key} className={cn("relative p-3 shadow-none", tier.mostPopular ? "border border-default/70 bg-surface-secondary" : "border border-default/60 bg-transparent")}>
							{tier.mostPopular ? (
								<Chip className='absolute right-4 top-4' color='accent' variant='primary'>
									More control
								</Chip>
							) : null}
							<Card.Header className='flex flex-col items-start gap-2 pb-6'>
								<h2 className='pe-28 text-lg font-medium'>{tier.title}</h2>
								<p className='text-sm text-foreground/75'>{tier.description}</p>
							</Card.Header>
							<Separator />
							<Card.Content className='gap-6'>
								<TierPrice campaignOffer={campaignOffer} pricing={resolvedPricing} selectedFrequency={selectedFrequency} tier={tier} />
								<ul className='space-y-2'>
									{tier.summaryFeatures?.map((feature) => (
										<li key={feature} className='flex items-start gap-2 text-sm text-foreground/75'>
											<IconCheck className='mt-0.5 shrink-0 text-accent' width={18} />
											{feature}
										</li>
									))}
								</ul>
								{tier.personalNote ? (
									<p className='flex items-start gap-2 text-xs text-foreground/75'>
										<IconHeart className='mt-0.5 shrink-0 text-accent' width={16} />
										{tier.personalNote}
									</p>
								) : null}
							</Card.Content>
							<Card.Footer>
								{tier.key === "pro" ? (
									<Button fullWidth variant='primary' isDisabled={resolvedPricing.pro[selectedFrequency].amount === null} onPress={openProSetup}>
										{tier.buttonText}
									</Button>
								) : (
									<Link href={freeHref} onPress={() => trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: tier.key, cycle: selectedFrequency })} className={buttonVariants({ fullWidth: true, variant: "secondary", className: "no-underline text-foreground" })}>
										{tier.buttonText}
									</Link>
								)}
							</Card.Footer>
						</Card>
					))}
				</div>

				<div className='mt-10'>
					<h2 className='mb-5 text-2xl font-semibold'>Compare what is included</h2>
					<div className='sticky top-16 z-10 grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] border-b border-border bg-background py-3 text-sm font-semibold'>
						<span>Feature</span>
						<span className='text-center'>Free</span>
						<span className='text-center'>Pro</span>
					</div>
					{pricingFeatures.map((group) => (
						<section key={group.title} className='mt-7'>
							<h3 className='border-b border-border pb-3 text-base font-semibold'>{group.title}</h3>
							{group.items.map((item) => (
								<div key={item.title} className='grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-y-2 border-b border-border/60 py-4 text-sm'>
									<FeatureTitle item={item} />
									<div className='text-center'>
										<FeatureValue plan='Free' value={item.tiers.free} />
									</div>
									<div className='text-center'>
										<FeatureValue plan='Pro' value={item.tiers.pro} />
									</div>
								</div>
							))}
						</section>
					))}
				</div>
			</div>

			<div className='isolate mt-12 hidden w-full lg:block'>
				<div className='relative'>
					<table className='w-full table-fixed border-separate border-spacing-x-4 text-left'>
						<caption className='sr-only'>Clipify plan comparison</caption>
						<colgroup>
							<col className='w-1/3' />
							<col className='w-1/3' />
							<col className='w-1/3' />
						</colgroup>
						<thead>
							<tr>
								<td className='bg-background' />
								{tiers.map((tier) => (
									<th key={tier.key} scope='col' className={cn("relative bg-background px-6 pt-5 xl:px-8", tier.mostPopular && "rounded-t-2xl bg-surface-secondary")}>
										<div className='mb-2 flex h-5 items-center'>
											{tier.mostPopular ? (
												<Chip color='accent' size='sm' variant='primary'>
													More control
												</Chip>
											) : null}
										</div>
										<h2 className='relative text-lg font-medium'>{tier.title}</h2>
									</th>
								))}
							</tr>
							<tr>
								<th scope='row' className='bg-background'>
									<span className='sr-only'>Price</span>
								</th>
								{tiers.map((tier) => (
									<td key={tier.key} className={cn("relative bg-background px-6 py-4 xl:px-8", tier.mostPopular && "bg-surface-secondary")}>
										<TierPrice campaignOffer={campaignOffer} pricing={resolvedPricing} selectedFrequency={selectedFrequency} tier={tier} />
										{tier.key === "pro" ? (
											<Button fullWidth variant='primary' className='mt-6 shadow-sm' isDisabled={resolvedPricing.pro[selectedFrequency].amount === null} onPress={openProSetup}>
												{tier.buttonText}
											</Button>
										) : (
											<Link href={freeHref} onPress={() => trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: tier.key, cycle: selectedFrequency })} className={buttonVariants({ fullWidth: true, variant: "secondary", className: "mt-6 no-underline text-foreground" })}>
												{tier.buttonText}
											</Link>
										)}
									</td>
								))}
							</tr>
						</thead>
						<tbody>
							{pricingFeatures.map((group, groupIndex) => (
								<React.Fragment key={group.title}>
									<tr>
										<th scope='rowgroup' className={cn("relative pb-4 pt-12 text-lg font-semibold", groupIndex === 0 && "pt-16")}>
											{group.title}
											<Separator className='absolute bottom-2 left-0 w-[calc(300%+2rem)]' />
										</th>
										<td className='relative py-4' />
										<td className='relative bg-surface-secondary py-4' />
									</tr>
									{group.items.map((item, itemIndex) => {
										const isLast = groupIndex === pricingFeatures.length - 1 && itemIndex === group.items.length - 1;
										return (
											<tr key={item.title}>
												<th scope='row' className='py-4 text-sm font-normal text-foreground/75'>
													<FeatureTitle item={item} />
												</th>
												<td className='px-6 py-4 text-center xl:px-8'>
													<FeatureValue plan='Free' value={item.tiers.free} />
												</td>
												<td className={cn("bg-surface-secondary px-6 py-4 text-center xl:px-8", isLast && "rounded-b-2xl")}>
													<FeatureValue plan='Pro' value={item.tiers.pro} />
												</td>
											</tr>
										);
									})}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<ProSetupModal isOpen={isPlanModalOpen} onOpenChange={setIsPlanModalOpen} pricing={resolvedPricing} selectedFrequency={selectedFrequency} entrypoint='pricing_comparison' />
		</div>
	);
}
