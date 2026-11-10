import { notify } from "@lib/toast";
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventDataResults from "@/app/components/events/EventDataResults";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
jest.mock("@/app/actions/events", () => ({ getEventReviewAction: jest.fn(), setEventDataResultAction: jest.fn(async () => ({ ok: false, code: "INVALID_INPUT" })) }));
import { getEventReviewAction } from "@/app/actions/events";
it("explains a missing frozen result and preserves the manual winner after validation fails", async () => {
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.categories[0].selection = "data";
	jest.mocked(getEventReviewAction).mockResolvedValue({ ok: true, candidates: [], event: { configuration, published: true, reviewReleased: false, frozenAt: new Date(), frozenResults: { [configuration.categories[0].id]: { status: "missing", reason: "no_snapshot" } }, resultsPublishedAt: null } });
	render(<EventDataResults creatorId='host' eventId='event' />);
	expect(await screen.findByText("No complete snapshot is available. Enter the result below.", { exact: true })).toBeInTheDocument();
	fireEvent.change(screen.getByLabelText("Winner name"), { target: { value: "Viewer One" } });
	fireEvent.click(screen.getByRole("button", { name: "Save result" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Check the winner name"), color: "danger" })));
	expect(screen.getByLabelText("Winner name")).toHaveValue("Viewer One");
});

beforeEach(() => jest.mocked(notify).mockClear());
