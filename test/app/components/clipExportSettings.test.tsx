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
	return new Proxy({ ...base, Checkbox }, { get: (target: any, key: any) => (key in target ? target[key] : base[key]) });
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
	for (const label of ["Desktop: Main desktop", "Mobile: Camera mobile", "Mobile: Gameplay mobile"]) fireEvent.click(await screen.findByRole("checkbox", { name: label }));
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
	expect(start.mock.calls[0][0][0].files).toHaveLength(4);
	expect(start.mock.calls[0][0][0].outputs.map((output: any) => output.label)).toEqual(["Original", "Main desktop", "Camera mobile", "Gameplay mobile"]);
	expect(close).toHaveBeenCalledTimes(1);
});
it("retains choices when queueing fails and offers global layout creation when none exist", async () => {
	list.mockResolvedValue({ ok: true, templates: [], defaults: {} });
	const close = jest.fn();
	render(<ClipExportSettings creatorId='owner' clipIds={["ClipA"]} onStart={() => false} onClose={close} />);
	await screen.findByRole("link", { name: "Create Desktop layout" });
	expect(screen.getByRole("link", { name: "Create Mobile layout" })).toHaveAttribute("target", "_blank");
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	expect(close).not.toHaveBeenCalled();
	expect(screen.getByRole("checkbox", { name: "Original" })).toBeChecked();
});
