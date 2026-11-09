import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventConnections from "@/app/components/events/EventConnections";
jest.mock("@/app/components/controlledModal", () => ({ __esModule: true, default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? <div role='dialog'>{children}</div> : null) }));
jest.mock("@/app/actions/events", () => ({ listEventConnectionsAction: jest.fn(async () => ({ ok: true, connections: [] })), saveEventS3ConnectionAction: jest.fn(async () => ({ ok: false, code: "PROVIDER_UNAVAILABLE" })), beginEventGoogleConnectionAction: jest.fn() }));
it("preserves S3 fields and explains a failed connection without selecting unavailable storage", async () => {
	const selected = jest.fn();
	render(<EventConnections creatorId='host' eventId='11111111-1111-4111-8111-111111111111' value={null} onChange={selected} />);
	await waitFor(() => expect(screen.getByRole("button", { name: "Connect Google Drive" })).toBeEnabled());
	fireEvent.click(screen.getByRole("button", { name: "Connect S3" }));
	fireEvent.change(screen.getByRole("textbox", { name: "S3 endpoint" }), { target: { value: "https://storage.example.com" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Bucket" }), { target: { value: "awards" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Access key ID" }), { target: { value: "key" } });
	fireEvent.change(screen.getByLabelText("Secret access key"), { target: { value: "secret" } });
	fireEvent.click(screen.getByRole("button", { name: "Save S3 connection" }));
	await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Check your S3 endpoint"));
	expect(screen.getByRole("textbox", { name: "Bucket" })).toHaveValue("awards");
	expect(selected).not.toHaveBeenCalled();
});

it("stays on the editor when its changes cannot be saved before Google OAuth", async () => {
	const { beginEventGoogleConnectionAction } = await import("@/app/actions/events");
	jest.mocked(beginEventGoogleConnectionAction).mockClear();
	const beforeConnect = jest.fn(async () => false);
	render(<EventConnections creatorId='host' eventId='11111111-1111-4111-8111-111111111111' value={null} onChange={jest.fn()} beforeConnect={beforeConnect} />);
	await waitFor(() => expect(screen.getByRole("button", { name: "Connect Google Drive" })).toBeEnabled());
	fireEvent.click(screen.getByRole("button", { name: "Connect Google Drive" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Save your event changes");
	expect(beforeConnect).toHaveBeenCalled();
	expect(beginEventGoogleConnectionAction).not.toHaveBeenCalled();
});
