import React from "react";
import { render, screen } from "@testing-library/react";
import FeatureCard from "@/app/components/featureCard";

jest.mock("@heroui/react", () => ({
	Card: ({ children }: { children: React.ReactNode }) => <div data-testid='card'>{children}</div>,
	CardBody: ({ children }: { children: React.ReactNode }) => <div data-testid='card-body'>{children}</div>,
	Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@tabler/icons-react", () => ({
	IconConfetti: () => <span>confetti</span>,
	IconRocket: () => <span>rocket</span>,
}));

describe("components/FeatureCard", () => {
	const DummyIcon = () => <svg aria-label='dummy-icon' />;

	it("renders base content", () => {
		render(<FeatureCard icon={DummyIcon} title='Smart Shuffle' description='Avoids repeats.' />);
		expect(screen.getByText("Smart Shuffle")).toBeInTheDocument();
		expect(screen.getByText("Avoids repeats.")).toBeInTheDocument();
		expect(screen.getByLabelText("dummy-icon")).toBeInTheDocument();
	});

	it("renders optional status chips", () => {
		const { rerender } = render(<FeatureCard icon={DummyIcon} title='A' description='B' comingSoon />);
		expect(screen.getByText("Coming Soon")).toBeInTheDocument();

		rerender(<FeatureCard icon={DummyIcon} title='A' description='B' isNew />);
		expect(screen.getByText("New")).toBeInTheDocument();
	});
});
