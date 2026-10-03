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
			{removals.map((removal) => (
				<div key={`removal-${removal.label}`} className='flex items-start gap-2 text-danger'>
					<IconMinus size={18} className='mt-0.5 shrink-0' />
					<div>
						<p className='font-medium'>{removal.label}</p>
						<p className='text-sm text-muted'>Cancels {formatDate(removal.currentPeriodEnd)}. Saved data is retained, while paid-only runtime behavior pauses when access ends.</p>
					</div>
				</div>
			))}
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
	);
}

const restrictionLabels: Record<string, string> = {
	"extra-overlays-read-only": "Additional overlays remain available in read-only mode.",
	"extra-playlists-read-only": "Additional playlists and their items remain available in read-only mode.",
	"runner-control-disabled": "Runner configuration is retained while runner control is paused.",
	"advanced-overlay-settings-read-only": "Advanced overlay settings stay saved but are not applied until Pro access returns.",
};

export function DowngradeEffectsSummary({ effects }: { effects: { restrictions: string[] } }) {
	return (
		<section aria-labelledby='downgrade-effects-heading' className='space-y-2'>
			<h3 id='downgrade-effects-heading' className='font-medium'>
				After paid access ends
			</h3>
			<p>No creator resources or team data are deleted.</p>
			<ul className='list-disc pl-5'>
				{effects.restrictions.map((restriction) => (
					<li key={restriction}>{restrictionLabels[restriction] ?? restriction}</li>
				))}
			</ul>
		</section>
	);
}
