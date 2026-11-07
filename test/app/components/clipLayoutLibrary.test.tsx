jest.mock("@heroui/react", () => jest.requireActual("../../support/clipCompositionControls").compositionControls(jest.requireActual("../../__mocks__/heroui-react.cjs")));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Library from "@components/creator/clipLayoutLibrary";
import { createClipComposition } from "@lib/clipComposition";
const list = jest.fn(),
	save = jest.fn(),
	setDefault = jest.fn(),
	remove = jest.fn(),
	loadOverride = jest.fn(),
	push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@actions/clipLayoutLibrary", () => ({ listClipLayouts: (...a: unknown[]) => list(...a), saveClipLayoutTemplate: (...a: unknown[]) => save(...a), setDefaultClipLayout: (...a: unknown[]) => setDefault(...a), deleteClipLayoutTemplate: (...a: unknown[]) => remove(...a), loadClipLayoutOverride: (...a: unknown[]) => loadOverride(...a) }));
jest.mock("@components/creator/clipCompositionEditor", () => ({
	__esModule: true,
	default: ({ clipId, initial, onBack, onSaved }: any) => (
		<>
			<output>{`${clipId ?? "global"}:${initial.layers[0].label}`}</output>
			<button onClick={onBack}>Editor back</button>
			<button onClick={onSaved}>Editor saved</button>
		</>
	),
}));
jest.mock("@components/controlledModal", () => ({ __esModule: true, default: ({ children, isOpen }: any) => (isOpen ? <section role='dialog'>{children}</section> : null) }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
const entry = { id: "camera", name: "Camera mobile", composition: createClipComposition("mobile"), updatedAt: "2026-11-05T00:00:00Z" };
beforeEach(() => {
	jest.clearAllMocks();
	list.mockResolvedValue({ ok: true, templates: [entry], defaults: {} });
	setDefault.mockResolvedValue({ ok: true });
	remove.mockResolvedValue({ ok: true });
	loadOverride.mockResolvedValue({ ok: true, composition: null });
});
it("opens saved global layouts and clip overrides in separate scopes", async () => {
	const view = render(<Library creatorId='owner' layoutId='camera' />);
	expect(await screen.findByText("global:Camera")).toBeVisible();
	expect(loadOverride).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Editor back" }));
	expect(push).toHaveBeenCalledWith("/dashboard/clip-layouts");
	fireEvent.click(screen.getByRole("button", { name: "Editor saved" }));
	await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
	view.rerender(<Library creatorId='owner' layoutId='camera' clipId='ClipA' />);
	expect(await screen.findByText("ClipA:Camera")).toBeVisible();
	expect(loadOverride).toHaveBeenCalledWith("owner", "camera", "ClipA", "mobile");
});
it("keeps the layout list after failed deletion and allows a successful retry", async () => {
	remove.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	render(<Library creatorId='owner' />);
	fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete layout" }));
	await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
	await waitFor(() => expect(screen.getByRole("button", { name: "Delete layout" })).not.toBeDisabled());
	fireEvent.click(screen.getByRole("button", { name: "Delete layout" }));
	await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
	expect(remove).toHaveBeenLastCalledWith("owner", "camera");
});
it("sets defaults without changing template contents", async () => {
	render(<Library creatorId='owner' />);
	fireEvent.click(await screen.findByRole("button", { name: "Make default" }));
	await waitFor(() => expect(setDefault).toHaveBeenCalledWith("owner", "camera"));
	expect(save).not.toHaveBeenCalled();
});
it("creates a named Desktop layout and opens it without modifying another template", async () => {
	save.mockResolvedValue({ ok: true, id: "new-desktop" });
	render(<Library creatorId='owner' newFormat='desktop' referenceId='ClipA' />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "Desktop brand" } });
	fireEvent.click(screen.getAllByRole("button", { name: "Create layout" }).at(-1)!);
	await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/clip-layouts?layout=new-desktop&reference=ClipA"));
	expect(save).toHaveBeenCalledWith("owner", expect.objectContaining({ name: "Desktop brand", composition: expect.objectContaining({ format: "desktop" }) }));
});
it("retries a layout lookup failure and leaves failed clip overrides out of the editor", async () => {
	list.mockRejectedValueOnce(Error("offline"));
	const view = render(<Library creatorId='owner' />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry layouts" }));
	expect(await screen.findByText("Camera mobile")).toBeVisible();
	loadOverride.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
	view.rerender(<Library creatorId='owner' layoutId='camera' clipId='ClipA' />);
	expect(await screen.findByRole("button", { name: "Retry layouts" })).toBeVisible();
	expect(screen.queryByText("ClipA:Camera")).not.toBeInTheDocument();
});
it.each([false, true])("retains creation drafts after %s service failure and can cancel", async (throws) => {
	save.mockImplementationOnce(() => (throws ? Promise.reject(Error("offline")) : Promise.resolve({ ok: false })));
	render(<Library creatorId='owner' newFormat='mobile' clipId='ClipA' />);
	fireEvent.change(screen.getByRole("textbox", { name: "Layout name" }), { target: { value: "Draft" } });

	fireEvent.click(screen.getAllByRole("button", { name: "Create layout" }).at(-1)!);
	await waitFor(() => expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalled());
	expect(screen.getByRole("textbox", { name: "Layout name" })).toHaveValue("Draft");
	expect(push).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Adjust clip" }));
	expect(push).toHaveBeenCalledWith("/dashboard/clip-layouts?layout=camera&clip=ClipA");
});
it.each([false, true])("reports default errors and retains the selected layout: %s", async (throws) => {
	setDefault.mockImplementationOnce(() => (throws ? Promise.reject(Error("offline")) : Promise.resolve({ ok: false })));
	render(<Library creatorId='owner' />);
	fireEvent.click(await screen.findByRole("button", { name: "Make default" }));
	await waitFor(() => expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalled());
	expect(screen.getByRole("button", { name: "Make default" })).not.toBeDisabled();
	expect(screen.getByText("Camera mobile")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Edit layout" }));
	expect(push).toHaveBeenCalledWith("/dashboard/clip-layouts?layout=camera");
});
it("renders Desktop defaults, missing layout and empty states; preserves a failed delete until cancellation", async () => {
	list.mockResolvedValue({ ok: true, templates: [{ ...entry, composition: createClipComposition("desktop") }], defaults: { desktop: "camera" } });
	remove.mockRejectedValueOnce(Error("offline"));
	const view = render(<Library creatorId='owner' layoutId='gone' />);
	expect(await screen.findByText("This layout is no longer available. Choose another layout.")).toBeVisible();
	expect(screen.getByText("Default")).toBeVisible();
	expect(screen.queryByRole("button", { name: "Make default" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Delete" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete layout" }));
	await waitFor(() => expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalled());
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	list.mockResolvedValue({ ok: true, templates: [], defaults: {} });
	view.rerender(<Library creatorId='different' />);
	expect(await screen.findByText("Create your first layout")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Create layout" }));
	expect(screen.getByRole("dialog")).toBeVisible();
});
it("recovers rejected override loading and never substitutes a failed override into the editor", async () => {
	loadOverride.mockRejectedValueOnce(Error("offline"));
	render(<Library creatorId='owner' layoutId='camera' clipId='ClipA' />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry layouts" }));
	expect(await screen.findByText("ClipA:Camera")).toBeVisible();
});
