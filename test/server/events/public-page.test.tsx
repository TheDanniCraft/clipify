import { notify } from "@lib/toast";
import { withdrawEventSubmissionAction } from "@actions/events";
import { createAwardConfiguration } from "@lib/eventDefaults";
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PublicEventView from "@/app/components/events/PublicEventView";
jest.mock("@/app/actions/events", () => ({ getPublicEventAction: jest.fn(), withdrawEventSubmissionAction: jest.fn() }));
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

it("reports a failed withdrawal as a toast and keeps the original proposal available", async () => {
	jest.mocked(withdrawEventSubmissionAction).mockRejectedValueOnce(new Error("Network unavailable"));
	const event = { ...createAwardConfiguration("Awards", "UTC"), id: "event", phase: "submissions", categories: [] };
	render(<PublicEventView initial={{ ok: true, event, selection: [], participating: true, submissions: [{ id: "receipt", categoryId: "category", original: { title: "My proposal" } }] } as never} creatorName='Host' />);
	fireEvent.click(screen.getByRole("button", { name: "Withdraw proposal" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith({ title: "This proposal could not be withdrawn. Please try again.", color: "danger" }));
	expect(screen.getByText("My proposal")).toBeVisible();
	expect(screen.getByRole("button", { name: "Withdraw proposal" })).toBeEnabled();
});

it("shows a data-award winner once above its other nominees in the published archive", () => {
	const configuration = createAwardConfiguration("Awards", "UTC");
	const winner = { kind: "text", title: "Data winner", description: "", reference: "" };
	const event = {
		...configuration,
		id: "event",
		phase: "results",
		categories: [
			{
				...configuration.categories[0],
				selection: "data",
				candidates: [
					{ id: "winner", content: winner },
					{ id: "other", content: { ...winner, title: "Other nominee" } },
				],
				dataResult: { status: "ready", source: "manual", title: winner.title, description: "", content: winner, asOf: new Date().toISOString() },
			},
		],
	};
	render(<PublicEventView initial={{ ok: true, event, selection: [], participating: false, submissions: [] } as never} creatorName='Host' />);
	expect(screen.getAllByRole("button", { name: "View Data winner" })).toHaveLength(1);
	const first = screen.getByRole("button", { name: "View Data winner" }),
		other = screen.getByRole("button", { name: "View Other nominee" });
	expect(first.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(screen.getByText("Winner", { exact: true })).toBeVisible();
});
