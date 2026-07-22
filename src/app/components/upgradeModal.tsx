"use client";
import { Button, Checkbox, Chip, Separator, Modal, Tabs } from "@heroui/react";
import { notify as addToast } from "@lib/toast";

import { IconBolt, IconCheck, IconDiamondFilled, IconSparkles } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import NextLink from "next/link";
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
	mode?: "plan" | "runner_addon";
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

export default function UpgradeModal({ isOpen, onOpenChange, user, title, description, ctaLabel, returnUrl, source = "upgrade_modal", feature = "unknown", initialBillingCycle = "yearly", mode = "plan", primaryProduct }: UpgradeModalProps) {
	const plausible = usePlausible();
	const effectivePlan = user.entitlements?.effectivePlan ?? user.plan;
	const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
	const [billingOptions, setBillingOptions] = useState<BillingProductOption[]>([]);
	const [selectedOptionalProducts, setSelectedOptionalProducts] = useState<Set<BillingProduct>>(new Set());
	const [productCycles, setProductCycles] = useState<Map<BillingProduct, BillingCycle>>(new Map());
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
	const ownsRunner = user.entitlements?.runnerAccess ?? false;
	const runnerAddonOnly = mode === "runner_addon" && effectivePlan === "pro";
	const runnerPurchaseMode = mode === "runner_addon" && !ownsRunner;
	const primary = primaryProduct ?? (mode === "runner_addon" ? BillingProduct.RunnerSelfHosted : BillingProduct.Pro);
	const canUpgrade = runnerPurchaseMode || effectivePlan === "free" || inTrial || selectedOptionalProducts.size > 0;
	const selectedProducts = billingOptions.filter((option) => option.owned || option.required || selectedOptionalProducts.has(option.key));
	const payableProducts = selectedProducts.filter((option) => !option.owned);
	const cycleFor = (option: BillingProductOption) => productCycles.get(option.key) ?? initialBillingCycle;
	const total = payableProducts.reduce((sum, option) => sum + (option.prices[cycleFor(option)].amount ?? 0), 0);
	const totalCurrency = payableProducts[0]?.prices[cycleFor(payableProducts[0])].currency ?? "EUR";
	const totalLabel = payableProducts.length > 0 ? new Intl.NumberFormat("en", { style: "currency", currency: totalCurrency }).format(total) : "No additional charge";
	const primaryOption = billingOptions.find((option) => option.key === primary);
	const optionalOptions = billingOptions.filter((option) => option.key !== primary);
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

	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		void getBillingProductOptions(primary)
			.then((result) => {
				if (cancelled) return;
				setBillingOptions(result.options);
				if (result.preferredBillingCycle) setBillingCycle(result.preferredBillingCycle);
				setSelectedOptionalProducts(new Set(result.options.filter((option) => option.required).map((option) => option.key)));
				setProductCycles(new Map(result.options.map((option) => [option.key, result.preferredBillingCycle ?? initialBillingCycle] as [BillingProduct, BillingCycle])));
			})
			.catch(() => {
				if (!cancelled) setBillingOptions([]);
			});
		return () => {
			cancelled = true;
		};
	}, [initialBillingCycle, isOpen, primary]);

	return (
		<Modal>
			<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
				<Modal.Container size='lg' className='max-w-3xl'>
					<Modal.Dialog className='max-h-[90vh] overflow-y-auto'>
						<Modal.CloseTrigger />
						<Modal.Header className='flex flex-col gap-3 pr-10'>
							<Modal.Heading>
								<div className='flex items-center gap-3'>
									<span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-400'>
										<IconSparkles size={20} />
									</span>
									<p className='text-xl font-semibold leading-tight'>{title ?? "Upgrade to Pro"}</p>
								</div>
							</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='gap-5 pb-3'>
							<p className='text-base text-muted'>{description ?? (runnerAddonOnly ? "Run Clipify overlays from your own computer with the self-hosted Runner add-on." : "Unlock advanced features for professional streamers and support the development of Clipify.")}</p>
							{campaignOffer?.showPricingTierPromo ? (
								<div className='rounded-xl border border-brand-secondary/25 bg-brand-secondary/10 px-4 py-3 text-sm text-foreground'>
									<div className='font-semibold text-brand-secondary'>{campaignOffer.badgeText ?? campaignOffer.title}</div>
									<div className='mt-1 text-muted'>{campaignOffer.subtitle ?? "Campaign pricing is applied automatically at checkout."}</div>
								</div>
							) : null}

							{!runnerAddonOnly && (
								<div className='flex items-center gap-2 text-xs text-muted'>
									<span>Plan:</span>
									<span className={`${effectivePlan === "free" ? "text-success" : "text-brand-300"} ${effectivePlan === "pro" ? "font-bold" : "font-medium"}`}>{planLabel}</span>
									{inTrial && (
										<Chip size='sm' variant='tertiary' className='border border-amber-300/40 bg-amber-400/20 font-medium text-amber-100'>
											Trial active: {trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`}
										</Chip>
									)}
								</div>
							)}

							{!runnerAddonOnly && (monthly || yearly) && (
								<>
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

							{!runnerAddonOnly && proTier && (
								<>
									<p className='mt-3 text-lg text-foreground'>What&apos;s included with Pro</p>
									<ul className='mt-1 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2'>
										{uniqueProFeatures.slice(0, 6).map((f) => {
											const isUnique = uniqueProFeatures.includes(f);
											return (
												<li key={f} className='flex items-start gap-2'>
													<IconCheck size={16} className={isUnique ? "text-accent mt-0.5" : "text-muted mt-0.5"} />
													<p className={isUnique ? "text-foreground font-medium" : "text-muted"}>{f}</p>
												</li>
											);
										})}
									</ul>
									<NextLink href='/pricing' className='mt-3 inline-block text-sm text-brand-400 underline underline-offset-2'>
										View all Pro features
									</NextLink>
								</>
							)}

							<Separator className='my-3' />
							<div className='space-y-3'>
								{billingOptions.length === 0 ? (
									<p className='text-sm text-muted'>Loading current prices…</p>
								) : (
									<>
										{primaryOption && (
											<div className='rounded-xl border border-brand-300/50 bg-brand-500/10 p-4'>
												<div className='flex flex-wrap items-center justify-between gap-4'>
													<div>
														<p className='font-semibold text-foreground'>{primaryOption.label}</p>
														<p className='text-xs text-muted'>{primaryOption.owned ? "Already included on your account" : primaryOption.description}</p>
													</div>
													<div className='flex items-center gap-3'>
														{!primaryOption.owned && (
															<Tabs selectedKey={cycleFor(primaryOption)} onSelectionChange={(key) => setProductCycles((previous) => new Map(previous).set(primaryOption.key, String(key) as BillingCycle))} className='w-fit'>
																<Tabs.ListContainer>
																	<Tabs.List aria-label={`${primaryOption.label} billing frequency`}>
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
														)}
														<span className='shrink-0 text-sm font-semibold'>{primaryOption.owned ? "Included" : primaryOption.prices[cycleFor(primaryOption)].formatted}</span>
													</div>
												</div>
											</div>
										)}
										{optionalOptions.length > 0 && <p className='pt-2 text-sm font-semibold text-foreground'>You may also be interested in</p>}
										{optionalOptions.map((option) => {
											const checked = option.owned || selectedOptionalProducts.has(option.key);
											return (
												<div key={option.key} className='rounded-xl border border-default/60 bg-surface-secondary p-4'>
													<Checkbox
														isSelected={checked}
														isDisabled={option.owned}
														onChange={(selected) =>
															setSelectedOptionalProducts((previous) => {
																const next = new Set(previous);
																if (selected) next.add(option.key);
																else next.delete(option.key);
																return next;
															})
														}
													>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
															<div className='ml-2 flex flex-1 flex-wrap items-center justify-between gap-4'>
																<div>
																	<p className='font-medium text-foreground'>{option.label}</p>
																	<p className='text-xs text-muted'>{option.owned ? "Already included on your account" : option.description}</p>
																</div>
																<div className='flex items-center gap-3'>
																	{!option.owned && (
																		<Tabs selectedKey={cycleFor(option)} onSelectionChange={(key) => setProductCycles((previous) => new Map(previous).set(option.key, String(key) as BillingCycle))} className='w-fit'>
																			<Tabs.ListContainer>
																				<Tabs.List aria-label={`${option.label} billing frequency`}>
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
																	)}
																	<span className='shrink-0 text-sm font-medium'>{option.owned ? "Included" : option.prices[cycleFor(option)].formatted}</span>
																</div>
															</div>
														</Checkbox.Content>
													</Checkbox>
												</div>
											);
										})}
									</>
								)}
							</div>
							<div className='mt-3'>
								<Button
									onPress={async () => {
										trackPaywallEvent(plausible, "paywall_cta_click", {
											source,
											feature,
											plan: user.plan,
											cycle: billingCycle,
										});
										const products = payableProducts.map((option) => ({ product: option.key, billingCycle: cycleFor(option) }));
										const link = await generateCheckout(products, billingCycle, returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined), window.numok?.getStripeMetadata(), source);

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
									isDisabled={!canUpgrade || billingOptions.length === 0 || payableProducts.length === 0}
									variant='primary'
								>
									{<IconDiamondFilled />}
									{ctaLabel ?? (payableProducts.length === 0 ? "Already included" : `${user.entitlements?.effectivePlan === "pro" ? "Add to subscription" : "Start subscription"} · ${totalLabel}/${billingCycle === "monthly" ? "month" : "year"}`)}
								</Button>
							</div>
							<p className='mt-1 text-xs text-muted'>You can cancel anytime in your billing portal.</p>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
