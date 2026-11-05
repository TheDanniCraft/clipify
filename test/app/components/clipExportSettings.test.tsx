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
it("retains choices when queueing fails and offers global layout creation when none exist", async () => {
	list.mockResolvedValue({ ok: true, templates: [], defaults: {} });
	const close = jest.fn();
	render(<ClipExportSettings creatorId='owner' clipIds={["ClipA"]} onStart={() => false} onClose={close} />);
	await screen.findByRole("link", { name: "Create layout template" });
	expect(screen.getByRole("link", { name: "Create layout template" })).toHaveAttribute("target", "_blank");
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(close).not.toHaveBeenCalled();
	expect(screen.getByRole("checkbox", { name: "Original" })).toBeChecked();
});

it("recovers failed lookups, removes stale choices on refresh, and preserves Original as an independent choice", async () => {
	const entry = { id: "desktop", name: "Desk", composition: createClipComposition("desktop") };
	list
		.mockRejectedValueOnce(Error("offline"))
		.mockResolvedValueOnce({ ok: true, templates: [entry], defaults: {} })
		.mockResolvedValueOnce({ ok: true, templates: [], defaults: {} });
	const start = jest.fn(() => true),
		close = jest.fn();
	render(<ClipExportSettings creatorId='owner' clipIds={["A", "B"]} onStart={start} onClose={close} />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry layouts" }));
	fireEvent.click(await screen.findByRole("checkbox", { name: "Desktop" }));
	fireEvent.click(screen.getByRole("checkbox", { name: "Original" }));
	expect(screen.getByRole("status", { name: "Export file count" })).toHaveTextContent("2 video files");
	expect(screen.queryByText("Adjust clip")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Refresh layouts" }));
	await screen.findByText("No layout templates yet. Create one for Desktop and Mobile.");
	expect(screen.getByRole("button", { name: "Start export" })).toBeDisabled();
	fireEvent.click(screen.getByRole("checkbox", { name: "Desktop" }));
	fireEvent.click(screen.getByRole("checkbox", { name: "Original" }));
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(start).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ files: expect.arrayContaining([expect.objectContaining({ clipId: "A" }), expect.objectContaining({ clipId: "B" })]) })]));
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(close).toHaveBeenCalledTimes(2);
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
	render(<ClipExportSettings creatorId='owner' clipIds={["A"]} onStart={() => true} onClose={() => {}} />);
	await screen.findByRole("listbox", { name: "Layout templates" });
	fireEvent.click(screen.getByRole("checkbox", { name: "Desktop" }));
	expect(screen.getByRole("button", { name: "Start export" })).toBeEnabled();
	fireEvent.click(screen.getByRole("button", { name: "Refresh layouts" }));
	await screen.findByRole("option", { name: "Other" });
	expect(screen.getByRole("button", { name: "Start export" })).toBeDisabled();
	expect(screen.getByRole("listbox", { name: "Layout templates" })).toHaveValue([]);
});
