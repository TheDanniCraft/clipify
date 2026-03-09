import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import FloatingBanner from "@/app/components/floatingBanner";

jest.mock("@heroui/react", () => ({
	Button: ({ onPress, children, "aria-label": ariaLabel }: { onPress?: () => void; children: React.ReactNode; "aria-label"?: string }) => (
		<button onClick={onPress} aria-label={ariaLabel}>
			{children}
		</button>
	),
}));

jest.mock("@tabler/icons-react", () => ({
	IconX: () => <span>x</span>,
}));

describe("components/FloatingBanner", () => {
	it("renders content and dismisses on close", () => {
		render(
			<FloatingBanner
				icon={<span>icon</span>}
				title='Update'
				text='New feature is live'
				cta={<button>Try now</button>}
			/>,
		);

		expect(screen.getByText("Update")).toBeInTheDocument();
		expect(screen.getByText("New feature is live")).toBeInTheDocument();
		expect(screen.getByText("Try now")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Close Banner" }));
		expect(screen.queryByText("New feature is live")).not.toBeInTheDocument();
	});
});
