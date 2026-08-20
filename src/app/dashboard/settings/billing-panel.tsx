"use client";

import { generateCheckout, getBillingOverview, getBillingProductOptions, getPortalLink, scheduleProductCancellation } from "@actions/subscription";
import type { BillingCycle, BillingOverview, BillingProductOption } from "@actions/subscription";
import ConfirmModal from "@components/confirmModal";
import SubscriptionChangeSummary from "./subscription-change-summary";
import { BillingProduct } from "@types";
import { Button, Card, Checkbox, Chip, Spinner, Tabs, useOverlayState } from "@heroui/react";
import { IconCreditCardFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { notify as addToast } from "@lib/toast";
import TiersComponent from "@components/Pricing";
import type { RuntimePricing } from "@components/Pricing/pricing-types";

function formatDate(value: string | null) {
	if (!value) return "—";
	return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function productAccessLabel(product: BillingOverview["products"][number]) {
	if (product.source === "billing") return `${product.cancelAtPeriodEnd ? "Ends" : "Renews"} ${formatDate(product.currentPeriodEnd)}`;
	if (!product.currentPeriodEnd) return "Included";
	return `${product.grantSource === "reverse_trial" ? "Included until" : "Available until"} ${formatDate(product.currentPeriodEnd)}`;
}

export default function BillingPanel() {
	const [overview, setOverview] = useState<BillingOverview | null>(null);
	const [options, setOptions] = useState<BillingProductOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedProducts, setSelectedProducts] = useState<Map<BillingProduct, BillingCycle>>(new Map());
	const { isOpen: confirmOpen, open: openConfirm, setOpen: setConfirmOpen } = useOverlayState();

	const reload = async () => {
		setLoading(true);
		try {
			const [nextOverview, nextOptions] = await Promise.all([getBillingOverview(), getBillingProductOptions(BillingProduct.Pro)]);
			setOverview(nextOverview);
			setOptions(nextOptions.options);
			setSelectedProducts(new Map(nextOverview.products.filter((product) => !product.cancelAtPeriodEnd).map((product) => [product.key, product.billingInterval ?? nextOptions.preferredBillingCycle ?? "yearly"] as [BillingProduct, BillingCycle])));
		} catch {
			addToast({ title: "Error", description: "Failed to load billing information.", color: "danger" });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void Promise.resolve().then(() => reload());
	}, []);

	if (loading && !overview)
		return (
			<div className='flex items-center justify-center py-16'>
				<Spinner />
			</div>
		);

	const owned = new Set(overview?.products.map((product) => product.key) ?? []);
	const additions = options.filter((option) => selectedProducts.has(option.key) && !owned.has(option.key)).map((option) => ({ option, billingCycle: selectedProducts.get(option.key) ?? ("yearly" as BillingCycle) }));
	const removals = options.filter((option) => !selectedProducts.has(option.key) && owned.has(option.key));
	const reactivations = options.filter((option) => selectedProducts.has(option.key) && overview?.products.some((product) => product.key === option.key && product.cancelAtPeriodEnd));
	const hasChanges = additions.length > 0 || removals.some((option) => !overview?.products.some((product) => product.key === option.key && product.cancelAtPeriodEnd)) || reactivations.length > 0;
	const actualRemovals = removals.filter((option) => !overview?.products.some((product) => product.key === option.key && product.cancelAtPeriodEnd));
	const proPricing = options.find((option) => option.key === BillingProduct.Pro)?.prices;
	const runnerPricing = options.find((option) => option.key === BillingProduct.RunnerSelfHosted)?.prices;
	const pricing: RuntimePricing | null = proPricing && runnerPricing ? { pro: proPricing, runner: runnerPricing } : null;
	const planProduct = overview?.products.find((product) => product.key === BillingProduct.Pro);
	const addOnProducts = overview?.products.filter((product) => product.key !== BillingProduct.Pro) ?? [];
	const planLabel = planProduct?.grantSource === "reverse_trial" ? "Pro trial" : (planProduct?.label ?? "Free");
	const accessLabel = planProduct ? productAccessLabel(planProduct) : "—";

	return (
		<div className='mt-4 space-y-4'>
			<Card>
				<Card.Header>
					<p className='text-xl font-semibold'>Compare plans</p>
					<p className='text-sm text-muted'>See the main differences between Free and Pro, or open the full pricing page for every detail.</p>
				</Card.Header>
				<Card.Content>
					<TiersComponent context='dashboard' pricing={pricing} showPlanActions={false} showRunner={false} />
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<p className='text-xl font-semibold'>Billing</p>
					<p className='text-sm text-muted'>Manage your Clipify plan, add-ons, and subscription status.</p>
				</Card.Header>
				<Card.Content className='space-y-6'>
					<Card variant='secondary'>
						<Card.Header className='flex w-full flex-col items-start gap-3 text-left sm:flex-row sm:items-center sm:justify-between'>
							<div>
								<p className='text-lg font-semibold'>Current plan</p>
								<p className='text-sm text-muted'>Manage your plan, add-ons, and billing status.</p>
							</div>
							{overview?.canManageInApp && (
								<Button
									variant='secondary'
									onPress={async () => {
										const link = await getPortalLink();
										if (link) window.location.href = link;
									}}
								>
									<IconCreditCardFilled />
									Manage billing
								</Button>
							)}
						</Card.Header>
						<Card.Content className='grid gap-4 sm:grid-cols-3'>
							<div>
								<p className='text-xs text-muted'>Status</p>
								<p className='font-semibold capitalize'>{overview?.status ?? "Inactive"}</p>
							</div>
							<div>
								<p className='text-xs text-muted'>Plan</p>
								<p className='font-semibold'>{planLabel}</p>
							</div>
							<div>
								<p className='text-xs text-muted'>Access until</p>
								<p className='font-semibold'>{accessLabel}</p>
							</div>
							{addOnProducts.map((product) => (
								<div key={product.key} className='grid gap-4 sm:col-span-3 sm:grid-cols-3'>
									<div>
										<p className='text-xs text-muted'>Add-on</p>
										<p className='font-semibold'>{product.label}</p>
									</div>
									<div className='sm:col-start-3'>
										<p className='text-xs text-muted'>Access</p>
										<p className='font-semibold'>{productAccessLabel(product)}</p>
									</div>
								</div>
							))}
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<p className='text-lg font-semibold'>Your plan</p>
							<p className='text-sm text-muted'>Select the products you want, then save your subscription changes.</p>
						</Card.Header>
						<Card.Content className='space-y-3'>
							{options.map((option) => {
								const product = overview?.products.find((entry) => entry.key === option.key);
								const checked = selectedProducts.has(option.key);
								const locked = option.owned && product?.source === "grant";
								const cycle = selectedProducts.get(option.key) ?? product?.billingInterval ?? "yearly";
								const canceling = Boolean(product?.cancelAtPeriodEnd);
								return (
									<div key={option.key} className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default/60 bg-surface-secondary p-4'>
										<div className='flex items-center gap-3'>
											<Checkbox
												isSelected={checked}
												isDisabled={locked}
												onChange={(selected) =>
													setSelectedProducts((previous) => {
														const next = new Map(previous);
														if (selected) next.set(option.key, cycle);
														else next.delete(option.key);
														return next;
													})
												}
											>
												<Checkbox.Content>
													<Checkbox.Control>
														<Checkbox.Indicator />
													</Checkbox.Control>
												</Checkbox.Content>
											</Checkbox>
											<div>
												<p className='font-medium'>{option.label}</p>
												<p className='text-xs text-muted'>{locked ? "Included access" : option.description}</p>
											</div>
										</div>
										<div className='flex items-center gap-3'>
											{option.owned ? (
												<Chip color={canceling ? "warning" : "success"} variant='soft'>
													{product ? (product.source === "billing" ? (product.cancelAtPeriodEnd ? "Ends " : "Renews ") + formatDate(product.currentPeriodEnd) : product.currentPeriodEnd ? (product.grantSource === "reverse_trial" ? "Included until " : "Available until ") + formatDate(product.currentPeriodEnd) : "Included") : "Included"}
												</Chip>
											) : (
												<Tabs
													selectedKey={cycle}
													onSelectionChange={(key) =>
														setSelectedProducts((previous) => {
															const next = new Map(previous);
															if (checked) next.set(option.key, String(key) as BillingCycle);
															return next;
														})
													}
													className='w-fit'
												>
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
											)}{" "}
											{!option.owned && <span className='text-sm font-medium'>{option.prices[cycle].formatted}</span>}
										</div>
									</div>
								);
							})}
							<div className='flex justify-end border-t border-default/60 pt-4'>
								<Button variant='primary' isDisabled={!hasChanges} onPress={openConfirm}>
									Save changes
								</Button>
							</div>
						</Card.Content>
					</Card>
					<ConfirmModal
						isOpen={confirmOpen}
						onOpenChange={setConfirmOpen}
						title='Review subscription changes'
						content={<SubscriptionChangeSummary additions={additions.map((addition) => ({ label: addition.option.label, billingCycle: addition.billingCycle, price: addition.option.prices[addition.billingCycle].formatted }))} removals={actualRemovals.map((option) => ({ label: option.label, currentPeriodEnd: overview?.products.find((product) => product.key === option.key)?.currentPeriodEnd ?? null }))} reactivations={reactivations.map((option) => ({ label: option.label }))} />}
						confirmVariant='primary'
						cancelVariant='secondary'
						confirmLabel={additions.length ? "Continue to checkout" : "Save changes"}
						cancelLabel='Keep current plan'
						onConfirm={async () => {
							setConfirmOpen(false);
							if (additions.length) {
								const link = await generateCheckout(
									additions.map((addition) => ({ product: addition.option.key, billingCycle: addition.billingCycle })),
									"yearly",
									"/dashboard/settings",
									undefined,
									"upgrade_modal",
								);
								if (link) window.location.href = link;
								return;
							}
							for (const product of actualRemovals) await scheduleProductCancellation(product.key, true);
							for (const product of reactivations) await scheduleProductCancellation(product.key, false);
							setOverview((previous) => (previous ? { ...previous, cancelAtPeriodEnd: false, products: previous.products.map((product) => (actualRemovals.some((option) => option.key === product.key) ? { ...product, cancelAtPeriodEnd: true } : reactivations.some((option) => option.key === product.key) ? { ...product, cancelAtPeriodEnd: false } : product)) } : previous));
							setSelectedProducts((previous) => {
								const next = new Map(previous);
								for (const product of actualRemovals) next.delete(product.key);
								for (const product of reactivations) next.set(product.key, overview?.products.find((entry) => entry.key === product.key)?.billingInterval ?? "yearly");
								return next;
							});
							addToast({ title: "Changes saved", description: "Your subscription changes were applied.", color: "success" });
						}}
					/>
				</Card.Content>
			</Card>
		</div>
	);
}
