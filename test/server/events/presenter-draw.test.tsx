import { render, screen, within } from "@testing-library/react";
import EventNomineeStage from "@/app/components/events/EventNomineeStage";

jest.mock("@/app/components/events/EventMedia", () => ({
	EventNomineeCard: ({ candidate, result, rank }: { candidate: { content: { title: string } }; result?: { votes?: number }; rank?: number }) => (
		<button>
			{candidate.content.title}
			{rank ? ` #${rank}` : ""}
			{result ? ` (${result.votes} votes)` : ""}
		</button>
	),
}));
const candidates = Array.from({ length: 5 }, (_, i) => ({ id: String(i), content: { kind: "text", title: `Nominee ${i + 1}`, description: "", reference: "" } }));
const category = { id: "best", title: "Best moment", selection: "audience", candidates, results: candidates.map(({ id }, i) => ({ id, winner: i === 0, votes: 5 - i, percentage: ((5 - i) * 100) / 15 })) };

it("draws nominees once from a left stack, then settles only revealed places onto the podium", () => {
	const view = render(<EventNomineeStage category={category as never} place={3} cue onOpen={jest.fn()} />);
	const stack = () => screen.getByLabelText("Nominee draw stack");
	const podium = () => screen.getByLabelText("Nominee results");
	expect(within(stack()).getAllByRole("button")).toHaveLength(5);
	expect(within(podium()).queryAllByRole("button")).toHaveLength(0);
	expect(screen.queryByText(/votes/)).not.toBeInTheDocument();
	view.rerender(<EventNomineeStage category={category as never} place={3} cue={false} onOpen={jest.fn()} />);
	expect(within(stack()).getAllByRole("button")).toHaveLength(4);
	expect(screen.getByLabelText("Featured nominee")).toHaveTextContent("Nominee 3 #3 (3 votes)");
	view.rerender(<EventNomineeStage category={category as never} place={2} cue onOpen={jest.fn()} />);
	expect(podium()).toHaveTextContent("Nominee 3 #3 (3 votes)");
	expect(stack()).not.toHaveTextContent("Nominee 3");
	expect(stack()).not.toHaveTextContent("votes");
	view.rerender(<EventNomineeStage category={category as never} place={2} cue={false} onOpen={jest.fn()} />);
	expect(screen.getByLabelText("Featured nominee")).toHaveTextContent("Nominee 2 #2 (4 votes)");
	view.rerender(<EventNomineeStage category={category as never} place={1} cue onOpen={jest.fn()} />);
	expect(within(podium()).getAllByRole("button")).toHaveLength(2);
	expect(within(stack()).getAllByRole("button")).toHaveLength(3);
	expect(stack()).not.toHaveTextContent("votes");
	view.rerender(<EventNomineeStage category={category as never} place={1} cue={false} onOpen={jest.fn()} />);
	expect(screen.getByLabelText("Award winners")).toHaveTextContent("Nominee 1 #1 (5 votes)");
	expect(within(podium()).getAllByRole("button")).toHaveLength(2);
	expect(within(stack()).getAllByRole("button")).toHaveLength(2);
	expect(screen.getAllByRole("button")).toHaveLength(5);
	view.rerender(<EventNomineeStage category={category as never} place={2} cue instant onOpen={jest.fn()} />);
	expect(within(podium()).getAllByRole("button")).toHaveLength(1);
	expect(within(stack()).getAllByRole("button")).toHaveLength(4);
	expect(stack()).not.toHaveTextContent("votes");
});

it("keeps winner-only slides from drawing or displaying the other nominees", () => {
	render(<EventNomineeStage category={{ ...category, presenterMode: "winner" } as never} place={1} cue={false} onOpen={jest.fn()} />);
	expect(screen.queryByLabelText("Nominee draw stack")).not.toBeInTheDocument();
	expect(screen.getAllByRole("button")).toHaveLength(1);
});
