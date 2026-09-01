import type { MemberBadgeView } from "@lib/membership";
import { Chip } from "@heroui/react";
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
		<ul className='grid gap-3 sm:grid-cols-2'>
			{badges.map((badge) => (
				<li key={badge.slug} className='rounded-2xl border border-default bg-surface-secondary/40 p-4'>
					<div className='flex items-center justify-between gap-3'>
						<p className='font-semibold text-foreground'>{badge.name}</p>
						<Chip size='sm' variant='secondary'>
							Awarded
						</Chip>
					</div>
					<p className='mt-2 text-sm text-muted'>{badge.description}</p>
				</li>
			))}
		</ul>
	);
}
