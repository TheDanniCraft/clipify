import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import EventPresenter from "@/app/components/events/EventPresenter";
import { getEventPresenterAction, publishEventPresenterResultsAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ getEventPresenterAction: jest.fn(), publishEventPresenterResultsAction: jest.fn() }));
jest.mock("@/app/components/events/EventMedia", () => ({
	EventMedia: ({ content }: { content: { title: string } }) => <div data-testid='opened-media'>{content.title}</div>,
	EventNomineeCard: ({ candidate, onOpen, result, rank }: { candidate: { content: { title: string } }; onOpen: () => void; result?: { winner: boolean }; rank?: number }) => (
		<button onClick={onOpen}>
			{candidate.content.title}
			{result?.winner ? " winner" : ""}
			{rank ? ` #${rank}` : ""}
		</button>
	),
}));
const view = {
	ok: true,
	event: { id: "show", title: "Babbler Awards", description: "", phase: "closed", whiteLabel: false, categories: [{ id: "fail", title: "Best fail", selection: "audience", candidates: [{ id: "lamp", content: { kind: "text", title: "Lampe raucht ab", description: "", reference: "" } }], results: [{ id: "lamp", votes: 1, percentage: 100, winner: true }] }], slides: [] },
	statistics: { categories: 1, submissions: 1, nominees: 1, voters: 1, clips: 0 },
	brand: null,
	creatorName: "host",
};
beforeEach(() => {
	window.location.hash = "s".repeat(43);
	jest.mocked(getEventPresenterAction).mockResolvedValue(view as never);
});
it("lets the host inspect nominees, reveal results and explicitly publish after the closing slide", async () => {
	jest.mocked(publishEventPresenterResultsAction).mockResolvedValue({ ok: true });
	render(<EventPresenter eventId='show' />);
	await screen.findByRole("heading", { name: "Babbler Awards" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getAllByRole("button", { name: "Lampe raucht ab" })).toHaveLength(1);
	fireEvent.click(within(screen.getByLabelText("Category nominees")).getByRole("button", { name: "Lampe raucht ab" }));
	expect(screen.getByTestId("opened-media")).toBeInTheDocument();
	fireEvent.keyDown(window, { key: "Escape" });
	expect(screen.queryByTestId("opened-media")).not.toBeInTheDocument();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByLabelText("Nominee results")).toHaveTextContent("Lampe raucht ab");
	expect(screen.queryByLabelText("Award winners")).not.toBeInTheDocument();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(await within(screen.getByLabelText("Award winners")).findByRole("button", { name: "Lampe raucht ab winner #1" })).toBeInTheDocument();
	expect(screen.getByRole("heading", { name: "First place" })).toBeInTheDocument();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByRole("heading", { name: "Thank you!" })).toBeInTheDocument();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(publishEventPresenterResultsAction).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Publish results" }));
	await waitFor(() => expect(publishEventPresenterResultsAction).toHaveBeenCalledWith("show", "s".repeat(43)));
});
it("explains revoked links without exposing a presentation", async () => {
	jest.mocked(getEventPresenterAction).mockResolvedValue({ ok: false, code: "NOT_FOUND" });
	render(<EventPresenter eventId='show' />);
	expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
	expect(screen.queryByRole("button", { name: "Next slide" })).not.toBeInTheDocument();
});

it("reveals podium places one click at a time and conceals them again on back", () => {
	const initial: typeof view = JSON.parse(JSON.stringify(view));
	const category = initial.event.categories[0];
	category.results[0].votes = 10;
	for (const [index, title] of ["Second nominee", "Third nominee", "Fourth nominee"].entries()) {
		category.candidates.push({ id: `nominee-${index}`, content: { kind: "text", title, description: "", reference: "" } });
		category.results.push({ id: `nominee-${index}`, votes: 5 - index, percentage: 10, winner: false });
	}
	render(<EventPresenter eventId='show' initial={initial as never} />);
	const next = () => fireEvent.keyDown(window, { key: "ArrowRight" });
	next();
	const header = screen.getByRole("heading", { name: "Best fail" });
	expect(screen.queryByText("Lampe raucht ab")).not.toBeInTheDocument();
	next();
	expect(screen.getByLabelText("Category nominees")).toHaveTextContent("Lampe raucht ab");
	next();
	expect(screen.getByLabelText("Presented nominees")).toHaveTextContent("Lampe raucht ab");
	next();
	next();
	next();
	expect(screen.getByRole("heading", { name: "Best fail" })).toBe(header);
	expect(screen.getByLabelText("Nominee results")).toHaveTextContent("Third nominee");
	expect(screen.getByLabelText("Featured nominee")).toHaveTextContent("And the award goes to");
	next();
	expect(screen.getByLabelText("Featured nominee")).toHaveTextContent("Third nominee #3");
	expect(screen.getByLabelText("Nominee results")).toHaveTextContent("Second nominee");
	next();
	expect(screen.getByLabelText("Featured nominee")).toHaveTextContent("Second nominee #2");
	expect(screen.getByLabelText("Nominee results")).toHaveTextContent("Third nominee #3");
	next();
	expect(screen.getByLabelText("Award winners")).toHaveTextContent("Lampe raucht ab winner");
	expect(screen.getByLabelText("Nominee results")).toHaveTextContent("Fourth nominee");
	fireEvent.keyDown(window, { key: "ArrowLeft" });
	expect(screen.queryByLabelText("Award winners")).not.toBeInTheDocument();
});

it("presents nominees independently of vote order", () => {
	const initial: typeof view = JSON.parse(JSON.stringify(view));
	initial.event.categories[0].candidates.push({ id: "a-other", content: { kind: "text", title: "Another nominee", description: "", reference: "" } });
	initial.event.categories[0].results.push({ id: "a-other", votes: 0, percentage: 0, winner: false });
	render(<EventPresenter eventId='show' initial={initial as never} />);
	fireEvent.keyDown(window, { key: "ArrowRight" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByLabelText("Category nominees")).toHaveTextContent("Another nominee");
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByLabelText("Category nominees")).toHaveTextContent("Lampe raucht ab");
});

it("keeps enabled preview chat visible across the overview, media and reveals", () => {
	const initial = { ...view, event: { ...view.event, presentation: { showChat: true, hiddenAccounts: [], commandPrefixes: [] } } };
	render(<EventPresenter eventId='show' preview initial={initial as never} />);
	const chat = screen.getByRole("complementary", { name: "Twitch chat preview" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	fireEvent.click(within(screen.getByLabelText("Category nominees")).getByRole("button", { name: "Lampe raucht ab" }));
	expect(screen.getByRole("complementary", { name: "Twitch chat preview" })).toBe(chat);
	fireEvent.keyDown(window, { key: "Escape" });
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByRole("complementary", { name: "Twitch chat preview" })).toBe(chat);
});
