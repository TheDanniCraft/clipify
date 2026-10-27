"use client";

import { Accordion } from "@heroui/react";
import { RoadmapItem } from "./roadmapItem";
import { RoadmapStatus, type RoadmapItemData } from "./roadmapData";

export default function RoadmapSections({ items }: { items: RoadmapItemData[] }) {
	const shipped = items.filter((item) => item.status === RoadmapStatus.Shipped);
	return (
		<div className='space-y-12'>
			{[
				{ title: "Now", statuses: [RoadmapStatus.InDevelopment] },
				{ title: "Next", statuses: [RoadmapStatus.Planned, RoadmapStatus.Future] },
			].map((group) => {
				const current = items.filter((item) => group.statuses.includes(item.status));
				return (
					<section key={group.title}>
						<h2 className='mb-6 text-3xl font-semibold'>{group.title}</h2>
						{current.length ? (
							<div className='space-y-6'>
								{current.map((item) => (
									<RoadmapItem key={`${item.title}:${item.timeframe}`} {...item} />
								))}
							</div>
						) : (
							<p className='text-foreground/75'>No items announced here yet.</p>
						)}
					</section>
				);
			})}
			{shipped.length ? (
				<Accordion variant='surface'>
					<Accordion.Item id='shipped'>
						<Accordion.Heading>
							<Accordion.Trigger>
								Shipped ({shipped.length})<Accordion.Indicator />
							</Accordion.Trigger>
						</Accordion.Heading>
						<Accordion.Panel>
							<Accordion.Body className='space-y-6'>
								{shipped.map((item) => (
									<RoadmapItem key={`${item.title}:${item.timeframe}`} {...item} />
								))}
							</Accordion.Body>
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>
			) : null}
		</div>
	);
}
