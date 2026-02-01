"use client";

import { addToast, Button, Divider, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { IconBolt, IconCheck, IconDiamondFilled, IconSparkles } from "@tabler/icons-react";
import { useMemo } from "react";
import { generatePaymentLink } from "@/app/actions/subscription";
import { frequencies, tiers } from "@/app/components/Pricing/pricing-tiers";
import { FrequencyEnum, TiersEnum } from "@/app/components/Pricing/pricing-types";
import type { AuthenticatedUser } from "@/app/lib/types";

type UpgradeModalProps = {
	isOpen: boolean;
	onOpenChange: () => void;
	user: AuthenticatedUser;
	title?: string;
	description?: string;
	ctaLabel?: string;
	returnUrl?: string;
};

export default function UpgradeModal({ isOpen, onOpenChange, user, title, description, ctaLabel, returnUrl }: UpgradeModalProps) {
	const proTier = useMemo(() => tiers.find((t) => t.key === TiersEnum.Pro), []);
	const freeTier = useMemo(() => tiers.find((t) => t.key === TiersEnum.Free), []);
	const proFeatures = proTier?.features ?? [];
	const uniqueProFeatures = proFeatures.filter((f) => !(freeTier?.features ?? []).includes(f) && f !== "Everything in Free");
	const price = typeof proTier?.price === "string" ? undefined : proTier?.price;
	const discountedPrice = typeof proTier?.discountedPrice === "string" ? undefined : proTier?.discountedPrice;
	const monthly = price?.[FrequencyEnum.Monthly];
	const yearly = price?.[FrequencyEnum.Yearly];
	const monthlyDiscount = discountedPrice?.[FrequencyEnum.Monthly];
	const yearlyDiscount = discountedPrice?.[FrequencyEnum.Yearly];
	const yearlySuffix = frequencies.find((f) => f.key === FrequencyEnum.Yearly)?.priceSuffix ?? "per year";
	const monthlySuffix = frequencies.find((f) => f.key === FrequencyEnum.Monthly)?.priceSuffix ?? "per month";

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
			<ModalContent>
				<ModalHeader className='flex flex-col gap-3 pr-10'>
					<div className='flex items-center gap-3'>
						<span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-400'>
							<IconSparkles size={20} />
						</span>
						<p className='text-lg font-semibold leading-tight'>{title ?? "Upgrade to Pro"}</p>
					</div>
				</ModalHeader>
				<ModalBody>
					<p className='text-default-500'>{description ?? "Unlock advanced features for professional streamers and support the development of Clipify."}</p>

					<div className='flex items-center gap-2 text-xs text-default-400'>
						<span>Plan:</span>
						<span className={`${user.plan === "free" ? "text-success-400" : "text-primary-400"} capitalize font-medium`}>{user.plan}</span>
					</div>

					{(monthly || yearly) && (
						<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
							<div className='rounded-xl border border-default-200/60 bg-default-50 p-4'>
								<div className='text-xs text-default-500'>Monthly</div>
								<div className='mt-1 flex items-end gap-2'>
									<span className='text-2xl font-semibold'>{monthlyDiscount ?? monthly}</span>
									<span className='text-xs text-default-400'>{monthlySuffix}</span>
								</div>
								<div className='mt-2 inline-flex items-center gap-1 text-xs text-default-500'>
									<IconBolt size={14} className='text-primary-400' />
									Best for trying Pro
								</div>
							</div>
							<div className='rounded-xl border border-primary-300/40 bg-primary-500/10 p-4'>
								<div className='text-xs text-primary-300'>Yearly</div>
								<div className='mt-1 flex items-end gap-2'>
									<span className='text-2xl font-semibold text-primary-200'>{yearlyDiscount ?? yearly}</span>
									<span className='text-xs text-primary-300'>{yearlySuffix}</span>
								</div>
								<div className='mt-2 inline-flex items-center gap-1 text-xs text-primary-200'>
									<IconSparkles size={14} />
									Best value
								</div>
							</div>
						</div>
					)}

					<Divider />

					{proTier && (
						<>
							<p className='mt-3 text-default-700'>What&apos;s included with Pro</p>
							<ul className='grid grid-cols-1 gap-1 sm:grid-cols-2 mt-1 text-sm'>
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
						className='mb-2'
						color='primary'
						onPress={async () => {
							const link = await generatePaymentLink(user, returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined), window.numok?.getStripeMetadata());

							if (link) {
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
					<p className='text-xs text-default-400'>Includes a 3-day free trial where available. You can cancel anytime in your billing portal.</p>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
