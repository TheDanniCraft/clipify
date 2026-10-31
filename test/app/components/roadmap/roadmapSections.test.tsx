import type { HTMLAttributes } from "react";
import { render, screen, within } from "@testing-library/react";
import RoadmapSections from "@components/roadmap/roadmapSections";
import { RoadmapStatus } from "@components/roadmap/roadmapData";

jest.mock(
	"@heroui-pro/react",
	() => {
		const Part = ({ children }: HTMLAttributes<HTMLElement>) => <div>{children}</div>;
		return { Timeline: Object.assign(Part, { Item: Part, Content: Part, Marker: ({ children }: HTMLAttributes<HTMLElement>) => <span data-testid='milestone-marker'>{children}</span> }) };
	},
	{ virtual: true },
);

it("uses each published milestone icon as its step marker and keeps all work visible", () => {
	const items = [RoadmapStatus.Shipped, RoadmapStatus.Future, RoadmapStatus.Planned, RoadmapStatus.InDevelopment].map((status, index) => ({
		title: `Milestone ${index}`,
		description: `Outcome ${index}`,
		status,
		timeframe: "2026",
		icon: "IconBolt",
		color: "purple" as const,
		features: index ? [`Capability ${index}`] : [],
		visual: <span>{`Published icon ${index}`}</span>,
	}));
	render(<RoadmapSections items={items} />);
	const markers = screen.getAllByTestId("milestone-marker");
	// Both responsive timelines preserve the same complete sequence.
	expect(markers.map((marker) => marker.textContent)).toEqual(["Published icon 3", "Published icon 2", "Published icon 1", "Published icon 0", "Published icon 3", "Published icon 2", "Published icon 1", "Published icon 0"]);
	for (let index = 0; index < items.length; index++) {
		expect(screen.getAllByRole("heading", { name: items[index].title })).toHaveLength(2);
		expect(screen.getAllByText(items[index].description)).toHaveLength(2);
		if (index) expect(screen.getAllByText(`Capability ${index}`)).toHaveLength(2);
	}
	expect(within(markers[0]).getByText("Published icon 3")).toBeInTheDocument();
	expect(screen.queryByRole("tab")).not.toBeInTheDocument();
});
