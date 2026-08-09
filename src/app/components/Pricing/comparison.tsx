"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CampaignOffer } from "@types";
import { Accordion, Button, Card, Chip, Link, Separator, Tabs, Tooltip, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { IconCheck, IconHeart, IconInfoCircle, IconMinus } from "@tabler/icons-react";
import { usePlausible } from "next-plausible";

import { frequencies, pricingFeatures, tiers } from "./pricing-catalog";
import type { PricingFeatureItem } from "./pricing-comparison-types";
import { FrequencyEnum, resolveRuntimePricing, type RuntimePricing, type Tier } from "./pricing-types";
import { trackPaywallEvent } from "@lib/paywallTracking";
import ProSetupModal from "./ProSetupModal";

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
				<IconMinus aria-hidden className='mx-auto text-muted/60' width={21} />
				<span className='sr-only'>Not included in {plan}</span>
			</>
		);
	}
	return <span className='text-sm font-medium text-muted'>{value}</span>;
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
				<Tooltip.Trigger>
					<Button ref={triggerRef} isIconOnly aria-expanded={isOpen} aria-label={`About ${item.title}`} className='h-6 min-h-6 w-6 min-w-6 shrink-0 text-muted' size='sm' variant='ghost' onBlur={() => setIsPinnedOpen(false)} onPress={() => setIsPinnedOpen((current) => !current)}>
						<IconInfoCircle aria-hidden width={17} />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content showArrow placement='right' className='w-80 max-w-[calc(100vw-2rem)] break-normal text-sm leading-relaxed'>
					<Tooltip.Arrow />
					<p>{item.helpText}</p>
				</Tooltip.Content>
			</Tooltip>
		</div>
	);
}

function BillingTabs({ selectedKey, onSelectionChange }: { selectedKey: FrequencyEnum; onSelectionChange: (key: React.Key) => void }) {
	return (
		<Tabs className='w-fit max-w-full' selectedKey={selectedKey} onSelectionChange={onSelectionChange}>
			<Tabs.ListContainer className='w-fit max-w-full'>
				<Tabs.List aria-label='Billing frequency' className='w-fit max-w-full *:w-fit'>
					<Tabs.Tab id={FrequencyEnum.Yearly} className='flex-none px-3'>
						<div className='flex items-center gap-1.5'>
							<span className='whitespace-nowrap'>Pay Yearly</span>
							<Chip color='accent' size='sm' variant='primary'>
								2 months free
							</Chip>
						</div>
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id={FrequencyEnum.Monthly} className='flex-none whitespace-nowrap px-3'>
						Pay Monthly
						<Tabs.Indicator />
					</Tabs.Tab>
				</Tabs.List>
			</Tabs.ListContainer>
		</Tabs>
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
						<span aria-hidden className='text-lg text-muted/60 line-through'>
							{pricing.pro[selectedFrequency].formatted}
						</span>
						<span className='text-4xl font-semibold leading-8 tracking-tight text-brand-secondary'>{campaignPrice} EUR</span>
					</>
				) : (
					<span className='text-4xl font-semibold leading-8 tracking-tight'>{typeof tier.price === "string" ? tier.price : pricing.pro[selectedFrequency].formatted}</span>
				)}
				{typeof tier.price !== "string" ? <span className='text-sm font-medium text-muted'>/{suffix}</span> : null}
			</p>
			<p className={cn("mt-2 h-4 text-xs font-medium", tier.key === "pro" && selectedFrequency === FrequencyEnum.Yearly ? "text-success" : "invisible")}>Save 2 months with yearly billing</p>
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
				<p className='mt-4 text-lg text-muted'>Discover the ideal plan for your Clipify setup, starting free.</p>
			</div>
			<div className='mt-8'>
				<BillingTabs selectedKey={selectedFrequency} onSelectionChange={onFrequencyChange} />
			</div>

			<div className='mt-12 w-full lg:hidden'>
				<div className='grid gap-4 sm:grid-cols-2'>
					{tiers.map((tier) => (
						<Card key={tier.key} className={cn("relative p-3 shadow-none", tier.mostPopular ? "border border-default/70 bg-surface-secondary" : "border border-default/60 bg-transparent")}>
							{tier.mostPopular ? (
								<Chip className='absolute right-4 top-4' color='accent' variant='soft'>
									Most Popular
								</Chip>
							) : null}
							<Card.Header className='flex flex-col items-start gap-2 pe-28 pb-6'>
								<h2 className='text-lg font-medium'>{tier.title}</h2>
								<p className='text-sm text-muted'>{tier.description}</p>
							</Card.Header>
							<Separator />
							<Card.Content className='gap-6'>
								<TierPrice campaignOffer={campaignOffer} pricing={resolvedPricing} selectedFrequency={selectedFrequency} tier={tier} />
								<ul className='space-y-2'>
									{tier.summaryFeatures?.map((feature) => (
										<li key={feature} className='flex items-start gap-2 text-sm text-muted'>
											<IconCheck className='mt-0.5 shrink-0 text-accent' width={18} />
											{feature}
										</li>
									))}
								</ul>
								{tier.personalNote ? (
									<p className='flex items-start gap-2 text-xs text-muted'>
										<IconHeart className='mt-0.5 shrink-0 text-accent' width={16} />
										{tier.personalNote}
									</p>
								) : null}
							</Card.Content>
							<Card.Footer>
								{tier.key === "pro" ? (
									<Button fullWidth variant='primary' onPress={openProSetup}>
										{tier.buttonText}
									</Button>
								) : (
									<Link href={freeHref} onPress={() => trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: tier.key, cycle: selectedFrequency })} className={buttonVariants({ fullWidth: true, variant: "secondary", className: "no-underline" })}>
										{tier.buttonText}
									</Link>
								)}
							</Card.Footer>
						</Card>
					))}
				</div>

				<div className='mt-8'>
					<Accordion allowsMultipleExpanded variant='surface' defaultExpandedKeys={new Set([pricingFeatures[0].title])}>
						{pricingFeatures.map((group) => (
							<Accordion.Item key={group.title} id={group.title}>
								<Accordion.Heading>
									<Accordion.Trigger>
										{group.title}
										<Accordion.Indicator />
									</Accordion.Trigger>
								</Accordion.Heading>
								<Accordion.Panel>
									<Accordion.Body className='space-y-4'>
										{group.items.map((item) => (
											<div key={item.title}>
												<FeatureTitle item={item} />
												<div className='mt-3 grid grid-cols-2 gap-2 text-center'>
													<div className='rounded-lg bg-surface-secondary p-2'>
														<p className='mb-1 text-xs text-muted'>Free</p>
														<FeatureValue plan='Free' value={item.tiers.free} />
													</div>
													<div className='rounded-lg bg-surface-secondary p-2'>
														<p className='mb-1 text-xs text-accent'>Pro</p>
														<FeatureValue plan='Pro' value={item.tiers.pro} />
													</div>
												</div>
											</div>
										))}
									</Accordion.Body>
								</Accordion.Panel>
							</Accordion.Item>
						))}
					</Accordion>
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
												<Chip color='accent' size='sm' variant='soft'>
													Most Popular
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
											<Button fullWidth variant='primary' className='mt-6 shadow-sm' onPress={openProSetup}>
												{tier.buttonText}
											</Button>
										) : (
											<Link href={freeHref} onPress={() => trackPaywallEvent(plausible, "paywall_cta_click", { source: "pricing_page", feature: "plan", plan: tier.key, cycle: selectedFrequency })} className={buttonVariants({ fullWidth: true, variant: "secondary", className: "mt-6 no-underline" })}>
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
												<th scope='row' className='py-4 text-sm font-normal text-muted'>
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
