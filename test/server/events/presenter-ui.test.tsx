import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventPresenter from "@/app/components/events/EventPresenter";
import { getEventPresenterAction, publishEventPresenterResultsAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ getEventPresenterAction: jest.fn(), publishEventPresenterResultsAction: jest.fn() }));
jest.mock("@/app/components/events/EventMedia", () => ({
	EventMedia: ({ content }: { content: { title: string } }) => <div data-testid='opened-media'>{content.title}</div>,
	EventNomineeCard: ({ candidate, onOpen, result }: { candidate: { content: { title: string } }; onOpen: () => void; result?: { winner: boolean } }) => (
		<button onClick={onOpen}>
			{candidate.content.title}
			{result?.winner ? " winner" : ""}
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
	fireEvent.click(screen.getByRole("button", { name: "Lampe raucht ab" }));
	expect(screen.getByTestId("opened-media")).toBeInTheDocument();
	fireEvent.keyDown(window, { key: "Escape" });
	expect(screen.queryByTestId("opened-media")).not.toBeInTheDocument();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByRole("button", { name: "Lampe raucht ab winner" })).toBeInTheDocument();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByRole("heading", { name: "Thank you!" })).toBeInTheDocument();
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
