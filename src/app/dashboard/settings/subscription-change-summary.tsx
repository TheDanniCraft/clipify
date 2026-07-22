"use client";

import { IconMinus, IconPlus, IconRefresh } from "@tabler/icons-react";

type Addition = { label: string; billingCycle: "monthly" | "yearly"; price: string };
type Removal = { label: string; currentPeriodEnd: string | null };
type Reactivation = { label: string };

function formatDate(value: string | null) {
	if (!value) return "at the end of the current billing period";
	return `at renewal on ${new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
}

export default function SubscriptionChangeSummary({ additions, removals, reactivations }: { additions: Addition[]; removals: Removal[]; reactivations: Reactivation[] }) {
	return (
		<div className='space-y-4'>
			<p className='font-medium text-foreground'>Your subscription will change:</p>
			{additions.length > 0 && (
				<div className='space-y-2'>
					{additions.map((addition) => (
						<div key={`addition-${addition.label}`} className='flex items-start gap-2 text-success'>
							<IconPlus size={18} className='mt-0.5 shrink-0' />
							<div>
								<p className='font-medium'>{addition.label}</p>
								<p className='text-sm text-muted'>
									{addition.billingCycle === "yearly" ? "Yearly" : "Monthly"} · {addition.price}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
			{removals.length > 0 && (
				<div className='space-y-2'>
					{removals.map((removal) => (
						<div key={`removal-${removal.label}`} className='flex items-start gap-2 text-danger'>
							<IconMinus size={18} className='mt-0.5 shrink-0' />
							<div>
								<p className='font-medium'>{removal.label}</p>
								<p className='text-sm text-muted'>Cancels {formatDate(removal.currentPeriodEnd)}</p>
							</div>
						</div>
					))}
				</div>
			)}
			{reactivations.length > 0 && (
				<div className='space-y-2'>
					{reactivations.map((reactivation) => (
						<div key={`reactivation-${reactivation.label}`} className='flex items-start gap-2 text-brand-400'>
							<IconRefresh size={18} className='mt-0.5 shrink-0' />
							<div>
								<p className='font-medium'>{reactivation.label}</p>
								<p className='text-sm text-muted'>Remains active after the scheduled cancellation is removed.</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
