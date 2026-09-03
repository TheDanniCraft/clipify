"use client";

import { Button, Tooltip } from "@heroui/react";
import { IconCrown, IconFlask, IconHeart, IconRosetteDiscountCheck, IconShieldCheck, IconSparkles, IconStar } from "@tabler/icons-react";
import type { MemberBadgeView } from "@lib/membership";
import type { BadgeIconKey } from "@lib/badgeCatalog";
import { useState } from "react";

// The catalog's icon field selects a known glyph, never arbitrary markup or URLs.
const icons: Record<BadgeIconKey, typeof IconCrown> = { crown: IconCrown, flask: IconFlask, heart: IconHeart, shield: IconShieldCheck, sparkles: IconSparkles, star: IconStar, badge: IconRosetteDiscountCheck };

export default function BadgeIcon({ badge }: { badge: Pick<MemberBadgeView, "slug" | "name" | "description" | "icon"> }) {
	const [isOpen, setIsOpen] = useState(false);
	const key = Object.hasOwn(icons, badge.icon) ? badge.icon : "badge";
	const Icon = icons[key];
	return (
		<Tooltip delay={150} isOpen={isOpen} onOpenChange={setIsOpen}>
			<Tooltip.Trigger>
				<Button isIconOnly variant='ghost' className='size-9 min-w-9 rounded-full text-accent' aria-label={`${badge.name}: ${badge.description}`} onPress={() => setIsOpen(true)}>
					<Icon size={22} aria-hidden='true' data-badge-icon={key} />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content className='max-w-64'>
				<Tooltip.Arrow />
				<div className='space-y-1'>
					<p className='font-semibold'>{badge.name}</p>
					<p className='text-sm text-muted'>{badge.description}</p>
				</div>
			</Tooltip.Content>
		</Tooltip>
	);
}
