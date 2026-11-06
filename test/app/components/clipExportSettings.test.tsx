const browserCapability = jest.fn();
jest.mock("@lib/clipBrowserRender", () => ({ browserExportCapability: () => browserCapability() }));
beforeEach(() => browserCapability.mockResolvedValue("supported"));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClipExportSettings from "@components/creator/clipExportSettings";
import { createClipComposition } from "@lib/clipComposition";
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../__mocks__/heroui-react.cjs");
	const Checkbox = Object.assign(
		({ children, isSelected, onChange, "aria-label": label }: any) => (
			<div>
				<input type='checkbox' aria-label={label} checked={isSelected} onChange={(event) => onChange(event.target.checked)} />
				{children}
			</div>
		),
		{ Content: base.Checkbox.Content, Control: base.Checkbox.Control, Indicator: base.Checkbox.Indicator },
	);
	return jest.requireActual("../../support/clipCompositionControls").compositionControls(new Proxy({ ...base, Checkbox }, { get: (target: any, key: any) => (key in target ? target[key] : base[key]) }));
});
const list = jest.fn();
jest.mock("@actions/clipLayoutLibrary", () => ({ listClipLayouts: (...args: unknown[]) => list(...args) }));
jest.mock("@components/controlledModal", () => ({ __esModule: true, default: ({ children }: any) => <section role='dialog'>{children}</section> }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
it("selects Original and multiple Desktop/Mobile layouts before starting one export plan", async () => {
	const templates = [
		{ id: "desktop", name: "Main desktop", composition: createClipComposition("desktop"), updatedAt: "2026-11-05T00:00:00Z" },
		{ id: "mobile1", name: "Camera mobile", composition: createClipComposition("mobile"), updatedAt: "2026-11-05T00:00:00Z" },
		{ id: "mobile2", name: "Gameplay mobile", composition: createClipComposition("mobile"), updatedAt: "2026-11-05T00:00:00Z" },
	];
	list.mockResolvedValue({ ok: true, templates, defaults: { desktop: "desktop", mobile: "mobile1" } });
	const start = jest.fn((_plans: any[]) => true),
		close = jest.fn();
	render(<ClipExportSettings creatorId='owner' clipIds={["ClipA"]} onStart={start} onClose={close} />);
	expect(start).not.toHaveBeenCalled();
	expect(screen.getByRole("checkbox", { name: "Original" })).toBeChecked();
	await screen.findByRole("listbox", { name: "Layout templates" });
	fireEvent.click(screen.getByRole("checkbox", { name: "Desktop" }));
	fireEvent.click(screen.getByRole("checkbox", { name: "Mobile" }));
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
	expect(start.mock.calls[0][0][0].files).toHaveLength(3);
	expect(start.mock.calls[0][0][0].outputs.map((output: any) => output.label)).toEqual(["Original", "Main desktop Desktop", "Main desktop Mobile"]);
	expect(close).toHaveBeenCalledTimes(1);
});
it("retains choices when queueing fails without mixing layout management into export", async () => {
	list.mockResolvedValue({ ok: true, templates: [], defaults: {} });
	const close = jest.fn();
	render(<ClipExportSettings creatorId='owner' clipIds={["ClipA"]} onStart={() => false} onClose={close} />);
	await screen.findByText(/No layout templates yet/);
	expect(screen.queryByRole("link")).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: /layouts/i })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(close).not.toHaveBeenCalled();
	expect(screen.getByRole("checkbox", { name: "Original" })).toBeChecked();
});

it("keeps Original export available after a failed template lookup", async () => {
	list.mockRejectedValueOnce(Error("offline"));
	const start = jest.fn(() => true);
	render(<ClipExportSettings creatorId='owner' clipIds={["A", "B"]} onStart={start} onClose={() => {}} />);
	await screen.findByText(/Layouts could not be loaded/);
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(start).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ files: expect.arrayContaining([expect.objectContaining({ clipId: "A" }), expect.objectContaining({ clipId: "B" })]) })]), "browser");
});
it.each([Error("Select at most 500 clips."), Error("unexpected"), "unexpected"])("reports queue failures without closing or discarding selection: %s", async (error) => {
	list.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });
	const close = jest.fn();
	render(
		<ClipExportSettings
			creatorId='owner'
			clipIds={["A"]}
			onStart={() => {
				throw error;
			}}
			onClose={close}
		/>,
	);
	await screen.findByText(/Layouts could not be loaded/);
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Export could not be queued", color: "danger" }));
	expect(close).not.toHaveBeenCalled();
	expect(screen.getByRole("checkbox", { name: "Original" })).toBeChecked();
});
it("ignores a lookup resolving after unmount", async () => {
	let resolve: any;
	list.mockReturnValue(new Promise((r) => (resolve = r)));
	const view = render(<ClipExportSettings creatorId='owner' clipIds={[]} onStart={() => true} onClose={() => {}} />);
	view.unmount();
	await import("@testing-library/react").then(({ act }) => act(async () => resolve({ ok: true, templates: [], defaults: {} })));
});
it("never substitutes a different template after the selected collection is deleted", async () => {
	const template = (id: string) => ({ id, name: id, composition: createClipComposition("desktop") });
	list.mockResolvedValueOnce({ ok: true, templates: [template("Chosen")], defaults: {} }).mockResolvedValueOnce({ ok: true, templates: [template("Other")], defaults: {} });
	const view = render(<ClipExportSettings creatorId='owner' clipIds={["A"]} onStart={() => true} onClose={() => {}} />);
	await screen.findByRole("listbox", { name: "Layout templates" });
	fireEvent.click(screen.getByRole("checkbox", { name: "Desktop" }));
	expect(screen.getByRole("button", { name: "Start export" })).toBeEnabled();
	view.rerender(<ClipExportSettings creatorId='other-owner' clipIds={["A"]} onStart={() => true} onClose={() => {}} />);
	await screen.findByRole("option", { name: "Other" });
	expect(screen.getByRole("button", { name: "Start export" })).toBeDisabled();
	expect(screen.getByRole("listbox", { name: "Layout templates" })).toHaveValue([]);
});
it("exports both formats of an eighty-character template name without changing the stored name", async () => {
	const name = "x".repeat(80);
	list.mockResolvedValue({ ok: true, templates: [{ id: "long", name, composition: createClipComposition("desktop") }], defaults: {} });
	const start = jest.fn(() => true);
	render(<ClipExportSettings creatorId='owner' clipIds={["A"]} onStart={start} onClose={() => {}} />);
	await screen.findByRole("listbox", { name: "Layout templates" });
	for (const version of ["Desktop", "Mobile"]) fireEvent.click(screen.getByRole("checkbox", { name: version }));
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(start).toHaveBeenCalledTimes(1);
	const outputs = (start.mock.calls[0] as any)[0][0].outputs;
	for (const output of outputs.filter((o: any) => o.templateId)) {
		expect(output.templateId).toBe("long");
		expect(output.label.length).toBeLessThanOrEqual(80);
		expect(output.label).toMatch(/ (Desktop|Mobile)$/);
	}
	expect(screen.getByRole("option", { name })).toBeInTheDocument();
});

it("warns about a slow device without silently switching to server processing", async () => {
	browserCapability.mockResolvedValueOnce("slow");
	list.mockResolvedValue({ ok: true, templates: [{ id: "paired", name: "Paired", composition: createClipComposition("mobile"), updatedAt: "2026-11-05T00:00:00Z" }], defaults: { mobile: "paired" } });
	const start = jest.fn(() => true);
	render(<ClipExportSettings creatorId='owner' clipIds={["A"]} onStart={start} onClose={() => {}} />);
	await screen.findByRole("listbox", { name: "Layout templates" });
	fireEvent.click(screen.getByRole("checkbox", { name: "Mobile" }));
	await screen.findByText("This device may be slow. You can continue here or select server processing.");
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(start).toHaveBeenCalledWith(expect.any(Array), "browser");
});

it("queues a chosen custom encoding preset while preserving Original and paired layout versions", async () => {
	list.mockResolvedValue({ ok: true, templates: [{ id: "main", name: "Main", composition: createClipComposition("desktop"), updatedAt: "2026-11-05" }], defaults: { desktop: "main" } });
	const start = jest.fn((_plans: any[]) => true);
	render(<ClipExportSettings creatorId='owner' clipIds={["ClipA"]} onStart={start} onClose={() => {}} />);
	await screen.findByRole("listbox", { name: "Layout templates" });
	expect(screen.queryByRole("combobox", { name: "Export for" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("checkbox", { name: "Desktop" }));
	fireEvent.change(screen.getByRole("combobox", { name: "Export for" }), { target: { value: "custom" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum size (MB)" }), { target: { value: "10" } });
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
	expect(start.mock.calls[0][0][0].preset).toEqual({ id: "custom", maxSizeMB: 10 });
	expect(start.mock.calls[0][0][0].outputs[0]).toEqual({ key: "original", label: "Original" });
});
