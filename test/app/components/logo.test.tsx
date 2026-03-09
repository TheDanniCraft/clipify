import React from "react";
import { render } from "@testing-library/react";
import Logo from "@/app/components/logo";

describe("components/Logo", () => {
	it("renders default dimensions", () => {
		const { container } = render(<Logo />);
		const svg = container.querySelector("svg");
		expect(svg).toHaveAttribute("width", "32");
		expect(svg).toHaveAttribute("height", "32");
	});

	it("respects custom size", () => {
		const { container } = render(<Logo size={48} />);
		const svg = container.querySelector("svg");
		expect(svg).toHaveAttribute("width", "48");
		expect(svg).toHaveAttribute("height", "48");
	});
});
