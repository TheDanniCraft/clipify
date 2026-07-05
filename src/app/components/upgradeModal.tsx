"use client";
import { Button, Chip, Separator, Modal, Tabs } from "@heroui/react";
import { notify as addToast } from "@lib/toast";

import { IconBolt, IconCheck, IconDiamondFilled, IconSparkles } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { generatePaymentLink } from "@actions/subscription";
import type { BillingCycle, PaywallSource } from "@actions/subscription";
import { getActiveCampaignOfferAction } from "@actions/campaignOffers";
import { frequencies, tiers } from "@components/Pricing/pricing-tiers";
import { FrequencyEnum, TiersEnum } from "@components/Pricing/pricing-types";
import type { AuthenticatedUser, CampaignOffer } from "@types";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";
import { getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";

type UpgradeModalProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	user: AuthenticatedUser;
	title?: string;
	description?: string;
	ctaLabel?: string;
	returnUrl?: string;
	source?: PaywallSource;
	feature?: string;
	initialBillingCycle?: BillingCycle;
};

function formatPromoPrice(value?: string | number | null) {
	if (!value) return value;
	const normalized = String(value).trim();
	return /\bEUR\b/.test(normalized) ? normalized : `${normalized} EUR`;
}

function formatOriginalPrice(value?: string | number | null) {
	if (!value) return value;
	return String(value).replace(/\s*EUR\b/g, "").trim();
}

export default function UpgradeModal({ isOpen, onOpenChange, user, title, description, ctaLabel, returnUrl, source = "upgrade_modal", feature = "unknown", initialBillingCycle = "yearly" }: UpgradeModalProps) {
	const plausible = usePlausible();
	const effectivePlan = user.entitlements?.effectivePlan ?? user.plan;
	const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
	const [campaignOffer, setCampaignOffer] = useState<CampaignOffer | null>(null);
	const proTier = useMemo(() => tiers.find((t) => t.key === TiersEnum.Pro), []);
	const freeTier = useMemo(() => tiers.find((t) => t.key === TiersEnum.Free), []);
	const proFeatures = proTier?.features ?? [];
	const uniqueProFeatures = proFeatures.filter((f) => !(freeTier?.features ?? []).includes(f) && f !== "Everything in Free");
	const price = typeof proTier?.price === "string" ? undefined : proTier?.price;
	const discountedPrice = typeof proTier?.discountedPrice === "string" ? undefined : proTier?.discountedPrice;
	const pricingPromoByFrequency = {
		[FrequencyEnum.Monthly]: campaignOffer?.showPricingTierPromo ? campaignOffer.pricingMonthlyPromo : null,
		[FrequencyEnum.Yearly]: campaignOffer?.showPricingTierPromo ? campaignOffer.pricingYearlyPromo : null,
	};
	const monthly = price?.[FrequencyEnum.Monthly];
	const yearly = price?.[FrequencyEnum.Yearly];
	const monthlyDiscount = pricingPromoByFrequency[FrequencyEnum.Monthly] ?? discountedPrice?.[FrequencyEnum.Monthly];
	const yearlyDiscount = pricingPromoByFrequency[FrequencyEnum.Yearly] ?? discountedPrice?.[FrequencyEnum.Yearly];
	const monthlyHasSale = Boolean(monthly && monthlyDiscount && monthlyDiscount !== monthly);
	const yearlyHasSale = Boolean(yearly && yearlyDiscount && yearlyDiscount !== yearly);
	const yearlySuffix = frequencies.find((f) => f.key === FrequencyEnum.Yearly)?.priceSuffix ?? "per year";
	const monthlySuffix = frequencies.find((f) => f.key === FrequencyEnum.Monthly)?.priceSuffix ?? "per month";
	const inTrial = isReverseTrialActive(user);
	const canUpgrade = effectivePlan === "free" || inTrial;
	const trialDaysLeft = getTrialDaysLeft(user);
	const planLabel = effectivePlan === "pro" ? "Pro" : "Free";
	const hasTrackedImpressionRef = useRef(false);

	useEffect(() => {
		if (!isOpen) {
			hasTrackedImpressionRef.current = false;
			return;
		}
		if (hasTrackedImpressionRef.current) return;
		hasTrackedImpressionRef.current = true;
		trackPaywallEvent(plausible, "paywall_impression", {
			source,
			feature,
			plan: user.plan,
			cycle: billingCycle,
		});
	}, [billingCycle, feature, isOpen, plausible, source, user.plan]);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const offer = await getActiveCampaignOfferAction();
				if (!cancelled) setCampaignOffer((offer as CampaignOffer | null) ?? null);
			} catch {
				if (!cancelled) setCampaignOffer(null);
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<Modal>
			<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
				<Modal.Container size='lg' className='max-w-3xl'>
					<Modal.Dialog className='max-h-[90vh] overflow-y-auto'>
						<Modal.CloseTrigger />
						<Modal.Header className='flex flex-col gap-3 pr-10'><Modal.Heading>
					<div className='flex items-center gap-3'>
						<span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-400'>
							<IconSparkles size={20} />
						</span>
						<p className='text-xl font-semibold leading-tight'>{title ?? "Upgrade to Pro"}</p>
					</div>
						</Modal.Heading></Modal.Header>
						<Modal.Body className='gap-5 pb-6'>
					<p className='text-base text-muted'>{description ?? "Unlock advanced features for professional streamers and support the development of Clipify."}</p>
					{campaignOffer?.showPricingTierPromo ? (
						<div className='rounded-xl border border-brand-secondary/25 bg-brand-secondary/10 px-4 py-3 text-sm text-foreground'>
							<div className='font-semibold text-brand-secondary'>{campaignOffer.badgeText ?? campaignOffer.title}</div>
							<div className='mt-1 text-muted'>{campaignOffer.subtitle ?? "Campaign pricing is applied automatically at checkout."}</div>
						</div>
					) : null}

					<div className='flex items-center gap-2 text-xs text-muted'>
						<span>Plan:</span>
						<span className={`${effectivePlan === "free" ? "text-success" : "text-brand-300"} ${effectivePlan === "pro" ? "font-bold" : "font-medium"}`}>{planLabel}</span>
						{inTrial && (
							<Chip
								size='sm'
								variant='tertiary'
								className='border border-amber-300/40 bg-amber-400/20 font-medium text-amber-100'
							>
								Trial active: {trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`}
							</Chip>
						)}
					</div>

					{(monthly || yearly) && (
						<>
						<Tabs selectedKey={billingCycle} onSelectionChange={(key) => setBillingCycle(String(key) as BillingCycle)} variant='secondary' className='w-full text-sm'>
							<Tabs.ListContainer className='w-full'><Tabs.List aria-label='Billing cycle' className='w-full'>
								<Tabs.Tab id='monthly'>Monthly<Tabs.Indicator /></Tabs.Tab>
								<Tabs.Tab id='yearly'>Yearly<Tabs.Indicator /></Tabs.Tab>
							</Tabs.List></Tabs.ListContainer>
						</Tabs>
							<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
								<div className='rounded-xl border border-default/60 bg-surface-secondary p-5'>
									<div className='flex items-center justify-between'>
										<div className='text-xs text-muted'>Monthly</div>
										{monthlyHasSale && (
											<Chip size='sm' color='accent' variant='tertiary'>
												Offer
											</Chip>
										)}
									</div>
									<div className='mt-1 flex items-center gap-2'>
										{monthlyHasSale ? (
											<>
												<span className='self-center text-sm leading-none text-muted line-through'>{formatOriginalPrice(monthly)}</span>
												<span className='text-3xl font-semibold leading-none'>{formatPromoPrice(monthlyDiscount)}</span>
											</>
										) : (
											<span className='text-3xl font-semibold leading-none'>{monthly}</span>
										)}
										<span className='self-end text-xs text-muted'>{monthlySuffix}</span>
									</div>
									<div className='mt-2 inline-flex items-center gap-1 text-xs text-muted'>
										<IconBolt size={14} className='text-brand-400' />
										Best for trying Pro
									</div>
								</div>
								<div className='rounded-xl border border-brand-300/40 bg-brand-500/10 p-5'>
									<div className='flex items-center justify-between'>
										<div className='text-xs text-brand-300'>Yearly</div>
										{yearlyHasSale && (
											<Chip size='sm' color='accent' variant='tertiary'>
												Offer
											</Chip>
										)}
									</div>
									<div className='mt-1 flex items-center gap-2'>
										{yearlyHasSale ? (
											<>
												<span className='self-center text-sm leading-none text-brand-300/80 line-through'>{formatOriginalPrice(yearly)}</span>
												<span className='text-3xl font-semibold leading-none text-brand-200'>{formatPromoPrice(yearlyDiscount)}</span>
											</>
										) : (
											<span className='text-3xl font-semibold leading-none text-brand-200'>{yearly}</span>
										)}
										<span className='self-end text-xs text-brand-300'>{yearlySuffix}</span>
									</div>
									<div className='mt-2 inline-flex items-center gap-1 text-xs text-brand-200'>
										<IconSparkles size={14} />
										Best value
									</div>
								</div>
							</div>
						</>
					)}

					<Separator />

					{proTier && (
						<>
							<p className='mt-3 text-lg text-foreground'>What&apos;s included with Pro</p>
							<ul className='mt-1 grid grid-cols-1 gap-x-6 gap-y-2 text-base sm:grid-cols-2'>
								{proFeatures.map((f) => {
									const isUnique = uniqueProFeatures.includes(f);
									return (
										<li key={f} className='flex items-start gap-2'>
											<IconCheck size={16} className={isUnique ? "text-accent mt-0.5" : "text-muted mt-0.5"} />
											<p className={isUnique ? "text-foreground font-medium" : "text-muted"}>{f}</p>
										</li>
									);
								})}
							</ul>
						</>
					)}

					<Separator className='my-3' />
					<Button onPress={async () => {
							trackPaywallEvent(plausible, "paywall_cta_click", {
								source,
								feature,
								plan: user.plan,
								cycle: billingCycle,
							});
							const link = await generatePaymentLink(billingCycle, returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined), window.numok?.getStripeMetadata(), source);

							if (link) {
								trackPaywallEvent(plausible, "checkout_start", {
									source,
									feature,
									plan: user.plan,
									cycle: billingCycle,
								});
								window.location.href = link;
						} else {
							addToast({
								title: "Error",
								description: "Failed to generate payment link. Please try again later.",
								color: "danger",
							});
						}
					}} isDisabled={!canUpgrade} variant='primary'>{<IconDiamondFilled />}
						{ctaLabel ?? "Upgrade to Pro"}
					</Button>
					<p className='text-xs text-muted mb-3'>You can cancel anytime in your billing portal.</p>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
