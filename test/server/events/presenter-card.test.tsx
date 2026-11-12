import { fireEvent, render, screen } from "@testing-library/react";
import { EventNomineeCard } from "@/app/components/events/EventMedia";
it("keeps presentation results together without a transient zero score or floating badge", () => {
	render(<EventNomineeCard presentation candidate={{ id: "one", content: { kind: "text", title: "A community moment", description: "", reference: "" } }} result={{ winner: true, percentage: 48, votes: 10 }} resultDelay={1} onOpen={jest.fn()} />);
	expect(screen.queryByText("0% (10 votes)")).not.toBeInTheDocument();
	expect(screen.getByText("48% (10 votes)")).toBeInTheDocument();
	expect(screen.queryByText("Winner", { exact: true })).not.toBeInTheDocument();
});

it("keeps stacked draw thumbnails playable without reserving an empty score footer", () => {
	const onOpen = jest.fn();
	const candidate = { id: "one", content: { kind: "text" as const, title: "A community moment", description: "", reference: "" } };
	const view = render(<EventNomineeCard presentation stacked candidate={candidate} onOpen={onOpen} />);
	const card = screen.getByRole("button", { name: "View A community moment" }).closest("div.grid");
	expect(card).not.toBeNull();
	expect(card!.querySelector(".h-9")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "View A community moment" }));
	expect(onOpen).toHaveBeenCalledTimes(1);
	view.rerender(<EventNomineeCard presentation candidate={candidate} onOpen={onOpen} />);
	expect(screen.getByRole("button", { name: "View A community moment" }).closest("div.grid")).toBeNull();
});
