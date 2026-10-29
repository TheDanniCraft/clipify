"use client";

import { Timeline } from "@heroui-pro/react";
import { Chip, Tabs } from "@heroui/react";
import { RoadmapStatus, roadmapItemsForView, type RoadmapItemData } from "./roadmapData";

const views = [
	{ id: "all", status: "all", label: "All updates" },
	{ id: "progress", status: RoadmapStatus.InDevelopment, label: "In progress" },
	{ id: "shipped", status: RoadmapStatus.Shipped, label: "Shipped" },
] as const;

export default function RoadmapSections({ items }: { items: RoadmapItemData[] }) {
	return (
		<Tabs defaultSelectedKey='all' variant='secondary' className='min-w-0'>
			<Tabs.ListContainer className='mb-8 max-w-full'>
				<Tabs.List aria-label='Roadmap status'>
					{views.map((view) => (
						<Tabs.Tab key={view.id} id={view.id} className='px-3 py-3 text-sm text-foreground/75'>
							{view.label}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>
			{views.map((view) => (
				<Tabs.Panel key={view.id} id={view.id} className='px-0'>
					{roadmapItemsForView(items, view.status).length ? (
						<Timeline aria-label={`${view.label} milestones`} size='sm'>
							{roadmapItemsForView(items, view.status).map((item) => (
								<Timeline.Item key={`${item.title}:${item.timeframe}`} status={item.status === RoadmapStatus.InDevelopment ? "current" : item.status === RoadmapStatus.Shipped ? "success" : "default"}>
									<Timeline.Content className='min-w-0 gap-0 border-b border-separator pb-9'>
										<div className='mb-3 flex flex-wrap items-center gap-3 text-sm text-foreground/70'>
											<Chip className='text-foreground' size='sm' variant='soft' color={item.status === RoadmapStatus.Shipped ? "success" : "default"}>
												{item.status}
											</Chip>
											<span>{item.timeframe}</span>
										</div>
										<h2 className='text-xl font-semibold tracking-tight sm:text-2xl'>{item.title}</h2>
										<p className='mt-3 max-w-3xl leading-relaxed text-foreground/75'>{item.description}</p>
										{item.features.length > 0 && (
											<ul className='mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/75 marker:text-accent'>
												{item.features.map((feature) => (
													<li key={feature}>{feature}</li>
												))}
											</ul>
										)}
									</Timeline.Content>
								</Timeline.Item>
							))}
						</Timeline>
					) : (
						<p className='py-8 text-foreground/75'>No updates announced in this category yet.</p>
					)}
				</Tabs.Panel>
			))}
		</Tabs>
	);
}
