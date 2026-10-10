jest.mock("@heroui-pro/react", () => require("../../support/mcp/heroui-fixture").proComponents, { virtual: true });
jest.mock("@heroui/react", () => require("./ai-apps-heroui-fixture").components);
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
jest.mock("@/app/actions/mcp-connections", () => ({ getConnectedMcpApps: jest.fn(), revokeConnectedMcpApp: jest.fn() }));
import { getConnectedMcpApps, revokeConnectedMcpApp } from "@/app/actions/mcp-connections";
let Panel: any;
try {
	Panel = require("@/app/dashboard/settings/connected-apps-panel").default;
} catch {}
const connection = { id: "first", clientName: "My custom AI", clientId: "client", scopes: ["creator:read"], creatorIds: ["creator"], createdAt: "2026-10-04T00:00:00Z", expiresAt: "2026-11-04T00:00:00Z", revokedAt: null, active: true };
describe("TDD-US1-020/024 connected apps UI", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [connection] });
	});
	test("shows approved scopes/creators and requires an explicit revoke action", async () => {
		expect(Panel).toEqual(expect.any(Function));
		render(<Panel />);
		expect(await screen.findByText("My custom AI")).toBeVisible();
		expect(screen.queryByText(/creator:read/)).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Details for My custom AI" }));
		expect(screen.getByText(/creator:read/)).toBeVisible();
		expect(screen.getByText("Creators: creator")).toBeTruthy();
		expect(screen.getByRole("dialog", { name: "Connection details for My custom AI" })).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Close details" }));
		fireEvent.click(screen.getByRole("button", { name: "Revoke My custom AI" }));
		expect(screen.getByRole("dialog", { name: "Revoke app access" })).toBeVisible();
		expect(revokeConnectedMcpApp).not.toHaveBeenCalled();
		(revokeConnectedMcpApp as jest.Mock).mockResolvedValue({ revoked: true, cleanupPending: false });
		(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [{ ...connection, active: false, revokedAt: "2026-10-04T01:00:00Z" }] });
		fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
		await waitFor(() => expect(revokeConnectedMcpApp).toHaveBeenCalledWith("first"));
		expect(await screen.findByText("Revoked")).toBeVisible();
	});
	test("failed durable revoke retains active connection and reports failure", async () => {
		expect(Panel).toEqual(expect.any(Function));
		render(<Panel />);
		await screen.findByText("My custom AI");
		(revokeConnectedMcpApp as jest.Mock).mockResolvedValue({ error: "Access could not be revoked. Try again." });
		fireEvent.click(screen.getByRole("button", { name: "Revoke My custom AI" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Access could not be revoked");
		expect(screen.getByText("Active")).toBeVisible();
	});
	test("cancel leaves authority unchanged and never calls revoke", async () => {
		render(<Panel />);
		await screen.findByText("My custom AI");
		fireEvent.click(screen.getByRole("button", { name: "Revoke My custom AI" }));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByRole("button", { name: "Confirm revoke" })).not.toBeInTheDocument();
		expect(screen.getByText("Active")).toBeVisible();
		expect(revokeConnectedMcpApp).not.toHaveBeenCalled();
	});
	test("durable revoke stays revoked when provider cleanup and subsequent refresh fail", async () => {
		render(<Panel />);
		await screen.findByText("My custom AI");
		(revokeConnectedMcpApp as jest.Mock).mockResolvedValue({ revoked: true, cleanupPending: true });
		(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [], error: "Refresh failed" });
		fireEvent.click(screen.getByRole("button", { name: "Revoke My custom AI" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
		expect(await screen.findByText("Revoked")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent("Access is revoked");
		expect(screen.queryByText("Active")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Retry cleanup for My custom AI" })).toBeEnabled();
	});
	test("rejected durable revoke reports failure and preserves active authority", async () => {
		render(<Panel />);
		await screen.findByText("My custom AI");
		(revokeConnectedMcpApp as jest.Mock).mockRejectedValue(new Error("network unavailable"));
		fireEvent.click(screen.getByRole("button", { name: "Revoke My custom AI" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Access could not be revoked");
		expect(screen.getByText("Active")).toBeVisible();
	});
	test("empty connected-app response shows the onboarding empty state", async () => {
		(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [] });
		render(<Panel />);
		expect(await screen.findByText("No connected apps.")).toBeVisible();
		expect(screen.queryByText("Loading connected apps…")).not.toBeInTheDocument();
		expect(revokeConnectedMcpApp).not.toHaveBeenCalled();
	});
	test("rejected initial load shows safe feedback and ends loading", async () => {
		(getConnectedMcpApps as jest.Mock).mockRejectedValue(new Error("private network details"));
		render(<Panel />);
		expect(await screen.findByRole("alert")).toHaveTextContent("Connected apps could not be loaded. Try again.");
		expect(screen.queryByText("Loading connected apps…")).not.toBeInTheDocument();
		expect(screen.queryByText("private network details")).not.toBeInTheDocument();
	});
	test("expired connections have a distinct status and explicit cleanup action", async () => {
		(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [{ ...connection, active: false, revokedAt: null, expiresAt: "2000-01-01T00:00:00Z" }] });
		render(<Panel />);
		fireEvent.click(await screen.findByRole("button", { name: "Show inactive connections (1)" }));
		expect(await screen.findByText("Expired")).toBeVisible();
		expect(screen.getByRole("button", { name: "Retry cleanup for My custom AI" })).toBeEnabled();
		expect(revokeConnectedMcpApp).not.toHaveBeenCalled();
	});
	test("missing successful revoke acknowledgement preserves active status", async () => {
		(revokeConnectedMcpApp as jest.Mock).mockResolvedValue({ revoked: false });
		render(<Panel />);
		await screen.findByText("My custom AI");
		fireEvent.click(screen.getByRole("button", { name: "Revoke My custom AI" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Access could not be revoked. Try again.");
		expect(screen.getByText("Active")).toBeVisible();
	});
	test("a load resolving after unmount does not render stale app data", async () => {
		let resolve!: (value: unknown) => void;
		(getConnectedMcpApps as jest.Mock).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const view = render(<Panel />);
		view.unmount();
		await act(async () => {
			resolve({ connections: [connection] });
		});
		expect(screen.queryByText("My custom AI")).not.toBeInTheDocument();
	});
});

test("connected app settings provide optional English example prompts without running actions", async () => {
	jest.clearAllMocks();
	(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [] });
	render(<Panel />);
	await screen.findByText("No connected apps.");
	expect(screen.getByText("Ideas to try with your AI app")).toBeInTheDocument();
	expect(screen.getByText("Give my overlay a purple theme with rounded corners and a visible progress bar.")).toBeInTheDocument();
	expect(screen.getByText("Show me which Minecraft clips from yesterday you would add to my playlist.")).toBeInTheDocument();
	expect(revokeConnectedMcpApp).not.toHaveBeenCalled();
});

test("future inactive connections are hidden initially and are not mislabeled expired", async () => {
	(getConnectedMcpApps as jest.Mock).mockResolvedValue({ connections: [{ ...connection, active: false, revokedAt: null, expiresAt: "2099-01-01T00:00:00Z" }] });
	render(<Panel />);
	expect(await screen.findByText("No active connections.")).toBeVisible();
	expect(screen.queryByText("My custom AI")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Show inactive connections (1)" }));
	expect(screen.getByRole("grid", { name: "Connected AI apps" })).toBeVisible();
	expect(screen.getByText("Inactive")).toBeVisible();
	expect(screen.queryByText("Expired")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Hide inactive connections" }));
	expect(screen.queryByText("My custom AI")).not.toBeInTheDocument();
});
