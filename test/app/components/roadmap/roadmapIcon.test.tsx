import RoadmapIcon from "@components/roadmap/roadmapIcon";
import { IconPalette, IconBolt } from "@tabler/icons-react";

it("preserves the icon and color published for a roadmap milestone", () => {
	const element = RoadmapIcon({ icon: "IconPalette", color: "purple" });
	expect(element.props.className).toContain("text-purple-700");
	expect(element.props.children.type).toBe(IconPalette);
});
it("keeps an unfamiliar CMS icon from breaking the public roadmap", () => {
	const element = RoadmapIcon({ icon: "IconNoSuchMilestone", color: "slate" });
	expect(element.props.children.type).toBe(IconBolt);
});
