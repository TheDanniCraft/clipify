"use client";

import { Button, Checkbox, Chip, Link, Modal, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { usePlausible } from "next-plausible";
import { useState } from "react";

import { trackPaywallEvent } from "@lib/paywallTracking";
import { runnerAddon } from "./pricing-catalog";
import { FrequencyEnum, type RuntimePricing } from "./pricing-types";

export default function ProSetupModal({ isOpen, onOpenChange, pricing, selectedFrequency, entrypoint }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; pricing: RuntimePricing; selectedFrequency: FrequencyEnum; entrypoint: "direct_cta" | "pricing_comparison" }) {
	const [includeRunner, setIncludeRunner] = useState(false);
	const plausible = usePlausible();
	const checkoutHref = `/checkout/start?plan=pro&cycle=${selectedFrequency}${includeRunner ? `&runner=true&runnerCycle=${selectedFrequency}` : ""}&entrypoint=${entrypoint}`;
	const selectedAmounts = [pricing.pro[selectedFrequency].amount, ...(includeRunner ? [pricing.runner[selectedFrequency].amount] : [])];
	const selectedAmount = selectedAmounts.every((amount): amount is number => typeof amount === "number") ? selectedAmounts.reduce((sum, amount) => sum + amount, 0) : null;
	const selectedTotalLabel = selectedAmount === null ? "Price unavailable" : new Intl.NumberFormat("en", { style: "currency", currency: pricing.pro[selectedFrequency].currency }).format(selectedAmount);
	const period = selectedFrequency === FrequencyEnum.Monthly ? "month" : "year";

	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant='blur'>
			<Modal.Container size='lg'>
				<Modal.Dialog>
					<Modal.CloseTrigger />
					<Modal.Header>
						<Modal.Heading>Complete your Pro setup</Modal.Heading>
						<p className='text-sm text-muted'>Pro is selected. Add a Self-hosted Runner only if you want continuous playback on your own hardware.</p>
					</Modal.Header>
					<Modal.Body className='space-y-3'>
						<div className='flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent bg-accent/5 p-4'>
							<div className='flex items-center gap-3'>
								<Checkbox isSelected isDisabled aria-label='Clipify Pro selected'>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
									</Checkbox.Content>
								</Checkbox>
								<div>
									<p className='font-semibold'>Clipify Pro</p>
									<p className='text-sm text-muted'>Advanced control, customization, collaboration, and analytics.</p>
								</div>
							</div>
							<p className='font-semibold tabular-nums'>
								{pricing.pro[selectedFrequency].formatted} / {period}
							</p>
						</div>
						<div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4", includeRunner ? "border-accent bg-accent/5" : "border-default/60 bg-surface-secondary")}>
							<div className='flex items-center gap-3'>
								<Checkbox isSelected={includeRunner} onChange={setIncludeRunner} aria-label='Add Self-hosted Runner'>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
									</Checkbox.Content>
								</Checkbox>
								<div>
									<div className='flex flex-wrap items-center gap-2'>
										<p className='font-semibold'>{runnerAddon.title}</p>
										<Chip size='sm' variant='tertiary'>
											Optional
										</Chip>
									</div>
									<p className='text-sm text-muted'>{runnerAddon.description}</p>
								</div>
							</div>
							<p className='font-semibold tabular-nums'>
								{pricing.runner[selectedFrequency].formatted} / {period}
							</p>
						</div>
						<div className='flex items-end justify-between gap-4 border-t border-default/60 pt-4'>
							<div>
								<p className='text-sm text-muted'>Total billed {selectedFrequency === FrequencyEnum.Monthly ? "monthly" : "yearly"}</p>
								<p className='text-2xl font-semibold tabular-nums'>{selectedTotalLabel}</p>
							</div>
							<Link className='text-xs' href='mailto:contact@clipify.us?subject=Managed%20Runner'>
								Need a managed Runner?
							</Link>
						</div>
					</Modal.Body>
					<Modal.Footer>
						<Button slot='close' variant='secondary'>
							Cancel
						</Button>
						<Link href={checkoutHref} onPress={() => trackPaywallEvent(plausible, "checkout_start", { source: "pricing_page", feature: includeRunner ? "pro_and_runner" : "plan", plan: "pro", cycle: selectedFrequency })} className={buttonVariants({ variant: "primary", className: "no-underline" })}>
							Continue to checkout
						</Link>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
