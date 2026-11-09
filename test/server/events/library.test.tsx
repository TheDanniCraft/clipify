import { fireEvent, render, screen } from "@testing-library/react";
import EventLibrary from "@/app/components/events/EventLibrary";
import { createEventAction, listEventsAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ createEventAction: jest.fn(), listEventsAction: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
beforeEach(() => {
	jest.mocked(listEventsAction).mockResolvedValue({ ok: true, events: [] });
	jest.mocked(createEventAction).mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
});
it("shows empty state and preserves event name after failed creation", async () => {
	render(<EventLibrary creatorId='host' />);
	expect(await screen.findByText("No events yet")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Create event" }));
	fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Babbler Awards" } });
	fireEvent.click(screen.getByRole("button", { name: "Create awards" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("could not be created");
	expect(screen.getByLabelText("Event title")).toHaveValue("Babbler Awards");
});
