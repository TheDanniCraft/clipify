import { roadmapItemsForView, RoadmapStatus, type RoadmapItemData } from "@/app/components/roadmap/roadmapData";

const items: RoadmapItemData[] = [RoadmapStatus.Shipped, RoadmapStatus.Future, RoadmapStatus.Planned, RoadmapStatus.InDevelopment].map((status) => ({ title: status, status, description: "A published milestone", timeframe: "2026", icon: "IconBolt", color: "purple", features: [] }));

it("keeps shipped history visible while showing active work first", () => {
	expect(roadmapItemsForView(items, "all").map((item) => item.status)).toEqual([RoadmapStatus.InDevelopment, RoadmapStatus.Planned, RoadmapStatus.Future, RoadmapStatus.Shipped]);
	expect(items[0].status).toBe(RoadmapStatus.Shipped);
});
it("filters by the published status without inventing milestones", () => {
	expect(roadmapItemsForView(items, RoadmapStatus.Shipped)).toEqual([items[0]]);
	expect(roadmapItemsForView([], "all")).toEqual([]);
});
