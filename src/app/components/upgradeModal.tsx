"use client";
import { Button, Chip, Modal, Tabs } from "@heroui/react";

import { IconCheck, IconCrown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@heroui/react";
import { getUpgradeCopy } from "@lib/upgradeCopy";
import { generateCheckout, getBillingProductOptions } from "@actions/subscription";
import type { BillingCycle, BillingProductOption, PaywallSource } from "@actions/subscription";
import { getActiveCampaignOfferAction } from "@actions/campaignOffers";
import { frequencies, tiers } from "@components/Pricing/pricing-tiers";
import { FrequencyEnum, TiersEnum } from "@components/Pricing/pricing-types";
import { BillingProduct, type AuthenticatedUser, type CampaignOffer } from "@types";
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
	mode?: "plan";
	primaryProduct?: BillingProduct;
};

function formatPromoPrice(value?: string | number | null) {
	if (!value) return value;
	const normalized = String(value).trim();
	return /\bEUR\b/.test(normalized) ? normalized : `${normalized} EUR`;
}

function formatOriginalPrice(value?: string | number | null) {
	if (!value) return value;
	return String(value)
		.replace(/\s*EUR\b/g, "")
		.trim();
}

export default function UpgradeModal({ isOpen, onOpenChange, user, title, description, ctaLabel, returnUrl, source = "upgrade_modal", feature = "unknown", initialBillingCycle = "yearly", primaryProduct }: UpgradeModalProps) {
	const plausible = usePlausible();
	const contextualCopy = getUpgradeCopy(feature);
	const effectivePlan = user.entitlements?.effectivePlan ?? user.plan;
	const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
	const [billingOptions, setBillingOptions] = useState<BillingProductOption[]>([]);
	const [priceLoadError, setPriceLoadError] = useState(false);
	const [priceLoadAttempt, setPriceLoadAttempt] = useState(0);
	const [checkingOut, setCheckingOut] = useState(false);
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [productCycles, setProductCycles] = useState<Map<BillingProduct, BillingCycle>>(new Map());
	const [campaignOffer, setCampaignOffer] = useState<CampaignOffer | null>(null);
	const proTier = useMemo(() => tiers.find((t) => t.key === TiersEnum.Pro), []);
	const proFeatures = proTier?.summaryFeatures ?? [];
	const proBillingOption = billingOptions.find((option) => option.key === BillingProduct.Pro);
	const pricingPromoByFrequency = {
		[FrequencyEnum.Monthly]: campaignOffer?.showPricingTierPromo ? campaignOffer.pricingMonthlyPromo : null,
		[FrequencyEnum.Yearly]: campaignOffer?.showPricingTierPromo ? campaignOffer.pricingYearlyPromo : null,
	};
	const monthly = proBillingOption?.prices.monthly.formatted;
	const yearly = proBillingOption?.prices.yearly.formatted;
	const monthlyDiscount = pricingPromoByFrequency[FrequencyEnum.Monthly];
	const yearlyDiscount = pricingPromoByFrequency[FrequencyEnum.Yearly];
	const monthlyHasSale = Boolean(campaignOffer?.showPricingTierPromo && monthly && monthlyDiscount);
	const yearlyHasSale = Boolean(campaignOffer?.showPricingTierPromo && yearly && yearlyDiscount);
	const yearlySuffix = frequencies.find((f) => f.key === FrequencyEnum.Yearly)?.priceSuffix ?? "per year";
	const monthlySuffix = frequencies.find((f) => f.key === FrequencyEnum.Monthly)?.priceSuffix ?? "per month";
	const inTrial = isReverseTrialActive(user);
	const primary = primaryProduct ?? BillingProduct.Pro;
	const canUpgrade = effectivePlan === "free" || inTrial;
	const selectedProducts = billingOptions.filter((option) => option.owned || option.required);
	const payableProducts = selectedProducts.filter((option) => !option.owned);
	const cycleFor = (option: BillingProductOption) => productCycles.get(option.key) ?? initialBillingCycle;
	const total = payableProducts.reduce((sum, option) => sum + (option.prices[cycleFor(option)].amount ?? 0), 0);
	const totalCurrency = payableProducts[0]?.prices[cycleFor(payableProducts[0])].currency ?? "EUR";
	const totalLabel = payableProducts.length > 0 ? new Intl.NumberFormat("en", { style: "currency", currency: totalCurrency }).format(total) : "No additional charge";
	const trialDaysLeft = getTrialDaysLeft(user);
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

	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		void getBillingProductOptions(primary)
			.then((result) => {
				if (cancelled) return;
				setPriceLoadError(false);
				setBillingOptions(result.options);
				if (result.preferredBillingCycle) setBillingCycle(result.preferredBillingCycle);
				setProductCycles(new Map(result.options.map((option) => [option.key, result.preferredBillingCycle ?? initialBillingCycle] as [BillingProduct, BillingCycle])));
			})
			.catch(() => {
				if (!cancelled) {
					setBillingOptions([]);
					setPriceLoadError(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [initialBillingCycle, isOpen, primary, priceLoadAttempt]);

	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Container size='lg' placement='center' scroll='inside'>
				<Modal.Dialog className='max-h-[90dvh]'>
					<Modal.CloseTrigger />
					<Modal.Header className='flex flex-col gap-3 pr-10'>
						<Modal.Heading>
							<div className='flex items-center gap-3'>
								<span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300'>
									<IconCrown size={20} />
								</span>
								<p className='text-xl font-semibold leading-tight'>{title ?? contextualCopy?.title ?? "Upgrade to Pro"}</p>
							</div>
						</Modal.Heading>
					</Modal.Header>
					<Modal.Body className='space-y-5 pb-3'>
						<p className='text-sm text-muted'>{description ?? contextualCopy?.description ?? "More ways to play, customize, and share your clips."}</p>
						{campaignOffer?.showPricingTierPromo ? (
							<div className='rounded-xl border border-brand-secondary/25 bg-brand-secondary/10 px-4 py-3 text-sm text-foreground'>
								<div className='font-semibold text-brand-secondary'>{campaignOffer.badgeText ?? campaignOffer.title}</div>
								<div className='mt-1 text-muted'>{campaignOffer.subtitle ?? "Campaign pricing is applied automatically at checkout."}</div>
							</div>
						) : null}

						<div className='flex flex-wrap items-end justify-between gap-4 rounded-xl bg-surface-secondary p-4'>
							<div aria-live='polite'>
								{proBillingOption ? (
									<>
										<p className='text-sm text-muted'>{billingCycle === "yearly" ? "Billed yearly" : "Billed monthly"}</p>
										<div className='mt-1 flex flex-wrap items-baseline gap-2'>
											{(billingCycle === "yearly" ? yearlyHasSale : monthlyHasSale) && <span className='text-sm text-muted line-through'>{formatOriginalPrice(billingCycle === "yearly" ? yearly : monthly)}</span>}
											<span className='text-3xl font-semibold'>{(billingCycle === "yearly" ? yearlyHasSale : monthlyHasSale) ? formatPromoPrice(billingCycle === "yearly" ? yearlyDiscount : monthlyDiscount) : billingCycle === "yearly" ? yearly : monthly}</span>
											<span className='text-sm text-muted'>{billingCycle === "yearly" ? yearlySuffix : monthlySuffix}</span>
										</div>
									</>
								) : priceLoadError ? (
									<div>
										<p role='alert' className='text-sm text-danger'>
											Could not load prices.
										</p>
										<Button
											size='sm'
											variant='tertiary'
											onPress={() => {
												setPriceLoadError(false);
												setPriceLoadAttempt((attempt) => attempt + 1);
											}}
										>
											Try again
										</Button>
									</div>
								) : (
									<p className='text-sm text-muted'>Loading current prices…</p>
								)}
							</div>
							{proBillingOption && !proBillingOption.owned ? (
								<Tabs
									selectedKey={cycleFor(proBillingOption)}
									onSelectionChange={(key) => {
										const cycle = String(key) as BillingCycle;
										setCheckoutError(null);
										setBillingCycle(cycle);
										setProductCycles((previous) => new Map(previous).set(proBillingOption.key, cycle));
									}}
									className='w-fit'
								>
									<Tabs.ListContainer>
										<Tabs.List aria-label='Pro billing frequency'>
											<Tabs.Tab id='monthly'>
												Monthly
												<Tabs.Indicator />
											</Tabs.Tab>
											<Tabs.Tab id='yearly'>
												Yearly
												<Tabs.Indicator />
											</Tabs.Tab>
										</Tabs.List>
									</Tabs.ListContainer>
								</Tabs>
							) : null}
						</div>
						{inTrial && (
							<Chip size='sm' variant='tertiary'>
								Trial active: {trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`}
							</Chip>
						)}

						{proTier && (
							<>
								<p className='text-sm font-semibold text-foreground'>{contextualCopy ? "Also included with Pro" : "What’s included with Pro"}</p>
								<ul className='mt-3 grid grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2'>
									{proFeatures.map((feature) => (
										<li key={feature} className='flex items-start gap-2'>
											<IconCheck size={16} className='mt-0.5 shrink-0 text-accent' aria-hidden='true' />
											<span>{feature}</span>
										</li>
									))}
								</ul>
								<Link href='/pricing' className='mt-3 w-fit text-sm underline underline-offset-4'>
									Compare Free and Pro
								</Link>
							</>
						)}
					</Modal.Body>
					<Modal.Footer className='flex-col items-stretch gap-3'>
						{checkoutError && (
							<p role='alert' className='text-sm text-danger'>
								{checkoutError}
							</p>
						)}
						<div>
							<Button
								onPress={async () => {
									if (checkingOut) return;
									setCheckingOut(true);
									setCheckoutError(null);
									try {
										trackPaywallEvent(plausible, "paywall_cta_click", {
											source,
											feature,
											plan: user.plan,
											cycle: billingCycle,
										});
										const products = payableProducts.map((option) => ({ product: option.key, billingCycle: cycleFor(option) }));
										const link = await generateCheckout(products, billingCycle, returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined), window.numok?.getStripeMetadata(), source);

										if (typeof link === "string" && link) {
											trackPaywallEvent(plausible, "checkout_start", {
												source,
												feature,
												plan: user.plan,
												cycle: billingCycle,
											});
											window.location.assign(link);
										} else {
											setCheckoutError(link && typeof link === "object" ? link.error : "Could not open checkout. Please try again.");
										}
									} catch {
										setCheckoutError("Could not open checkout. Please try again.");
									} finally {
										setCheckingOut(false);
									}
								}}
								className='w-full'
								isPending={checkingOut}
								isDisabled={checkingOut || !canUpgrade || billingOptions.length === 0 || payableProducts.length === 0 || payableProducts.some((option) => option.prices[cycleFor(option)].amount === null)}
								variant='primary'
							>
								{ctaLabel ?? (billingOptions.length === 0 ? "Loading prices…" : payableProducts.length === 0 ? "Already included" : `Upgrade to Pro for ${totalLabel}/${billingCycle === "monthly" ? "month" : "year"}`)}
							</Button>
						</div>
						<p className='text-center text-xs text-muted'>You can cancel anytime in your billing portal.</p>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
