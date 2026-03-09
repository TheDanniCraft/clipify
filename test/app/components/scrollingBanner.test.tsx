import React from "react";
import { render, screen } from "@testing-library/react";
import ScrollingBanner from "@/app/components/scrollingBanner";

jest.mock("@heroui/react", () => {
	return {
		cn: (...classes: Array<string | Record<string, boolean> | undefined>) =>
			classes
				.flatMap((entry) => {
					if (!entry) return [];
					if (typeof entry === "string") return [entry];
					return Object.entries(entry)
						.filter(([, enabled]) => Boolean(enabled))
						.map(([key]) => key);
				})
				.join(" "),
		ScrollShadow: React.forwardRef(function ScrollShadow(
			{
				children,
				orientation,
				className,
				style,
			}: {
				children: React.ReactNode;
				orientation?: string;
				className?: string;
				style?: React.CSSProperties;
			},
			ref: React.ForwardedRef<HTMLDivElement>,
		) {
			return (
				<div ref={ref} data-testid='scroll-shadow' data-orientation={orientation} className={className} style={style}>
					{children}
				</div>
			);
		}),
	};
});

describe("components/ScrollingBanner", () => {
	it("renders horizontal mode by default", () => {
		const { container } = render(
			<ScrollingBanner>
				<span>Item</span>
			</ScrollingBanner>,
		);

		expect(screen.getByTestId("scroll-shadow")).toHaveAttribute("data-orientation", "horizontal");
		expect(screen.getByTestId("scroll-shadow")).toHaveClass("w-full");
		expect(container.querySelector(".animate-scrolling-banner")).toBeTruthy();
	});

	it("renders vertical reverse mode with custom duration", () => {
		const { container } = render(
			<ScrollingBanner isVertical isReverse shouldPauseOnHover={false} duration={10}>
				<span>Item</span>
			</ScrollingBanner>,
		);

		const root = screen.getByTestId("scroll-shadow");
		expect(root).toHaveAttribute("data-orientation", "vertical");
		expect(root).toHaveStyle("--duration: 10s");
		expect(container.querySelector(".animate-scrolling-banner-vertical")).toBeTruthy();
		expect(container.querySelector(".\\[animation-direction\\:reverse\\]")).toBeTruthy();
		expect(container.querySelector(".hover\\:\\[animation-play-state\\:paused\\]")).toBeFalsy();
	});
});
