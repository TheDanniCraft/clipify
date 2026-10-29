"use client";

import { Timeline } from "@heroui-pro/react";
import { Card, Chip } from "@heroui/react";
import { IconCheck, IconFlag, IconTools } from "@tabler/icons-react";
import { RoadmapStatus, orderRoadmapItems, type RoadmapItemData } from "./roadmapData";

export default function RoadmapSections({ items }: { items: RoadmapItemData[] }) {
	const milestones = orderRoadmapItems(items);
	function timeline(centered: boolean) {
		return (
			<Timeline aria-label='Clipify roadmap' axis={centered ? "center" : "start"} placement={centered ? "alternate" : "end"} itemAlign={centered ? "center" : "start"} size='lg' density={centered ? "comfortable" : "compact"}>
				{milestones.map((item) => {
					const active = item.status === RoadmapStatus.InDevelopment;
					const shipped = item.status === RoadmapStatus.Shipped;
					const Icon = shipped ? IconCheck : active ? IconTools : IconFlag;
					return (
						<Timeline.Item key={`${item.title}:${item.timeframe}`} status={active ? "current" : shipped ? "success" : "default"}>
							<Timeline.Marker aria-hidden='true'>
								<Icon size={18} className='text-foreground' />
							</Timeline.Marker>
							<Timeline.Content className='w-full min-w-0 gap-0'>
								<Card className={`w-full border shadow-none ${active ? "border-accent/40 bg-accent/5" : "border-separator bg-surface"}`}>
									<Card.Content className='gap-0 p-5 text-left sm:p-7'>
										<div className='mb-4 flex flex-wrap items-center gap-3 text-sm text-foreground/75'>
											<span>{item.timeframe}</span>
											<Chip className='text-foreground' size='sm' variant='soft' color={active ? "accent" : "default"}>
												{item.status}
											</Chip>
										</div>
										<h2 className='text-xl font-semibold tracking-tight sm:text-2xl'>{item.title}</h2>
										<p className='mt-3 leading-relaxed text-foreground/75'>{item.description}</p>
										{item.features.length > 0 && (
											<ul className='mt-5 space-y-2 text-sm leading-relaxed text-foreground/75'>
												{item.features.map((feature) => (
													<li key={feature}>{feature}</li>
												))}
											</ul>
										)}
									</Card.Content>
								</Card>
							</Timeline.Content>
						</Timeline.Item>
					);
				})}
			</Timeline>
		);
	}
	return (
		<>
			<div className='md:hidden'>{timeline(false)}</div>
			<div className='hidden md:block'>{timeline(true)}</div>
		</>
	);
}
