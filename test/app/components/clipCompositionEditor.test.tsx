jest.mock("@heroui/react", () => jest.requireActual("../../support/clipCompositionControls").compositionControls(jest.requireActual("../../__mocks__/heroui-react.cjs")));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClipCompositionEditor from "@components/creator/clipCompositionEditor";
import { createClipComposition } from "@lib/clipComposition";
const saveTemplate = jest.fn(),
	saveOverride = jest.fn(),
	reset = jest.fn(),
	inventory = jest.fn(),
	detail = jest.fn(),
	searchClips = jest.fn();
jest.mock("@actions/clipLayoutLibrary", () => ({ saveClipLayoutTemplate: (...args: unknown[]) => saveTemplate(...args), saveClipLayoutOverride: (...args: unknown[]) => saveOverride(...args), resetClipLayoutOverride: (...args: unknown[]) => reset(...args) }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipInventory: (...a: unknown[]) => inventory(...a), getCreatorClipDetail: (...a: unknown[]) => detail(...a), searchCreatorLibrary: (...a: unknown[]) => searchClips(...a) }));
jest.mock("@components/creator/clipCompositionCanvas", () => ({ __esModule: true, default: () => null }));
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: () => ({ active: false }) }));
jest.mock("@components/controlledModal", () => ({ __esModule: true, default: ({ children, isOpen }: any) => (isOpen ? <section role='dialog'>{children}</section> : null) }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
const composition = createClipComposition("mobile"),
	entry = { id: "template", name: "Camera", composition, updatedAt: "2026-11-05T00:00:00Z" };
beforeEach(() => {
	jest.clearAllMocks();
	inventory.mockResolvedValue({ ok: true, items: [] });
	detail.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
	searchClips.mockResolvedValue({ ok: true, items: [] });
	saveTemplate.mockResolvedValue({ ok: true, id: "template" });
	saveOverride.mockResolvedValue({ ok: true });
});
it("saves clip adjustments through the override action without touching the reusable template", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} clipId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Bring forward" }));
	fireEvent.click(screen.getByRole("button", { name: "Save clip adjustments" }));
	await waitFor(() => expect(saveOverride).toHaveBeenCalledWith("owner", "template", "ClipA", expect.any(Object)));
	expect(saveTemplate).not.toHaveBeenCalled();
	expect(composition.layers.map((layer) => layer.id)).toEqual(["camera", "gameplay"]);
});
it("retains a global layout draft after save failure and allows a successful retry", async () => {
	saveTemplate.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Bring forward" }));
	const button = screen.getByRole("button", { name: "Save layout" });
	fireEvent.click(button);
	await waitFor(() => expect(saveTemplate).toHaveBeenCalledTimes(1));
	await waitFor(() => expect(button).not.toBeDisabled());
	fireEvent.click(button);
	await waitFor(() => expect(saveTemplate).toHaveBeenCalledTimes(2));
	expect(saveTemplate.mock.calls[1][1]).toEqual(saveTemplate.mock.calls[0][1]);
	expect(saveTemplate.mock.calls[1][1].composition.layers.map((layer: any) => layer.id)).toEqual(["gameplay", "camera"]);
	expect(saveOverride).not.toHaveBeenCalled();
});
it("adds arbitrary crops and widgets, edits source bounds and retains widget ordering in a named template", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "My mobile" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "video" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Killfeed" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Edit box" }), { target: { value: "source" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Height (%)" }), { target: { value: "2" } });
	for (const kind of ["title", "channel", "clipper", "logo"]) fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: kind } });
	fireEvent.click(screen.getByRole("button", { name: "Send backward" }));
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	const saved = saveTemplate.mock.calls[0][1];
	expect(saved.name).toBe("My mobile");
	expect(saved.composition.layers.filter((layer: any) => layer.kind === "video")).toHaveLength(3);
	expect(saved.composition.layers.find((layer: any) => layer.label === "Killfeed").source.h).toBe(0.02);
	expect(saved.composition.layers.map((layer: any) => layer.kind)).toEqual(expect.arrayContaining(["title", "channel", "clipper", "logo"]));
});
it("resets only a clip override and preserves the draft if reset fails", async () => {
	reset.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} clipId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Reset to template" }));
	fireEvent.click(screen.getByRole("button", { name: "Reset adjustments" }));
	await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
	expect(screen.getByRole("dialog")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Reset adjustments" }));
	await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
	expect(saveTemplate).not.toHaveBeenCalled();
});
it("edits source and output geometry, presets, widgets and stacking without changing the saved template", async () => {
	const saved = jest.fn();
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={saved} />);
	for (const shape of ["portrait", "landscape", "square"]) fireEvent.change(screen.getByRole("combobox", { name: "Source crop shape" }), { target: { value: shape } });
	for (const label of ["Left (%)", "Top (%)", "Width (%)", "Height (%)"]) fireEvent.change(screen.getByRole("spinbutton", { name: label }), { target: { value: "20" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Edit box" }), { target: { value: "source" } });
	for (const label of ["Left (%)", "Top (%)", "Width (%)", "Height (%)"]) fireEvent.change(screen.getByRole("spinbutton", { name: label }), { target: { value: "10" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "title" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Text size" }), { target: { value: "48" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Height (%)" }), { target: { value: "8" } });
	fireEvent.click(screen.getByRole("button", { name: "Send backward" }));
	fireEvent.click(screen.getByRole("button", { name: "Clip title" }));
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saved).toHaveBeenCalled());
	const layers = saveTemplate.mock.calls[0][1].composition.layers;
	expect(layers.find((l: any) => l.kind === "title")).toMatchObject({ fontSize: 48, frame: { h: 0.08 } });
	expect(composition.layers).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Remove layer" }));
	expect(screen.queryByRole("button", { name: "Clip title" })).not.toBeInTheDocument();
});
it("recovers reference lookup/search failures without discarding an edited name", async () => {
	inventory.mockResolvedValueOnce({ ok: false });
	searchClips.mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce({ ok: true, items: [{ id: "ClipB", title: "" }] });
	detail.mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce({ ok: true, clip: { id: "ClipA", title: "Reference" } });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} referenceId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "Draft" } });
	fireEvent.click(screen.getByRole("button", { name: "Retry reference" }));
	await waitFor(() => expect(detail).toHaveBeenCalledTimes(2));
	const query = screen.getByRole("textbox", { name: "Find a reference clip" });
	fireEvent.change(query, { target: { value: "first" } });
	fireEvent.click(screen.getByRole("button", { name: "Search clips" }));
	await waitFor(() => expect(searchClips).toHaveBeenCalledTimes(1));
	fireEvent.change(query, { target: { value: "second" } });
	fireEvent.click(screen.getByRole("button", { name: "Search clips" }));
	await waitFor(() => expect(screen.getByRole("combobox", { name: "Reference clip" }).querySelector('option[value="ClipB"]')).toBeInTheDocument());
	fireEvent.change(screen.getByRole("combobox", { name: "Reference clip" }), { target: { value: "ClipB" } });
	expect(screen.getByRole("textbox", { name: "Layout name" })).toHaveValue("Draft");
});
it.each(["INVALID_INPUT", "throw"])("keeps drafts after save error %s", async (code) => {
	if (code === "throw") saveTemplate.mockRejectedValueOnce(Error("offline"));
	else saveTemplate.mockResolvedValueOnce({ ok: false, code });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "Draft" } });
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Layout could not be saved" })));
	expect(screen.getByRole("textbox", { name: "Layout name" })).toHaveValue("Draft");
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
});
it("can cancel a reset without touching the override", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} clipId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Reset to template" }));
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(reset).not.toHaveBeenCalled();
});
