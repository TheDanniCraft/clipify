jest.mock("@components/upgradeModal", () => ({ __esModule: true, default: ({ isOpen }: any) => (isOpen ? <div role='dialog'>Upgrade branding</div> : null) }));
jest.mock("@components/theme/ThemeColorInput", () => ({
	__esModule: true,
	default: ({ label, value, onChange }: any) => (
		<label>
			{label}
			<input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
		</label>
	),
}));
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
jest.mock("@components/creator/clipCompositionCanvas", () => ({
	__esModule: true,
	default: ({ onSelect, selected }: any) => (
		<div>
			<button onClick={() => onSelect(selected, "source")}>Select source crop</button>
			<button onClick={() => onSelect(selected, "output")}>Select output layer</button>
		</div>
	),
}));
const navigationGuard = { active: false, accept: jest.fn(), reject: jest.fn() };
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: ({ enabled }: any) => ({ ...navigationGuard, active: enabled && navigationGuard.active }) }));
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ children, isOpen, onClose }: any) =>
		isOpen ? (
			<section role='dialog'>
				<button aria-label='Close layout dialog' onClick={onClose}>
					Close
				</button>
				{children}
			</section>
		) : null,
}));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
const composition = createClipComposition("mobile"),
	entry = { id: "template", name: "Camera", composition, updatedAt: "2026-11-05T00:00:00Z" };
beforeEach(() => {
	jest.clearAllMocks();
	for (const mock of [saveTemplate, saveOverride, reset, inventory, detail, searchClips]) mock.mockReset();
	navigationGuard.active = false;
	inventory.mockResolvedValue({ ok: true, items: [] });
	detail.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
	searchClips.mockResolvedValue({ ok: true, items: [] });
	saveTemplate.mockResolvedValue({ ok: true, id: "template" });
	saveOverride.mockResolvedValue({ ok: true });
});
it("saves clip adjustments through the override action without touching the reusable template", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} clipId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Bring Camera forward" }));
	fireEvent.click(screen.getByRole("button", { name: "Save clip adjustments" }));
	await waitFor(() => expect(saveOverride).toHaveBeenCalledWith("owner", "template", "ClipA", expect.any(Object)));
	expect(saveTemplate).not.toHaveBeenCalled();
	expect(composition.layers.map((layer) => layer.id)).toEqual(["camera", "gameplay"]);
});
it("retains a global layout draft after save failure and allows a successful retry", async () => {
	saveTemplate.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Bring Camera forward" }));
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
	detail.mockResolvedValue({ ok: true, clip: { id: "Ref", title: "Reference" } });
	render(<ClipCompositionEditor referenceId='Ref' creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "My mobile" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "video" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Killfeed" } });
	fireEvent.click(await screen.findByRole("button", { name: "Select source crop" }));
	fireEvent.change(screen.getByRole("spinbutton", { name: "Height (%)" }), { target: { value: "2" } });
	for (const kind of ["title", "channel"]) fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: kind } });
	fireEvent.click(screen.getAllByRole("button", { name: /^Send .* backward$/ })[0]);
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	const saved = saveTemplate.mock.calls[0][1];
	expect(saved.name).toBe("My mobile");
	expect(saved.composition.layers.filter((layer: any) => layer.kind === "video")).toHaveLength(3);
	expect(saved.composition.layers.find((layer: any) => layer.label === "Killfeed").source.h).toBe(0.02);
	expect(saved.composition.layers.map((layer: any) => layer.kind)).toEqual(expect.arrayContaining(["title", "channel"]));
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
	detail.mockResolvedValue({ ok: true, clip: { id: "Ref", title: "Reference" } });
	render(<ClipCompositionEditor referenceId='Ref' creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={saved} />);
	for (const shape of ["portrait", "landscape", "square"]) fireEvent.change(screen.getByRole("combobox", { name: "Output shape" }), { target: { value: shape } });
	for (const label of ["Left (%)", "Top (%)", "Width (%)", "Height (%)"]) fireEvent.change(screen.getByRole("spinbutton", { name: label }), { target: { value: "20" } });
	fireEvent.click(await screen.findByRole("button", { name: "Select source crop" }));
	for (const label of ["Left (%)", "Top (%)", "Width (%)", "Height (%)"]) fireEvent.change(screen.getByRole("spinbutton", { name: label }), { target: { value: "10" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "title" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Text size" }), { target: { value: "48" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Height (%)" }), { target: { value: "8" } });
	fireEvent.click(screen.getAllByRole("button", { name: /^Send .* backward$/ })[0]);

	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saved).toHaveBeenCalled());
	const layers = saveTemplate.mock.calls[0][1].composition.layers;
	expect(layers.find((l: any) => l.kind === "title")).toMatchObject({ fontSize: 48, frame: { h: 0.08 } });
	expect(composition.layers).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Remove Clip info" }));
	expect(screen.queryByRole("button", { name: "Clip info" })).not.toBeInTheDocument();
});
it("recovers reference lookup/search failures without discarding an edited name", async () => {
	inventory.mockResolvedValueOnce({ ok: false });
	searchClips.mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce({ ok: true, items: [{ id: "ClipB", title: "" }] });
	detail.mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce({ ok: true, clip: { id: "ClipA", title: "Reference" } });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} referenceId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "Draft" } });
	fireEvent.click(await screen.findByRole("button", { name: "Retry reference" }));
	await waitFor(() => expect(detail).toHaveBeenCalledTimes(2));
	const query = screen.getByRole("textbox", { name: "Find a reference clip" });
	fireEvent.change(query, { target: { value: "first" } });
	await waitFor(() => expect(searchClips).toHaveBeenCalledTimes(1));
	fireEvent.change(query, { target: { value: "second" } });
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
it("does not show the selected reference as a false match for an unrelated search", async () => {
	detail.mockResolvedValue({ ok: true, clip: { id: "ClipA", title: "Current clip" } });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} referenceId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	await screen.findByRole("option", { name: "Current clip" });
	fireEvent.change(screen.getByRole("textbox", { name: "Find a reference clip" }), { target: { value: "missing clip" } });
	await waitFor(() => expect(searchClips).toHaveBeenCalled());
	expect(screen.getByRole("combobox", { name: "Reference clip" }).querySelector('option[value="ClipA"]')).not.toBeInTheDocument();
});
it("keeps unsaved fields intact when rejecting navigation and only discards after explicit acceptance", () => {
	navigationGuard.active = true;
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "My unsaved crop" } });
	fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
	expect(navigationGuard.reject).toHaveBeenCalledTimes(1);
	expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("My unsaved crop");
	fireEvent.click(screen.getByRole("button", { name: "Close layout dialog" }));
	expect(navigationGuard.reject).toHaveBeenCalledTimes(2);
	fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
	expect(navigationGuard.accept).toHaveBeenCalledTimes(1);
	expect(saveTemplate).not.toHaveBeenCalled();
});
it("closing the reset dialog does not reset a clip override", () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} clipId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Reset to template" }));
	fireEvent.click(screen.getByRole("button", { name: "Close layout dialog" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(reset).not.toHaveBeenCalled();
});
it("does not duplicate a selected reference already present in the initial inventory", async () => {
	const clip = { id: "ClipA", title: "Current clip" };
	inventory.mockResolvedValue({ ok: true, items: [clip] });
	detail.mockResolvedValue({ ok: true, clip });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} referenceId='ClipA' onBack={() => {}} onSaved={() => {}} />);
	await screen.findByRole("option", { name: "Current clip" });
	expect(screen.getAllByRole("option", { name: "Current clip" })).toHaveLength(1);
});

it.each(["desktop", "mobile"] as const)("adds a usable channel block without a camera in %s and shares reference selection", async (format) => {
	const layout = createClipComposition(format);
	layout.layers = layout.layers.filter((layer) => layer.id !== "camera");
	const clip = { id: "ClipA", title: "Reference" };
	inventory.mockResolvedValue({ ok: true, items: [clip] });
	detail.mockResolvedValue({ ok: true, clip });
	const selected = jest.fn();
	render(<ClipCompositionEditor creatorId='owner' entry={{ ...entry, composition: layout }} initial={layout} onReferenceChange={selected} onBack={() => {}} onSaved={() => {}} />);
	await screen.findByRole("option", { name: "Reference" });
	fireEvent.change(screen.getByRole("combobox", { name: "Reference clip" }), { target: { value: "ClipA" } });
	expect(selected).toHaveBeenCalledWith("ClipA");
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "channel" } });
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	const badge = saveTemplate.mock.calls[0][1].composition.layers.find((layer: any) => layer.kind === "channel");
	expect(badge.frame.w).toBeGreaterThanOrEqual(0.5);
	expect(badge.frame.y + badge.frame.h).toBeLessThanOrEqual(1);
});

it("uses the existing theme controls and preserves appearance through save", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "title" } });
	fireEvent.click(screen.getByRole("switch", { name: "Use brand styling" }));
	fireEvent.change(screen.getByRole("textbox", { name: "Background Color" }), { target: { value: "rgba(20,30,40,0.5)" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Corner radius (px)" }), { target: { value: "18" } });

	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	expect(saveTemplate.mock.calls[0][1].composition.layers.at(-1).appearance).toMatchObject({ themeBackgroundColor: "rgba(20,30,40,0.5)", borderRadius: 18 });
});

it.each(["title", "channel", "clipper"] as const)("fits a saved %s widget without losing its metadata or draft", async (kind) => {
	const layout = { version: 2 as const, format: "mobile" as const, layers: [{ id: "saved", kind, label: "Saved widget", fontSize: 32, frame: { x: 0.05, y: 0.05, w: 0.5, h: 0.2 } }] };
	const clip = { id: "ClipA", title: "Known title", clipCreatorName: "Viewer" };
	detail.mockResolvedValue({ ok: true, clip });
	render(<ClipCompositionEditor creatorId='owner' entry={{ ...entry, composition: layout }} initial={layout} referenceId={kind === "title" ? "ClipA" : undefined} onBack={() => {}} onSaved={() => {}} />);
	if (kind === "title") await screen.findByRole("option", { name: "Known title" });
	fireEvent.click(screen.getByRole("button", { name: "Fit canvas width" }));
	fireEvent.click(screen.getByRole("button", { name: "Fit content" }));
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "title" } });
	fireEvent.click(screen.getByRole("switch", { name: "Use brand styling" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	const saved = saveTemplate.mock.calls[0][1].composition.layers[0];
	expect(saved).toMatchObject({ id: "saved", kind, frame: { x: 0 } });
	expect(saved.frame.w).toBeLessThan(1);
	expect(saved.frame.h).toBeLessThan(0.2);
});
it("keeps a saved standalone logo editable without treating it as text", async () => {
	const layout = { version: 2 as const, format: "desktop" as const, layers: [{ id: "logo", kind: "logo" as const, label: "Saved logo", frame: { x: 0, y: 0, w: 0.2, h: 0.2 } }] };
	render(<ClipCompositionEditor creatorId='owner' entry={{ ...entry, composition: layout }} initial={layout} onBack={() => {}} onSaved={() => {}} />);
	expect(screen.queryByRole("button", { name: "Fit content" })).not.toBeInTheDocument();
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "My logo" } });
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	expect(saveTemplate.mock.calls[0][1].composition.layers[0]).toMatchObject({ kind: "logo", label: "My logo" });
});

it.each(["unavailable", "offline"])("keeps a styled layout draft after reference inventory is %s", async (state) => {
	if (state === "offline") inventory.mockRejectedValueOnce(Error("offline"));
	else inventory.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "Preserved draft" } });
	await waitFor(() => expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Reference clips could not be loaded" })));
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "title" } });
	fireEvent.click(screen.getByRole("switch", { name: "Use brand styling" }));
	fireEvent.change(screen.getByRole("textbox", { name: "Text Color" }), { target: { value: "#111111" } });

	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	expect(saveTemplate.mock.calls[0][1].name).toBe("Preserved draft");
	expect(saveTemplate.mock.calls[0][1].composition.layers.at(-1).appearance.themeTextColor).toBe("#111111");
});

it("routes shared brand changes to settings once the creator has adopted a global brand", async () => {
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} brand={creatorBrandSchema.parse({})} />);
	expect(screen.queryByRole("button", { name: "Widget appearance" })).not.toBeInTheDocument();
	expect(screen.queryByRole("link", { name: "Brand styling" })).not.toBeInTheDocument();
});

it("resets only a widget override to its brand without changing the account style", async () => {
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	const brand = creatorBrandSchema.parse({ borderRadius: 30 });
	const layout = { version: 2 as const, format: "mobile" as const, layers: [{ id: "info", kind: "title" as const, label: "Info", fontSize: 32, frame: { x: 0, y: 0, w: 1, h: 0.1 }, appearance: { borderRadius: 4 } }] };
	render(<ClipCompositionEditor creatorId='owner' entry={{ ...entry, composition: layout }} initial={layout} brand={brand} onBack={() => {}} onSaved={() => {}} />);
	expect(screen.getByRole("spinbutton", { name: "Corner radius (px)" })).toHaveValue(4);
	fireEvent.click(screen.getByRole("switch", { name: "Use brand styling" }));
	expect(screen.queryByRole("spinbutton", { name: "Corner radius (px)" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	expect(saveTemplate.mock.calls[0][1].composition.layers[0].appearance).toBeUndefined();
	expect(brand.borderRadius).toBe(30);
});

it("stores branding per layout and lets Pro keep credits on one composition", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} canRemoveWatermark onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(screen.getByRole("button", { name: "Remove Clipify Watermark" }));
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalledWith("owner", expect.objectContaining({ composition: expect.objectContaining({ watermark: false }) })));
	expect(composition.watermark).toBeUndefined();
	expect(screen.queryByRole("link", { name: "Brand styling" })).not.toBeInTheDocument();
});
it("keeps free layout credits on and opens upgrade without saving an unavailable value", () => {
	render(<ClipCompositionEditor creatorId='owner' user={{ id: "owner" } as never} entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	const toggle = screen.getByRole("button", { name: "Remove Clipify Watermark" });
	fireEvent.click(toggle);
	expect(screen.getByRole("button", { name: "Clipify Watermark" })).toBeVisible();
	expect(screen.getByRole("dialog")).toHaveTextContent("Upgrade branding");
	expect(saveTemplate).not.toHaveBeenCalled();
});

it("reorders layers by dragging and lets the selected row dismiss the inspector", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	const data = { types: ["application/x-clipify-layer"], setData: jest.fn(), getData: () => "gameplay", effectAllowed: "" };
	fireEvent.drop(screen.getByRole("button", { name: "Camera" }).parentElement!, { dataTransfer: data });
	fireEvent.click(screen.getByRole("button", { name: "Gameplay" }));
	expect(screen.queryByRole("textbox", { name: "Layer name" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	expect(saveTemplate.mock.calls[0][1].composition.layers.map((layer: any) => layer.id)).toEqual(["gameplay", "camera"]);
});

it("targets numeric controls from the clicked canvas and deselects with Escape or an outside click", async () => {
	detail.mockResolvedValue({ ok: true, clip: { id: "Ref", title: "Reference" } });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} referenceId='Ref' onBack={() => {}} onSaved={() => {}} />);
	fireEvent.click(await screen.findByRole("button", { name: "Select source crop" }));
	const sourceLeft = (screen.getByRole("spinbutton", { name: "Left (%)" }) as HTMLInputElement).value;
	expect(screen.queryByRole("heading", { name: "Source crop" })).not.toBeInTheDocument();
	expect(screen.queryByRole("combobox", { name: "Edit box" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Select output layer" }));
	expect(screen.getByRole("spinbutton", { name: "Left (%)" })).not.toHaveValue(Number(sourceLeft));
	fireEvent.keyDown(window, { key: "Escape" });
	expect(screen.queryByRole("textbox", { name: "Layer name" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Camera" }));
	fireEvent.pointerDown(document.body);
	expect(screen.queryByRole("textbox", { name: "Layer name" })).not.toBeInTheDocument();
});

it("keeps the inspector stable when choosing a portaled menu option", () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	const menu = document.createElement("div");
	menu.setAttribute("role", "listbox");
	const option = document.createElement("div");
	option.setAttribute("role", "option");
	menu.append(option);
	document.body.append(menu);
	try {
		fireEvent.pointerDown(option);
		expect(screen.getByRole("textbox", { name: "Layer name" })).toBeVisible();
	} finally {
		menu.remove();
	}
});

it("restores the fixed branding layer without adding editable geometry to the template", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={{ ...composition, watermark: false }} canRemoveWatermark onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("combobox", { name: "Add layer" }), { target: { value: "watermark" } });
	expect(screen.getByRole("region", { name: "Branding layer" })).toHaveTextContent("8 seconds");
	expect(screen.queryByRole("textbox", { name: "Layer name" })).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Bring Clipify Watermark forward" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalled());
	expect(saveTemplate.mock.calls[0][1].composition).toMatchObject({ watermark: true, layers: composition.layers });
});

it.each([false, true])("keeps branding restorable at the video-layer limit when enabled=%s", (watermark) => {
	const layers = Array.from({ length: 32 }, (_, index) => ({ ...composition.layers[0], id: `crop-${index}`, label: `Crop ${index}` }));
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={{ ...composition, layers, watermark }} canRemoveWatermark onBack={() => {}} onSaved={() => {}} />);
	const add = screen.getByRole("combobox", { name: "Add layer" });
	expect(screen.queryByRole("option", { name: "video" })).not.toBeInTheDocument();
	if (watermark) expect(add).toBeDisabled();
	else {
		expect(add).toBeEnabled();
		fireEvent.change(add, { target: { value: "watermark" } });
		expect(screen.getByRole("button", { name: "Clipify Watermark" })).toBeVisible();
		expect(add).toBeDisabled();
	}
});

it("deselects branding before removing it and restores the ordinary empty inspector", () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} canRemoveWatermark onBack={() => {}} onSaved={() => {}} />);
	const branding = screen.getByRole("button", { name: "Clipify Watermark" });
	fireEvent.click(branding);
	expect(screen.getByRole("region", { name: "Branding layer" })).toBeVisible();
	fireEvent.click(branding);
	expect(screen.queryByRole("region", { name: "Branding layer" })).not.toBeInTheDocument();
	fireEvent.click(branding);
	fireEvent.click(screen.getByRole("button", { name: "Remove Clipify Watermark" }));
	expect(screen.queryByRole("button", { name: "Clipify Watermark" })).not.toBeInTheDocument();
	expect(screen.queryByRole("region", { name: "Branding layer" })).not.toBeInTheDocument();
	expect(screen.queryByRole("textbox", { name: "Layer name" })).not.toBeInTheDocument();
});

it("shows loading instead of unavailable while a saved reference is being resolved", async () => {
	let resolve!: (value: unknown) => void;
	detail.mockReturnValue(
		new Promise((done) => {
			resolve = done;
		}),
	);
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} referenceId='Slow' onBack={() => {}} onSaved={() => {}} />);
	expect(screen.getByRole("status")).toHaveTextContent("Loading reference clip");
	expect(screen.queryByRole("button", { name: "Retry reference" })).not.toBeInTheDocument();
	resolve({ ok: false, code: "NOT_FOUND" });
	await screen.findByRole("button", { name: "Retry reference" });
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("previews a search result immediately without a duplicate detail lookup", async () => {
	searchClips.mockResolvedValue({ ok: true, items: [{ id: "Found", title: "Found moment" }] });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Find a reference clip" }), { target: { value: "Found" } });
	await screen.findByRole("option", { name: "Found moment" });
	fireEvent.change(screen.getByRole("combobox", { name: "Reference clip" }), { target: { value: "Found" } });
	expect(screen.getByRole("button", { name: "Select source crop" })).toBeVisible();
	expect(screen.queryByText("Reference clip unavailable.")).not.toBeInTheDocument();
	expect(detail).not.toHaveBeenCalled();
});

it("switches unsaved formats locally and saves both edited compositions with one action", async () => {
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={() => {}} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Mobile camera draft" } });
	fireEvent.click(screen.getByRole("tab", { name: "Desktop 16:9" }));
	expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Gameplay");
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Desktop game draft" } });
	fireEvent.click(screen.getByRole("tab", { name: "Mobile 9:16" }));
	expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Mobile camera draft");
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(saveTemplate).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalledTimes(2));
	const saved = saveTemplate.mock.calls.map((call: any) => call[1].composition);
	expect(saved).toEqual(expect.arrayContaining([expect.objectContaining({ format: "mobile", layers: expect.arrayContaining([expect.objectContaining({ label: "Mobile camera draft" })]) }), expect.objectContaining({ format: "desktop", layers: expect.arrayContaining([expect.objectContaining({ label: "Desktop game draft" })]) })]));
});

it("retains both drafts if one format fails to save and retries without losing either", async () => {
	const saved = jest.fn();
	saveTemplate.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={saved} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Mobile draft" } });
	fireEvent.click(screen.getByRole("tab", { name: "Desktop 16:9" }));
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Desktop draft" } });
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saveTemplate).toHaveBeenCalledTimes(2));
	await waitFor(() => expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Layout could not be saved" })));
	expect(saved).not.toHaveBeenCalled();
	expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Desktop draft");
	fireEvent.click(screen.getByRole("tab", { name: "Mobile 9:16" }));
	expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Mobile draft");
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
	expect(saveTemplate).toHaveBeenCalledTimes(4);
});

it("keeps edits made while saving protected instead of marking them saved", async () => {
	let finish!: (value: unknown) => void;
	saveTemplate.mockReturnValueOnce(
		new Promise((done) => {
			finish = done;
		}),
	);
	const saved = jest.fn();
	render(<ClipCompositionEditor creatorId='owner' entry={entry} initial={composition} onBack={() => {}} onSaved={saved} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "Sent draft" } });
	fireEvent.click(screen.getByRole("button", { name: "Save layout" }));
	fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), { target: { value: "New draft" } });
	finish({ ok: true });
	await waitFor(() => expect(saved).toHaveBeenCalled());
	expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("New draft");
	expect(screen.getByRole("button", { name: "Save layout" })).toBeEnabled();
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
});
