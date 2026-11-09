import { render, screen } from "@testing-library/react";
import PublicEventView from "@/app/components/events/PublicEventView";
jest.mock("@/app/actions/events", () => ({ getPublicEventAction: jest.fn() }));
jest.mock("@/app/components/events/EventProgress", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventRoadmap", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventSubmissionForm", () => ({ __esModule: true, default: () => null }));
it("explains closed voting without revealing results or offering vote changes", () => {
	const event = { id: "event", ownerId: "host", title: "Babbler Awards", description: "Community", phase: "closed", votesPerCategory: 1, whiteLabel: false, schedule: { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-08T00:00:00Z", votingEnd: "2026-02-15T00:00:00Z", timezone: "UTC", reviewRequired: true }, categories: [] };
	render(<PublicEventView initial={{ ok: true, event, selection: [], participating: true, submissions: [] } as never} creatorName='Host' />);
	expect(screen.getByRole("heading", { name: "Babbler Awards" })).toBeInTheDocument();
	expect(screen.getByText(/Voting has ended/)).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: /Vote for/ })).not.toBeInTheDocument();
});
