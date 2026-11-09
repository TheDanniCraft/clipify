import { fireEvent, render, screen } from "@testing-library/react";
import EventDiscovery from "@/app/components/events/EventDiscovery";
import { listPublicEventsAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ listPublicEventsAction: jest.fn() }));
it("recovers from a failed discovery request and explains an empty community list", async () => {
	jest.mocked(listPublicEventsAction).mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" }).mockResolvedValueOnce({ ok: true, events: [] });
	render(<EventDiscovery preview />);
	expect(await screen.findByRole("alert")).toHaveTextContent("could not load");
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	expect(await screen.findByRole("heading", { name: "No public events right now" })).toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Explore events" })).toHaveAttribute("href", "/events");
});
