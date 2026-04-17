import React from "react";
import { render, screen } from "@testing-library/react";
import { RoadmapStatus, type RoadmapColor } from "@/app/components/roadmap/roadmapData";
import { RoadmapItem } from "@/app/components/roadmap/roadmapItem";

jest.mock("@heroui/react", () => ({
	Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
	Chip: ({ children, className }: { children: React.ReactNode; className?: string }) => <span data-testid='status-chip' className={className}>{children}</span>,
}));

jest.mock("@tabler/icons-react", () => ({
	IconChevronRight: () => <span>{">"}</span>,
	IconBolt: (props: React.SVGProps<SVGSVGElement>) => <svg aria-label='roadmap-icon' {...props} />,
}));

const baseProps = {
	icon: "IconBolt",
	color: "yellow" as RoadmapColor,
	title: "Theme Studio",
	description: "Custom overlay styling",
	timeframe: "Q2",
	features: ["Color controls", "Layout editor"],
};

describe("components/roadmap/RoadmapItem", () => {
	it("renders content and feature list", () => {
		render(<RoadmapItem {...baseProps} status={RoadmapStatus.InDevelopment} />);
		expect(screen.getByText("Theme Studio")).toBeInTheDocument();
		expect(screen.getByText("Custom overlay styling")).toBeInTheDocument();
		expect(screen.getByText("Color controls")).toBeInTheDocument();
		expect(screen.getByText("Layout editor")).toBeInTheDocument();
		expect(screen.getByText("In Development")).toBeInTheDocument();
	});

	it("applies shipped status color styles", () => {
		const { container } = render(<RoadmapItem {...baseProps} status={RoadmapStatus.Shipped} />);
		expect(container.querySelector(".bg-green-500")).toBeTruthy();
		expect(screen.getByTestId("status-chip")).toHaveClass("bg-green-100");
	});

	it("covers all defined icon color variants", () => {
		const colorCases: Array<[RoadmapColor, string]> = [
			["emerald", "bg-emerald-100"],
			["blue", "bg-blue-100"],
			["purple", "bg-purple-100"],
			["amber", "bg-amber-100"],
			["yellow", "bg-yellow-100"],
			["slate", "bg-slate-100"],
			["gray", "bg-gray-100"],
			["zinc", "bg-zinc-100"],
			["neutral", "bg-neutral-100"],
			["stone", "bg-stone-100"],
			["red", "bg-red-100"],
			["orange", "bg-orange-100"],
			["lime", "bg-lime-100"],
			["green", "bg-green-100"],
			["teal", "bg-teal-100"],
			["cyan", "bg-cyan-100"],
			["sky", "bg-sky-100"],
			["indigo", "bg-indigo-100"],
			["violet", "bg-violet-100"],
			["fuchsia", "bg-fuchsia-100"],
			["pink", "bg-pink-100"],
			["rose", "bg-rose-100"],
		];

		for (const [color, expectedClass] of colorCases) {
			const { container, unmount } = render(<RoadmapItem {...baseProps} color={color} status={RoadmapStatus.Planned} />);
			expect(container.querySelector(`.${expectedClass}`)).toBeTruthy();
			unmount();
		}
	});

	it("handles planned and unknown status fallbacks", () => {
		const { container, rerender } = render(<RoadmapItem {...baseProps} status={RoadmapStatus.Planned} />);
		expect(container.querySelector(".bg-purple-500")).toBeTruthy();
		expect(screen.getByTestId("status-chip")).toHaveClass("bg-purple-100");

		rerender(<RoadmapItem {...baseProps} status={"Unknown" as RoadmapStatus} />);
		expect(container.querySelector(".bg-gray-500")).toBeTruthy();
		expect(screen.getByTestId("status-chip")).toHaveClass("bg-gray-100");
	});
});
