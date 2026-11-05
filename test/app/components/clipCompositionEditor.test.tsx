jest.mock("@heroui/react", () => jest.requireActual("../../support/clipCompositionControls").compositionControls(jest.requireActual("../../__mocks__/heroui-react.cjs")));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClipCompositionEditor from "@components/creator/clipCompositionEditor";
import { createClipComposition } from "@lib/clipComposition";
const saveTemplate = jest.fn(),
	saveOverride = jest.fn(),
	reset = jest.fn();
jest.mock("@actions/clipLayoutLibrary", () => ({ saveClipLayoutTemplate: (...args: unknown[]) => saveTemplate(...args), saveClipLayoutOverride: (...args: unknown[]) => saveOverride(...args), resetClipLayoutOverride: (...args: unknown[]) => reset(...args) }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipInventory: async () => ({ ok: true, items: [] }), getCreatorClipDetail: async () => ({ ok: false, code: "NOT_FOUND" }), searchCreatorLibrary: async () => ({ ok: true, items: [] }) }));
jest.mock("@components/creator/clipCompositionCanvas", () => ({ __esModule: true, default: () => null }));
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: () => ({ active: false }) }));
jest.mock("@components/controlledModal", () => ({ __esModule: true, default: ({ children, isOpen }: any) => (isOpen ? <section role='dialog'>{children}</section> : null) }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
const composition = createClipComposition("mobile"),
	entry = { id: "template", name: "Camera", composition, updatedAt: "2026-11-05T00:00:00Z" };
beforeEach(() => {
	jest.clearAllMocks();
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
