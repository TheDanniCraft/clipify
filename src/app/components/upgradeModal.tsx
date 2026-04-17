"use client";

import { addToast, Button, Chip, Divider, Modal, ModalBody, ModalContent, ModalHeader, Tab, Tabs } from "@heroui/react";
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
		<Modal isOpen={isOpen} onOpenChange={onOpenChange} size='3xl'>
			<ModalContent className='max-h-[90vh] overflow-y-auto'>
				<ModalHeader className='flex flex-col gap-3 pr-10'>
					<div className='flex items-center gap-3'>
						<span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-400'>
							<IconSparkles size={20} />
						</span>
						<p className='text-xl font-semibold leading-tight'>{title ?? "Upgrade to Pro"}</p>
					</div>
				</ModalHeader>
				<ModalBody className='gap-5 pb-6'>
					<p className='text-base text-default-500'>{description ?? "Unlock advanced features for professional streamers and support the development of Clipify."}</p>
					{campaignOffer?.showPricingTierPromo ? (
						<div className='rounded-xl border border-secondary/25 bg-secondary/10 px-4 py-3 text-sm text-default-700'>
							<div className='font-semibold text-secondary'>{campaignOffer.badgeText ?? campaignOffer.title}</div>
							<div className='mt-1 text-default-500'>{campaignOffer.subtitle ?? "Campaign pricing is applied automatically at checkout."}</div>
						</div>
					) : null}

					<div className='flex items-center gap-2 text-xs text-default-400'>
						<span>Plan:</span>
						<span className={`${effectivePlan === "free" ? "text-success-400" : "text-primary-300"} ${effectivePlan === "pro" ? "font-bold" : "font-medium"}`}>{planLabel}</span>
						{inTrial && (
							<Chip
								size='sm'
								variant='flat'
								classNames={{
									base: "border border-amber-300/40 bg-amber-400/20",
									content: "text-amber-100 font-medium",
								}}
							>
								Trial active: {trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`}
							</Chip>
						)}
					</div>

					{(monthly || yearly) && (
						<>
							<Tabs selectedKey={billingCycle} onSelectionChange={(key) => setBillingCycle(String(key) as BillingCycle)} size='sm' color='primary' variant='bordered' fullWidth>
								<Tab key='monthly' title='Monthly' />
								<Tab key='yearly' title='Yearly' />
							</Tabs>
							<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
								<div className='rounded-xl border border-default-200/60 bg-default-50 p-5'>
									<div className='flex items-center justify-between'>
										<div className='text-xs text-default-500'>Monthly</div>
										{monthlyHasSale && (
											<Chip size='sm' color='secondary' variant='flat'>
												Offer
											</Chip>
										)}
									</div>
									<div className='mt-1 flex items-center gap-2'>
										{monthlyHasSale ? (
											<>
												<span className='self-center text-sm leading-none text-default-400 line-through'>{formatOriginalPrice(monthly)}</span>
												<span className='text-3xl font-semibold leading-none'>{formatPromoPrice(monthlyDiscount)}</span>
											</>
										) : (
											<span className='text-3xl font-semibold leading-none'>{monthly}</span>
										)}
										<span className='self-end text-xs text-default-400'>{monthlySuffix}</span>
									</div>
									<div className='mt-2 inline-flex items-center gap-1 text-xs text-default-500'>
										<IconBolt size={14} className='text-primary-400' />
										Best for trying Pro
									</div>
								</div>
								<div className='rounded-xl border border-primary-300/40 bg-primary-500/10 p-5'>
									<div className='flex items-center justify-between'>
										<div className='text-xs text-primary-300'>Yearly</div>
										{yearlyHasSale && (
											<Chip size='sm' color='secondary' variant='flat'>
												Offer
											</Chip>
										)}
									</div>
									<div className='mt-1 flex items-center gap-2'>
										{yearlyHasSale ? (
											<>
												<span className='self-center text-sm leading-none text-primary-300/80 line-through'>{formatOriginalPrice(yearly)}</span>
												<span className='text-3xl font-semibold leading-none text-primary-200'>{formatPromoPrice(yearlyDiscount)}</span>
											</>
										) : (
											<span className='text-3xl font-semibold leading-none text-primary-200'>{yearly}</span>
										)}
										<span className='self-end text-xs text-primary-300'>{yearlySuffix}</span>
									</div>
									<div className='mt-2 inline-flex items-center gap-1 text-xs text-primary-200'>
										<IconSparkles size={14} />
										Best value
									</div>
								</div>
							</div>
						</>
					)}

					<Divider />

					{proTier && (
						<>
							<p className='mt-3 text-lg text-default-700'>What&apos;s included with Pro</p>
							<ul className='mt-1 grid grid-cols-1 gap-x-6 gap-y-2 text-base sm:grid-cols-2'>
								{proFeatures.map((f) => {
									const isUnique = uniqueProFeatures.includes(f);
									return (
										<li key={f} className='flex items-start gap-2'>
											<IconCheck size={16} className={isUnique ? "text-primary mt-0.5" : "text-default-400 mt-0.5"} />
											<p className={isUnique ? "text-default-900 font-medium" : "text-default-500"}>{f}</p>
										</li>
									);
								})}
							</ul>
						</>
					)}

					<Divider className='my-3' />
					<Button
						color='primary'
						onPress={async () => {
							trackPaywallEvent(plausible, "paywall_cta_click", {
								source,
								feature,
								plan: user.plan,
								cycle: billingCycle,
							});
							const link = await generatePaymentLink(user, billingCycle, returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined), window.numok?.getStripeMetadata(), source);

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
						}}
						startContent={<IconDiamondFilled />}
						isDisabled={user.plan !== "free"}
					>
						{ctaLabel ?? "Upgrade to Pro"}
					</Button>
					<p className='text-xs text-default-400 mb-3'>You can cancel anytime in your billing portal.</p>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
