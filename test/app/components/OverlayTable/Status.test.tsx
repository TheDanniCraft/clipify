import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusOptions } from "@types";
import { Status } from "@/app/components/OverlayTable/Status";

jest.mock("@heroui/react", () => ({
	cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
}));

jest.mock("@tabler/icons-react", () => ({
	IconCircleFilled: ({ color }: { color?: string }) => <svg data-testid='status-icon' data-color={color} />,
}));

describe("components/OverlayTable/Status", () => {
	it("renders active status with active icon color", () => {
		render(<Status status={StatusOptions.Active} />);
		expect(screen.getByText(StatusOptions.Active)).toBeInTheDocument();
		expect(screen.getByTestId("status-icon")).toHaveAttribute("data-color", "hsl(var(--heroui-success))");
	});

	it("renders paused status and merges className", () => {
		const { container } = render(<Status status={StatusOptions.Paused} className='extra-class' />);
		expect(screen.getByText(StatusOptions.Paused)).toBeInTheDocument();
		expect(screen.getByTestId("status-icon")).toHaveAttribute("data-color", "hsl(var(--heroui-danger))");
		expect(container.firstChild).toHaveClass("extra-class");
	});
});
