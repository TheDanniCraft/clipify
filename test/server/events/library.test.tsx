import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventLibrary from "@/app/components/events/EventLibrary";
import { createEventAction, listEventsAction } from "@/app/actions/events";
const push = jest.fn();
jest.mock("@/app/actions/events", () => ({ createEventAction: jest.fn(), listEventsAction: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(listEventsAction).mockResolvedValue({ ok: true, events: [] });
	jest.mocked(createEventAction).mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
});
it("opens a generic new event directly in the editor without a title modal", async () => {
	jest.mocked(createEventAction).mockResolvedValue({ ok: true, event: { id: "event-id" } } as never);
	render(<EventLibrary creatorId='host' />);
	await screen.findByText("No events yet");
	fireEvent.click(screen.getByRole("button", { name: "Create event" }));
	await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/events/event-id"));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(createEventAction).toHaveBeenCalledWith("host", expect.objectContaining({ title: "New event", visibility: "unlisted" }));
});
it("offers creation recovery without blaming a valid title for a server failure", async () => {
	render(<EventLibrary creatorId='host' />);
	await screen.findByText("No events yet");
	fireEvent.click(screen.getByRole("button", { name: "Create event" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Your event could not be created. Please try again.");
	expect(screen.getByRole("button", { name: "Create event" })).toBeEnabled();
	expect(push).not.toHaveBeenCalled();
});
it("retries an unavailable library without losing the create action", async () => {
	jest.mocked(listEventsAction).mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" }).mockResolvedValueOnce({ ok: true, events: [] });
	render(<EventLibrary creatorId='host' />);
	expect(await screen.findByRole("alert")).toHaveTextContent("Events could not be loaded.");
	fireEvent.click(screen.getByRole("button", { name: "Retry events" }));
	expect(await screen.findByText("No events yet")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Create event" })).toBeEnabled();
});
