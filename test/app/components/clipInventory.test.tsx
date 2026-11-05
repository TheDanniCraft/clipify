const notify = jest.fn();
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClipInventory from "@components/creator/clipInventory";
let path = "/dashboard/clips";
const inventory = jest.fn();
const preview = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({ usePathname: () => path }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipInventory: (...args: unknown[]) => inventory(...args), getCreatorClipPreview: (...args: unknown[]) => preview(...args), refreshCreatorLibrary: (...args: unknown[]) => refresh(...args) }));
jest.mock("@components/appDateRangePicker", () => ({ __esModule: true, default: ({ value }: { value: { start: { toString: () => string }; end: { toString: () => string } } | null }) => <output data-testid='range'>{value ? `${value.start.toString()}/${value.end.toString()}` : "none"}</output> }));
jest.mock("@components/appPagination", () => ({ __esModule: true, default: ({ onChange }: { onChange: (page: number) => void }) => <button onClick={() => onChange(2)}>Next page</button> }));
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ isOpen, children, onClose }: { isOpen: boolean; children: React.ReactNode; onClose: () => void }) =>
		isOpen ? (
			<section aria-label='Preview'>
				<button onClick={onClose}>Close preview</button>
				{children}
			</section>
		) : null,
}));
jest.mock("@components/localizedDate", () => ({ __esModule: true, default: ({ value, timeZone }: { value: string; timeZone?: string }) => <time data-timezone={timeZone}>{value}</time> }));
jest.mock("@components/creator/clipExport", () => ({ __esModule: true, default: () => null }));
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../__mocks__/heroui-react.cjs");
	const TextField = ({ children, onChange }: { children: React.ReactNode; onChange: (value: string) => void }) => <div onChange={(event) => onChange((event.target as HTMLInputElement).value)}>{children}</div>;

	const Checkbox = Object.assign(
		({ children, isSelected, isDisabled, onChange }: { children: React.ReactNode; isSelected: boolean; isDisabled: boolean; onChange: (value: boolean) => void }) => (
			<label>
				<input type='checkbox' checked={isSelected} disabled={isDisabled} onChange={(event) => onChange(event.target.checked)} />
				{children}
			</label>
		),
		{ Content: base.Checkbox.Content, Control: base.Checkbox.Control, Indicator: base.Checkbox.Indicator },
	);
	const Select = Object.assign(
		({ children, onSelectionChange, "aria-label": label }: { children: React.ReactNode; onSelectionChange: (key: string | null) => void; "aria-label"?: string }) => (
			<div>
				{children}
				<button type='button' onClick={() => onSelectionChange(label ? "game" : "most_viewed")}>
					Choose {label || "sort"}
				</button>
				<button type='button' onClick={() => onSelectionChange(null)}>
					Reset {label || "sort"}
				</button>
			</div>
		),
		{ Trigger: base.Select.Trigger, Value: base.Select.Value, Popover: base.Select.Popover },
	);
	const NumberField = Object.assign(
		({ children, onChange }: { children: React.ReactNode; onChange: (value: number) => void }) => (
			<div>
				{children}
				<button type='button' onClick={() => onChange(5)}>
					Set numeric filter
				</button>
				<button type='button' onClick={() => onChange(NaN)}>
					Clear numeric filter
				</button>
			</div>
		),
		{ Group: base.NumberField.Group, Input: base.NumberField.Input, DecrementButton: base.NumberField.DecrementButton, IncrementButton: base.NumberField.IncrementButton },
	);
	const overrides: Record<string, unknown> = { TextField, Checkbox, Select, NumberField };
	return new Proxy(base, {
		get(target, key) {
			return typeof key === "string" && key in overrides ? overrides[key] : target[key];
		},
	});
});
const data = { ok: true as const, items: [], total: 0, categories: [], complete: false, fetchedAt: null };
beforeEach(() => {
	jest.clearAllMocks();
	path = "/dashboard/clips";
	window.history.replaceState(null, "", "/dashboard/clips");
});
it("restores calendar days in the saved timezone rather than slicing UTC timestamps", () => {
	render(<ClipInventory creatorId='owner' query={{ startedAt: "2026-10-31T23:00:00.000Z", endedAt: "2026-11-02T23:00:00.000Z", timeZone: "Europe/Berlin" }} data={data} />);
	expect(screen.getByTestId("range")).toHaveTextContent("2026-11-01/2026-11-02");
});
it("restores the date picker together with results after browser Back", async () => {
	inventory.mockResolvedValue(data);
	render(<ClipInventory creatorId='owner' query={{}} data={data} />);
	window.history.replaceState(null, "", "/dashboard/clips?startedAt=2026-11-01T00%3A00%3A00.000Z&endedAt=2026-11-03T00%3A00%3A00.000Z&timeZone=UTC");
	fireEvent.popState(window);
	await waitFor(() => expect(screen.getByTestId("range")).toHaveTextContent("2026-11-01/2026-11-02"));
	expect(inventory).toHaveBeenCalled();
});

it("keeps stream identity when clearing optional filters", async () => {
	path = "/dashboard/streams/123";
	inventory.mockResolvedValue(data);
	render(<ClipInventory creatorId='owner' query={{ videoId: "123", title: "Clutch" }} data={data} />);
	fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
	await waitFor(() => expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: { videoId: "123" } }));
});

const item = { id: "A", title: "Clutch", url: "https://clips.twitch.tv/A", categoryId: "game", createdAt: "2026-11-03T00:00:00Z", views: 10, duration: 12, thumbnailUrl: "https://static-cdn.jtvnw.net/a.jpg", broadcasterId: "owner", broadcasterName: null, clipCreatorId: null, clipCreatorName: null, videoId: null, vodOffsetSeconds: null, language: null, isFeatured: null };
it("shows cached metadata, selects only the visible page and clears explicit selection", () => {
	render(<ClipInventory creatorId='owner' query={{}} data={{ ...data, items: [item], total: 1, complete: true, fetchedAt: "2026-11-03T00:00:00Z", categories: [{ id: "game", name: "Game", artworkUrl: null }] }} />);
	expect(screen.getByText("12s")).toBeInTheDocument();
	expect(screen.getByText("10")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Select page" }));
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("1 selected");
	fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("0 selected");
});
it("preserves selected IDs across a page request and clears them after filter changes", async () => {
	inventory.mockResolvedValue({ ...data, items: [{ ...item, id: "B" }], total: 26 });
	render(<ClipInventory creatorId='owner' query={{}} data={{ ...data, items: [item], total: 26 }} />);
	fireEvent.click(screen.getByRole("button", { name: "Select page" }));
	fireEvent.click(screen.getByRole("button", { name: "Next page" }));
	await waitFor(() => expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: { page: 2 } }));
	await screen.findByText("26 clips");
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("1 selected");
	const title = screen.getByPlaceholderText("Search clip titles");
	fireEvent.change(title, { target: { value: "Different" } });
	fireEvent.submit(title.closest("form")!);
	await waitFor(() => expect(inventory).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ title: "Different" }) })));
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("0 selected");
	expect(screen.getByText("Selection cleared because the filters changed.")).toBeInTheDocument();
});
it.each(["SERVICE_UNAVAILABLE", "PERMISSION_DENIED"])("shows controlled inventory failure %s and supports retry", async (code) => {
	inventory.mockResolvedValue(data);
	render(<ClipInventory creatorId='owner' query={{ title: "Draft" }} data={{ ok: false, code }} />);
	expect(screen.getByRole("alert")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await screen.findByRole("heading", { name: "No clips found" });
	expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: { title: "Draft" } });
});
it("shows actionable validation errors at the inventory boundary", () => {
	render(<ClipInventory creatorId='owner' query={{}} data={{ ok: false, code: "INVALID_INPUT", fieldErrors: { minViews: ["Choose a positive value"] } }} />);
	expect(screen.getByText("Minimum views: Choose a positive value")).toBeInTheDocument();
});
it.each([
	{ ok: true, accepted: true },
	{ ok: false, code: "SYNC_COOLDOWN", nextAllowedAt: "2026-11-04T00:00:00Z" },
	{ ok: false, code: "RECONNECT_REQUIRED" },
	{ ok: false, code: "SERVICE_UNAVAILABLE" },
])("reports library refresh outcome %#", async (result) => {
	refresh.mockResolvedValue(result);
	inventory.mockResolvedValue(data);
	render(<ClipInventory creatorId='owner' query={{}} data={data} />);
	fireEvent.click(screen.getByRole("button", { name: "Refresh library" }));
	await waitFor(() => expect(refresh).toHaveBeenCalledWith({ creatorId: "owner" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) })));
});
it("retains filter drafts after refresh and reload transport failures", async () => {
	refresh.mockRejectedValue(new Error("offline"));
	inventory.mockRejectedValue(new Error("offline"));
	render(<ClipInventory creatorId='owner' query={{}} data={data} />);
	const title = screen.getByPlaceholderText("Search clip titles");
	fireEvent.change(title, { target: { value: "Keep this filter" } });
	fireEvent.click(screen.getByRole("button", { name: "Refresh library" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "The library could not be refreshed. Please try again." })));
	refresh.mockResolvedValue({ ok: true, accepted: true });
	const reload = screen.getByRole("button", { name: "Refresh library" });
	await waitFor(() => expect(reload).toBeEnabled());
	fireEvent.click(reload);
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Your clips could not be loaded. Please try again." })));
	expect(screen.getByPlaceholderText("Search clip titles")).toHaveValue("Keep this filter");
	await act(async () => {
		fireEvent.submit(title.closest("form")!);
	});
	expect(inventory).toHaveBeenLastCalledWith(expect.objectContaining({ query: expect.objectContaining({ title: "Keep this filter" }) }));
});
it("previews a private clip and closes its player", async () => {
	preview.mockResolvedValue({ playbackUrl: "https://production.assets.clips.twitchcdn.net/A.mp4" });
	render(<ClipInventory creatorId='owner' query={{}} data={{ ...data, items: [item], total: 1 }} />);
	fireEvent.click(screen.getByRole("button", { name: "Preview Clutch" }));
	await waitFor(() => expect(document.querySelector("video")).toHaveAttribute("src", "https://production.assets.clips.twitchcdn.net/A.mp4"));
	expect(preview).toHaveBeenCalledWith({ creatorId: "owner", clipId: "A" });
	fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
	expect(document.querySelector("video")).toBeNull();
});
it("keeps an unavailable preview recoverable without leaving the library", async () => {
	preview.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(null).mockResolvedValueOnce({ playbackUrl: "https://media.test/A.mp4" });
	render(<ClipInventory creatorId='owner' query={{}} data={{ ...data, items: [item], total: 1 }} />);
	fireEvent.click(screen.getByRole("button", { name: "Preview Clutch" }));
	await screen.findByText(/Preview unavailable/);
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
	await screen.findByText(/Preview unavailable/);
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	await waitFor(() => expect(document.querySelector("video")).toHaveAttribute("src", "https://media.test/A.mp4"));
});

it("transports category, sort and numeric field changes through the shared query", async () => {
	inventory.mockResolvedValue(data);
	render(<ClipInventory creatorId='owner' query={{}} data={data} />);
	fireEvent.click(screen.getByRole("button", { name: "Choose Category" }));
	fireEvent.click(screen.getByRole("button", { name: "Choose sort" }));
	fireEvent.click(screen.getAllByRole("button", { name: "Set numeric filter" })[0]);
	fireEvent.submit(screen.getByPlaceholderText("Search clip titles").closest("form")!);
	await waitFor(() => expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: expect.objectContaining({ category: "game", sort: "most_viewed", minViews: 5, page: 1 }) }));
	fireEvent.click(screen.getByRole("button", { name: "Reset Category" }));
	fireEvent.click(screen.getByRole("button", { name: "Reset sort" }));
	fireEvent.click(screen.getAllByRole("button", { name: "Clear numeric filter" })[0]);
	fireEvent.submit(screen.getByPlaceholderText("Search clip titles").closest("form")!);
	await waitFor(() => expect(inventory).toHaveBeenLastCalledWith({ creatorId: "owner", query: expect.objectContaining({ sort: "newest" }) }));
	expect(inventory.mock.calls.at(-1)[0].query).not.toHaveProperty("minViews");
	expect(inventory.mock.calls.at(-1)[0].query).not.toHaveProperty("category");
});
it("uses local midnight boundaries when applying a restored date range", async () => {
	inventory.mockResolvedValue(data);
	render(<ClipInventory creatorId='owner' query={{ startedAt: "2026-10-31T23:00:00.000Z", endedAt: "2026-11-02T23:00:00.000Z", timeZone: "Europe/Berlin" }} data={data} />);
	fireEvent.submit(screen.getByPlaceholderText("Search clip titles").closest("form")!);
	await waitFor(() => expect(inventory).toHaveBeenCalledWith({ creatorId: "owner", query: expect.objectContaining({ startedAt: "2026-10-31T23:00:00.000Z", endedAt: "2026-11-02T23:00:00.000Z" }) }));
});
it("allows individual selection and deselection and caps page selection at fifty", () => {
	const items = Array.from({ length: 51 }, (_, i) => ({ ...item, id: String(i), title: `Clip ${i}`, thumbnailUrl: null }));
	render(<ClipInventory creatorId='owner' query={{}} data={{ ...data, items, total: 51 }} />);
	fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip 0" }));
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("1 selected");
	fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip 0" }));
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("0 selected");
	fireEvent.click(screen.getByRole("button", { name: "Select page" }));
	expect(screen.getByRole("status", { name: "Clip selection" })).toHaveTextContent("50 selected");
	expect(screen.getByRole("checkbox", { name: "Select Clip 50" })).toBeDisabled();
});
it("ignores an old inventory response after a newer navigation completes", async () => {
	let finish: (value: unknown) => void = () => {};
	inventory.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve))).mockResolvedValue({ ...data, total: 3 });
	render(<ClipInventory creatorId='owner' query={{}} data={data} />);
	fireEvent.popState(window);
	window.history.replaceState(null, "", "/dashboard/clips?page=2");
	fireEvent.popState(window);
	await screen.findByText("3 clips");
	finish({ ...data, total: 17 });
	await waitFor(() => expect(screen.queryByText("17 clips")).not.toBeInTheDocument());
});
it("handles malformed saved date bounds without crashing the editor", () => {
	render(<ClipInventory creatorId='owner' query={{ startedAt: "bad", endedAt: "bad" }} data={data} />);
	expect(screen.getByTestId("range")).toHaveTextContent("none");
});
it("links a known VOD association without attributing unassigned clips to a stream", () => {
	render(
		<ClipInventory
			creatorId='owner'
			query={{}}
			data={{
				...data,
				total: 2,
				items: [
					{ ...item, videoId: "123" },
					{ ...item, id: "B", title: "Unassigned clip" },
				],
			}}
		/>,
	);
	for (const link of screen.getAllByRole("link", { name: "View stream" })) expect(link).toHaveAttribute("href", "/dashboard/streams/123");
	expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
});

it("displays clip creation dates in the timezone used by the saved filters", () => {
	render(<ClipInventory creatorId='owner' query={{ timeZone: "Europe/Berlin" }} data={{ ...data, total: 1, items: [item] }} />);
	for (const date of screen.getAllByText(item.createdAt)) expect(date).toHaveAttribute("data-timezone", "Europe/Berlin");
});

it("enables page selection only after the client can handle it", () => {
	const { renderToString } = jest.requireActual("react-dom/server.node");
	const props = { creatorId: "owner", query: {}, data: { ...data, items: [item], total: 1 } };
	const server = document.createElement("div");
	server.innerHTML = renderToString(<ClipInventory {...props} />);
	expect([...server.querySelectorAll("button")].find((button) => button.textContent === "Select page")).toBeDisabled();
	render(<ClipInventory {...props} />);
	expect(screen.getByRole("button", { name: "Select page" })).toBeEnabled();
});

it("keeps operational refresh errors out of the page layout", async () => {
	refresh.mockRejectedValue(new Error("offline"));
	render(<ClipInventory creatorId='owner' query={{}} data={data} />);
	fireEvent.click(screen.getByRole("button", { name: "Refresh library" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("clears visible clip metadata after access is revoked", async () => {
	inventory.mockResolvedValue({ ok: false, code: "PERMISSION_DENIED" });
	render(<ClipInventory creatorId='owner' query={{}} data={{ ...data, items: [item], total: 1 }} />);
	fireEvent.submit(screen.getByPlaceholderText("Search clip titles").closest("form")!);
	await waitFor(() => expect(screen.queryByRole("link", { name: "Clutch" })).not.toBeInTheDocument());
});
