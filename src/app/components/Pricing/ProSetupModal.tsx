"use client";

import { Button, Checkbox, Link, Modal } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { usePlausible } from "next-plausible";

import { trackPaywallEvent } from "@lib/paywallTracking";
import { FrequencyEnum, type RuntimePricing } from "./pricing-types";

export default function ProSetupModal({ source = "pricing_page", isOpen, onOpenChange, pricing, selectedFrequency, entrypoint }: { source?: "homepage" | "pricing_page"; isOpen: boolean; onOpenChange: (isOpen: boolean) => void; pricing: RuntimePricing; selectedFrequency: FrequencyEnum; entrypoint: "direct_cta" | "pricing_comparison" }) {
	const plausible = usePlausible();
	const checkoutHref = `/checkout/start?plan=pro&cycle=${selectedFrequency}&entrypoint=${entrypoint}`;
	const selectedTotalLabel = pricing.pro[selectedFrequency].formatted;
	const period = selectedFrequency === FrequencyEnum.Monthly ? "month" : "year";

	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant='blur'>
			<Modal.Container size='lg'>
				<Modal.Dialog>
					<Modal.CloseTrigger />
					<Modal.Header>
						<Modal.Heading>Complete your Pro setup</Modal.Heading>
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
						<div className='flex items-end justify-between gap-4 border-t border-default/60 pt-4'>
							<div>
								<p className='text-sm text-muted'>Total billed {selectedFrequency === FrequencyEnum.Monthly ? "monthly" : "yearly"}</p>
								<p className='text-2xl font-semibold tabular-nums'>{selectedTotalLabel}</p>
							</div>
						</div>
					</Modal.Body>
					<Modal.Footer>
						<Button slot='close' variant='secondary'>
							Cancel
						</Button>
						<Link href={checkoutHref} onPress={() => trackPaywallEvent(plausible, "checkout_start", { source, feature: "plan", plan: "pro", cycle: selectedFrequency })} className={buttonVariants({ variant: "primary", className: "no-underline" })}>
							Continue to checkout
						</Link>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
