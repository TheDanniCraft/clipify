import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import EventInteractionControl from "@/app/components/events/EventInteractionControl";
import { eventInteractionAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ eventInteractionAction: jest.fn() }));
const props = { eventId: "event", secret: "secret", slideId: "slide", type: "prediction" as const, wait: true, winner: false };
beforeEach(() => jest.mocked(eventInteractionAction).mockReset());
it("blocks the host while Twitch accepts entries and resolves on winner reveal", async () => {
	const onState = jest.fn();
	jest.mocked(eventInteractionAction).mockResolvedValueOnce({ ok: true, state: { type: "prediction", id: "remote", status: "ACTIVE", endsAt: new Date(Date.now() + 60000).toISOString(), outcomes: {} } });
	const view = render(<EventInteractionControl {...props} onState={onState} />);
	await waitFor(() => expect(onState).toHaveBeenCalledWith({ slideId: "slide", blocked: true }));
	jest.mocked(eventInteractionAction).mockResolvedValueOnce({ ok: true, state: { type: "prediction", id: "remote", status: "RESOLVED", endsAt: new Date().toISOString(), outcomes: {} } });
	view.rerender(<EventInteractionControl {...props} winner onState={onState} />);
	await waitFor(() => expect(onState).toHaveBeenLastCalledWith({ slideId: "slide", blocked: false }));
	expect(eventInteractionAction).toHaveBeenLastCalledWith("event", "secret", "slide", "resolve");
});
it("allows recovery while warning if Twitch cancellation remains unconfirmed", async () => {
	const onState = jest.fn();
	jest.mocked(eventInteractionAction).mockResolvedValueOnce({ ok: false, code: "PROVIDER_UNAVAILABLE" });
	render(<EventInteractionControl {...props} onState={onState} />);
	expect(await screen.findByRole("alert")).toHaveTextContent("Retry or skip");
	jest.mocked(eventInteractionAction).mockResolvedValueOnce({ ok: true, state: { type: "prediction", status: "SKIPPED", manualCheck: true, endsAt: new Date().toISOString(), outcomes: {} } });
	fireEvent.click(screen.getByRole("button", { name: "Skip interaction" }));
	await waitFor(() => expect(onState).toHaveBeenLastCalledWith({ slideId: "slide", blocked: false }));
	expect(screen.getByText(/Check Twitch manually/)).toBeVisible();
});
