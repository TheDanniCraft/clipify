import { orderRoadmapItems, RoadmapStatus, type RoadmapItemData } from "@/app/components/roadmap/roadmapData";

const milestone = (title: string, status: RoadmapStatus): RoadmapItemData => ({ title, status, description: "A published milestone", timeframe: "2026", icon: "IconBolt", color: "purple", features: [] });

it("shows upcoming work followed by shipped milestones in reverse published order", () => {
	const items = [milestone("First release", RoadmapStatus.Shipped), milestone("Later idea", RoadmapStatus.Future), milestone("Next improvement", RoadmapStatus.Planned), milestone("Latest release", RoadmapStatus.Shipped), milestone("Current work", RoadmapStatus.InDevelopment)];
	expect(orderRoadmapItems(items).map((item) => item.title)).toEqual(["Current work", "Next improvement", "Later idea", "Latest release", "First release"]);
	expect(items[0].title).toBe("First release");
});

it("keeps all published milestones, including an empty history", () => {
	const items = [milestone("One", RoadmapStatus.Planned), milestone("Two", RoadmapStatus.Planned)];
	expect(orderRoadmapItems(items)).toEqual(items);
	expect(orderRoadmapItems([])).toEqual([]);
});
