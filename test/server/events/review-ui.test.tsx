import { fireEvent, render, screen } from "@testing-library/react";
import EventReview from "@/app/components/events/EventReview";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
const configuration = createAwardConfiguration("Awards", "UTC");
configuration.categories[0].source = "text";
jest.mock("@/app/components/events/EventSubmissionForm", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/actions/events", () => ({ getEventReviewAction: jest.fn(), nominateEventCandidatesAction: jest.fn(), groupEventCandidatesAction: jest.fn(), releaseEventReviewAction: jest.fn() }));
import { getEventReviewAction } from "@/app/actions/events";
it("shows the group's presentation title and lets the team inspect its original proposals", async () => {
	jest.mocked(getEventReviewAction).mockResolvedValue({
		ok: true,
		event: { configuration, published: true, reviewReleased: false, frozenAt: null, frozenResults: null, resultsPublishedAt: null },
		candidates: [
			{ id: "parent", eventId: "event", categoryId: configuration.categories[0].id, canonicalKey: "group:parent", content: { kind: "text", title: "Lampe raucht ab", description: "", reference: "" }, nominated: true, parentId: null, createdAt: new Date() },
			{ id: "child", eventId: "event", categoryId: configuration.categories[0].id, canonicalKey: "submission:child", content: { kind: "text", title: "hahaha die Lampe", description: "Original", reference: "" }, nominated: false, parentId: "parent", createdAt: new Date() },
		],
	});
	render(<EventReview creatorId='host' eventId='event' />);
	expect(await screen.findByText("Lampe raucht ab", { exact: true })).toBeInTheDocument();
	expect(screen.queryByText("hahaha die Lampe", { exact: true })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Show grouped proposals for Lampe raucht ab" }));
	expect(screen.getByText("hahaha die Lampe", { exact: true })).toBeInTheDocument();
});
