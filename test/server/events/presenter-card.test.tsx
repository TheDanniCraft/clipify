import { render, screen } from "@testing-library/react";
import { EventNomineeCard } from "@/app/components/events/EventMedia";
it("keeps presentation results together without a transient zero score or floating badge", () => {
	render(<EventNomineeCard presentation candidate={{ id: "one", content: { kind: "text", title: "A community moment", description: "", reference: "" } }} result={{ winner: true, percentage: 48, votes: 10 }} resultDelay={1} onOpen={jest.fn()} />);
	expect(screen.queryByText("0% (10 votes)")).not.toBeInTheDocument();
	expect(screen.getByText("48% (10 votes)")).toBeInTheDocument();
	expect(screen.queryByText("Winner", { exact: true })).not.toBeInTheDocument();
});
