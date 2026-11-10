import { notify } from "@lib/toast";
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventConnections from "@/app/components/events/EventConnections";
jest.mock("@/auth/client", () => ({ authClient: { linkSocial: jest.fn() } }));
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
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Check your S3 endpoint"), color: "danger" })));
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
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Save your event changes"), color: "danger" })));
	expect(beforeConnect).toHaveBeenCalled();
	expect(beginEventGoogleConnectionAction).not.toHaveBeenCalled();
});

it("retries loading connections without leaving the tab", async () => {
	const { listEventConnectionsAction } = await import("@/app/actions/events");
	jest.mocked(listEventConnectionsAction).mockRejectedValueOnce(new Error("Network unavailable"));
	render(<EventConnections creatorId='host' eventId='11111111-1111-4111-8111-111111111111' value={null} onChange={jest.fn()} />);
	expect(await screen.findByRole("alert")).toHaveTextContent("Connections could not be loaded.");
	fireEvent.click(screen.getByRole("button", { name: "Retry connections" }));
	await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
	await waitFor(() => expect(screen.getByRole("button", { name: "Connect S3" })).toBeEnabled());
});

it("keeps the editor usable when Better Auth declines a Google connection", async () => {
	const { authClient } = await import("@/auth/client");
	const { beginEventGoogleConnectionAction } = await import("@/app/actions/events");
	const link = { provider: "google-drive", scopes: ["https://www.googleapis.com/auth/drive.file"], callbackURL: "/dashboard/events/connect/drive/complete?intent=fixture" };
	jest.mocked(beginEventGoogleConnectionAction).mockResolvedValueOnce({ ok: true, link } as never);
	jest.mocked(authClient.linkSocial).mockResolvedValueOnce({ data: null, error: { message: "Connection unavailable" } } as never);
	render(<EventConnections creatorId='host' eventId='11111111-1111-4111-8111-111111111111' value={null} onChange={jest.fn()} />);
	await waitFor(() => expect(screen.getByRole("button", { name: "Connect Google Drive" })).toBeEnabled());
	fireEvent.click(screen.getByRole("button", { name: "Connect Google Drive" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Google could not be connected."), color: "danger" })));
	expect(authClient.linkSocial).toHaveBeenCalledWith(link);
	expect(screen.getByRole("button", { name: "Connect Google Drive" })).toBeEnabled();
});

beforeEach(() => jest.mocked(notify).mockClear());

it("shows the Google callback outcome once as a toast", () => {
	const props = { creatorId: "host", eventId: "11111111-1111-4111-8111-111111111111", value: null, onChange: jest.fn(), status: "connected" as const };
	const view = render(<EventConnections {...props} />);
	expect(notify).toHaveBeenCalledWith({ title: "Google account connected.", color: "success" });
	view.rerender(<EventConnections {...props} />);
	expect(notify).toHaveBeenCalledTimes(1);
	expect(screen.queryByText("Google account connected. Your available accounts are listed below.")).not.toBeInTheDocument();
});

it("consumes a failed Google callback flag while preserving the editor section", () => {
	window.history.replaceState({ test: "retained" }, "", "/dashboard/events/example?section=connections&connection=retry");
	try {
		render(<EventConnections creatorId='host' eventId='11111111-1111-4111-8111-111111111111' value={null} onChange={jest.fn()} status='retry' />);
		expect(notify).toHaveBeenCalledWith({ title: "Google was not connected.", description: "Try again and grant the requested access.", color: "danger" });
		expect(window.location.search).toBe("?section=connections");
		expect(window.history.state).toEqual({ test: "retained" });
	} finally {
		window.history.replaceState(null, "", "/");
	}
});
