import type { MemberBadgeView } from "@lib/membership";
import BadgeIcon from "@components/membership/BadgeIcon";
import { IconSparkles } from "@tabler/icons-react";

export default function BadgeGrid({ badges, emptyDescription = "Special badges will appear here automatically when they are awarded." }: { badges: MemberBadgeView[]; emptyDescription?: string }) {
	if (badges.length === 0) {
		return (
			<div className='flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-default bg-surface-secondary/40 px-6 text-center'>
				<span className='flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent'>
					<IconSparkles aria-hidden='true' size={24} />
				</span>
				<p className='mt-4 font-semibold text-foreground'>Your collection starts here</p>
				<p className='mt-1 max-w-sm text-sm text-muted'>{emptyDescription}</p>
			</div>
		);
	}

	return (
		<ul className='flex flex-wrap items-center gap-2' aria-label='Awarded badges'>
			{badges.map((badge) => (
				<li key={badge.slug}>
					<BadgeIcon badge={badge} />
				</li>
			))}
		</ul>
	);
}
