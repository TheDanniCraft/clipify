jest.mock("@heroui-pro/react", () => require("../../support/mcp/heroui-fixture").proComponents, { virtual: true });
jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
jest.mock("@/app/actions/mcp-connections", () => ({ getMcpActivityCreators: jest.fn(), getConnectedMcpActivityPage: jest.fn() }));
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as actions from "@/app/actions/mcp-connections";
let Panel: any;
try {
	Panel = require("@/app/dashboard/settings/mcp-activity-panel").default;
} catch {}
const api = actions as any;
const event = { id: "event-1", occurredAt: "2026-10-05T00:00:00.000001Z", actor: { id: "actor", name: "Creator owner" }, client: { id: "client", name: "Custom AI" }, creator: { id: "creator", name: "Creator" }, tool: "get_playlist", outcome: "success", reason: null };
describe("TDD-ACTIVITY-005 accessible activity controls", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		api.getMcpActivityCreators.mockResolvedValue({ available: true, creators: [{ id: "creator", name: "Creator" }] });
		api.getConnectedMcpActivityPage.mockResolvedValue({ items: [event], nextCursor: null });
	});
	test("shows a named loading region while creator access is checked", async () => {
		expect(Panel).toEqual(expect.any(Function));
		api.getMcpActivityCreators.mockReturnValue(new Promise(() => {}));
		render(<Panel />);
		expect(screen.getByRole("region", { name: "AI app activity" })).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent("Loading activity");
		expect(api.getConnectedMcpActivityPage).not.toHaveBeenCalled();
	});
	test("renders actor, app, creator, operation, time and outcome in an accessible region", async () => {
		expect(Panel).toEqual(expect.any(Function));
		render(<Panel />);
		expect(await screen.findByRole("region", { name: "AI app activity" })).toBeVisible();
		expect(await screen.findByText("Read playlist")).toBeVisible();
		expect(screen.getByText("Creator owner")).toBeVisible();
		expect(screen.getByText("Custom AI")).toBeVisible();
		expect(screen.getByRole("grid", { name: "AI app activity log" })).toBeVisible();
		expect(screen.getAllByText("Creator").length).toBeGreaterThan(0);
		expect(screen.getByText("Completed")).toBeVisible();
		expect(document.querySelector("time")?.getAttribute("dateTime")).toBe(event.occurredAt);
	});
	test("empty history explains when activity will appear", async () => {
		expect(Panel).toEqual(expect.any(Function));
		api.getConnectedMcpActivityPage.mockResolvedValue({ items: [], nextCursor: null });
		render(<Panel />);
		expect(await screen.findByText("No activity yet")).toBeVisible();
	});
	test("no audit-authorized creators does not query history", async () => {
		expect(Panel).toEqual(expect.any(Function));
		api.getMcpActivityCreators.mockResolvedValue({ available: true, creators: [] });
		render(<Panel />);
		expect(await screen.findByText("No creator activity access")).toBeVisible();
		expect(api.getConnectedMcpActivityPage).not.toHaveBeenCalled();
	});
	test("disabled feature hides controls without querying history", async () => {
		expect(Panel).toEqual(expect.any(Function));
		api.getMcpActivityCreators.mockResolvedValue({ available: false, creators: [] });
		render(<Panel />);
		await waitFor(() => expect(screen.queryByRole("region", { name: "AI app activity" })).toBeNull());
		expect(api.getConnectedMcpActivityPage).not.toHaveBeenCalled();
		expect(screen.queryByRole("region", { name: "AI app activity" })).toBeNull();
	});
	test("loads the next signed page and preserves prior entries", async () => {
		expect(Panel).toEqual(expect.any(Function));
		api.getConnectedMcpActivityPage.mockResolvedValueOnce({ items: [event], nextCursor: "next-page" }).mockResolvedValueOnce({ items: [{ ...event, id: "event-2", tool: "update_playlist", outcome: "denied", reason: "CONFLICT" }], nextCursor: null });
		render(<Panel />);
		await screen.findByText("Read playlist");
		fireEvent.click(screen.getByRole("button", { name: "Load older activity" }));
		expect(await screen.findByText("Rename playlist")).toBeVisible();
		expect(screen.getByText("Read playlist")).toBeVisible();
		expect(api.getConnectedMcpActivityPage).toHaveBeenLastCalledWith({ creatorId: "creator", limit: 25, cursor: "next-page" });
	});
	test("current access failure clears private history and offers refresh", async () => {
		expect(Panel).toEqual(expect.any(Function));
		api.getConnectedMcpActivityPage.mockResolvedValueOnce({ items: [event], nextCursor: null }).mockResolvedValueOnce({ items: [], nextCursor: null, error: "Activity is unavailable for this creator. Your access may have changed." });
		render(<Panel />);
		await screen.findByText("Read playlist");
		fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Your access may have changed");
		expect(screen.queryByText("Creator owner")).toBeNull();
	});
	test("creator lookup rejection shows safe feedback without requesting private history", async () => {
		api.getMcpActivityCreators.mockRejectedValue(new Error("private database failure"));
		render(<Panel />);
		expect(await screen.findByRole("alert")).toHaveTextContent("Creator activity access could not be loaded");
		expect(api.getConnectedMcpActivityPage).not.toHaveBeenCalled();
		expect(screen.queryByText("private database failure")).not.toBeInTheDocument();
	});
	test("history rejection ends loading and offers safe retry feedback", async () => {
		api.getConnectedMcpActivityPage.mockRejectedValue(new Error("private query"));
		render(<Panel />);
		expect(await screen.findByRole("alert")).toHaveTextContent("Activity could not be loaded");
		expect(screen.getByRole("button", { name: "Refresh activity" })).toBeEnabled();
		expect(screen.queryByText("private query")).not.toBeInTheDocument();
	});
	test.each(["returned", "rejected"])("%s older-page failure clears private history", async (mode) => {
		api.getConnectedMcpActivityPage.mockResolvedValueOnce({ items: [event], nextCursor: "next-page" });
		if (mode === "returned") api.getConnectedMcpActivityPage.mockResolvedValueOnce({ items: [], nextCursor: null, error: "Access changed" });
		else api.getConnectedMcpActivityPage.mockRejectedValueOnce(new Error("private query"));
		render(<Panel />);
		await screen.findByText("Read playlist");
		fireEvent.click(screen.getByRole("button", { name: "Load older activity" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(mode === "returned" ? "Access changed" : "Activity could not be loaded");
		expect(screen.queryByText("Creator owner")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Load older activity" })).not.toBeInTheDocument();
	});
	test("overlapping pages render an event once", async () => {
		api.getConnectedMcpActivityPage.mockResolvedValueOnce({ items: [event], nextCursor: "next-page" }).mockResolvedValueOnce({ items: [event, { ...event, id: "event-2", tool: "create_overlay" }], nextCursor: null });
		render(<Panel />);
		await screen.findByText("Read playlist");
		fireEvent.click(screen.getByRole("button", { name: "Load older activity" }));
		expect(await screen.findByText("Create overlay")).toBeVisible();
		expect(screen.getAllByText("Read playlist")).toHaveLength(1);
	});
	test.each([
		["control_overlay", "Control live overlay"],
		["commit_playlist_import", "Import previewed clips"],
		["get_player_embed", "Get public player embed"],
		["get_runner_snapshot", "Read runner snapshot"],
		["submit_feedback", "Submit feedback"],
	])("%s uses a readable workflow label", async (tool, label) => {
		api.getConnectedMcpActivityPage.mockResolvedValue({ items: [{ ...event, tool }], nextCursor: null });
		render(<Panel />);
		expect(await screen.findByText(label)).toBeVisible();
	});
	test("unknown failed operation retains safe labels", async () => {
		api.getConnectedMcpActivityPage.mockResolvedValue({ items: [{ ...event, tool: "unavailable_tool", outcome: "error" }], nextCursor: null });
		render(<Panel />);
		expect(await screen.findByText("Unavailable tool")).toBeVisible();
		expect(screen.getByText("Failed")).toBeVisible();
	});
	test.each(["resolved", "rejected"])("late %s history from a previous creator cannot replace current history", async (mode) => {
		let resolve!: (value: unknown) => void;
		let reject!: (error: Error) => void;
		api.getMcpActivityCreators.mockResolvedValue({
			available: true,
			creators: [
				{ id: "creator", name: "First creator" },
				{ id: "second", name: "Second creator" },
			],
		});
		api.getConnectedMcpActivityPage
			.mockReturnValueOnce(
				new Promise((done, fail) => {
					resolve = done;
					reject = fail;
				}),
			)
			.mockResolvedValueOnce({ items: [{ ...event, creator: { id: "second", name: "Second creator" }, tool: "create_playlist" }], nextCursor: null });
		render(<Panel />);
		await waitFor(() => expect(api.getConnectedMcpActivityPage).toHaveBeenCalledWith({ creatorId: "creator", limit: 25 }));
		fireEvent.click(screen.getByRole("option", { name: "Second creator" }));
		expect(await screen.findByText("Create playlist")).toBeVisible();
		await act(async () => {
			if (mode === "resolved") resolve({ items: [event], nextCursor: null });
			else reject(new Error("old private query"));
		});
		expect(screen.getByText("Create playlist")).toBeVisible();
		expect(screen.queryByText("Read playlist")).not.toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
	test.each(["resolved", "rejected"])("late %s older page cannot contaminate a new creator", async (mode) => {
		let resolve!: (value: unknown) => void;
		let reject!: (error: Error) => void;
		api.getMcpActivityCreators.mockResolvedValue({
			available: true,
			creators: [
				{ id: "creator", name: "First creator" },
				{ id: "second", name: "Second creator" },
			],
		});
		api.getConnectedMcpActivityPage
			.mockResolvedValueOnce({ items: [event], nextCursor: "older" })
			.mockReturnValueOnce(
				new Promise((done, fail) => {
					resolve = done;
					reject = fail;
				}),
			)
			.mockResolvedValueOnce({ items: [{ ...event, creator: { id: "second", name: "Second creator" }, tool: "create_playlist" }], nextCursor: null });
		render(<Panel />);
		await screen.findByText("Read playlist");
		fireEvent.click(screen.getByRole("button", { name: "Load older activity" }));
		fireEvent.click(screen.getByRole("option", { name: "Second creator" }));
		expect(await screen.findByText("Create playlist")).toBeVisible();
		await act(async () => {
			if (mode === "resolved") resolve({ items: [event], nextCursor: "older" });
			else reject(new Error("old private query"));
		});
		expect(screen.getByText("Create playlist")).toBeVisible();
		expect(screen.queryByText("Read playlist")).not.toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
