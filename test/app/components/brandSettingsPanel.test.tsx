import { render, screen, fireEvent, waitFor } from "@testing-library/react";
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ children, isOpen, ariaLabel, onClose }: any) =>
		isOpen ? (
			<section role='dialog' aria-label={ariaLabel}>
				<button aria-label='Close dialog' onClick={onClose}>
					Close
				</button>
				{children}
			</section>
		) : null,
}));
const load = jest.fn(),
	save = jest.fn(),
	sources = jest.fn();
const guard = { active: false, accept: jest.fn(), reject: jest.fn() };
let restoreDraft: any;
jest.mock("@lib/deploymentDrafts", () => ({
	useDeploymentDraft: (_key: any, _draft: any, _base: any, restore: any) => {
		restoreDraft = restore;
	},
}));
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../__mocks__/heroui-react.cjs"),
		controls = jest.requireActual("../../support/clipCompositionControls").compositionControls(base);
	return new Proxy(
		{
			...base,
			Select: controls.Select,
			NumberField: controls.NumberField,
			TextField: ({ children }: any) => {
				const R = jest.requireActual("react"),
					items = R.Children.toArray(children),
					label = items.find((child: any) => child.type === base.Label)?.props.children;
				return <div>{items.map((child: any) => (child.type === base.Input ? R.cloneElement(child, { "aria-label": label }) : child))}</div>;
			},
		},
		{ get: (target: any, key: any) => (key in target ? target[key] : base[key]) },
	);
});
jest.mock("@actions/creatorBrand", () => ({ getCreatorBrand: (...args: unknown[]) => load(...args), saveCreatorBrand: (...args: unknown[]) => save(...args), getBrandOverlaySources: (...args: unknown[]) => sources(...args) }));
jest.mock("@components/theme/ThemeColorInput", () => ({
	__esModule: true,
	default: ({ label, value, onChange }: any) => (
		<label>
			{label}
			<input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
		</label>
	),
}));
jest.mock("@components/upgradeModal", () => ({ __esModule: true, default: ({ isOpen }: any) => (isOpen ? <div role='dialog'>Upgrade branding</div> : null) }));
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: () => guard }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
it("keeps a free watermark enabled, opens upgrade and saves an explicitly confirmed account brand", async () => {
	const panel = await import("@components/settings/BrandSettingsPanel").catch(() => null);
	expect(panel).not.toBeNull();
	if (!panel) return;
	load.mockResolvedValue({ ok: true, canEdit: true, brand: null, revision: 0, canRemoveWatermark: false });
	save.mockResolvedValue({ ok: true, revision: 1 });
	const Panel = panel.default;
	render(<Panel user={{ id: "creator", username: "Streamer", plan: "free", permissions: ["creator:update"] } as never} />);
	const toggle = await screen.findByRole("switch", { name: "Clipify watermark" });
	fireEvent.click(toggle);
	expect(screen.getByRole("dialog")).toHaveTextContent("Upgrade branding");
	expect(toggle).toBeChecked();
	fireEvent.change(screen.getByRole("textbox", { name: "Text Color" }), { target: { value: "#ff0000" } });
	fireEvent.click(screen.getByRole("button", { name: "Apply brand" }));
	fireEvent.click(screen.getByRole("button", { name: "Apply to overlays and clips" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("creator", expect.objectContaining({ themeTextColor: "#ff0000", watermark: true }), 0));
});

import Panel from "@components/settings/BrandSettingsPanel";
import { creatorBrandSchema } from "@lib/overlayMetadata";
import { notify } from "@lib/toast";
import { act } from "@testing-library/react";
const user = { id: "creator", username: "Streamer", plan: "pro" } as never;
beforeEach(() => {
	guard.active = false;
	jest.clearAllMocks();
	load.mockResolvedValue({ ok: true, canEdit: true, brand: creatorBrandSchema.parse({}), revision: 1, canRemoveWatermark: true });
	save.mockResolvedValue({ ok: true, revision: 2 });
	sources.mockResolvedValue({ ok: true, overlays: [] });
});
it("edits source, family, corners and Pro watermark and submits the existing brand", async () => {
	render(<Panel user={user} />);
	await screen.findByRole("switch", { name: "Clipify watermark" });
	fireEvent.change(screen.getByRole("combobox", { name: "Font source" }), { target: { value: "google" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Google font family" }), { target: { value: "Poppins" } });
	fireEvent.change(screen.getByRole("spinbutton", { name: "Corner radius (px)" }), { target: { value: "4" } });
	fireEvent.click(screen.getByRole("switch", { name: "Clipify watermark" }));
	fireEvent.click(screen.getByRole("button", { name: "Save brand" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("creator", expect.objectContaining({ fontFamily: "Poppins", borderRadius: 4, watermark: false }), 1));
	fireEvent.change(screen.getByRole("combobox", { name: "Font source" }), { target: { value: "builtin" } });
	fireEvent.change(screen.getByRole("combobox", { name: "Font family" }), { target: { value: "DejaVu Serif" } });
	const form = screen.getByRole("combobox", { name: "Font family" }).closest("form")!;
	fireEvent.submit(form);
	await waitFor(() => expect(save).toHaveBeenLastCalledWith("creator", expect.objectContaining({ fontFamily: "DejaVu Serif" }), 2));
});
it.each(["CONFLICT", "PRO_REQUIRED", "FONT_UNAVAILABLE", "SERVICE_UNAVAILABLE", "throw"])("preserves the draft when save returns %s", async (code) => {
	if (code === "throw") save.mockRejectedValue(Error("offline"));
	else save.mockResolvedValue({ ok: false, code });
	render(<Panel user={user} />);
	await screen.findByRole("switch", { name: "Clipify watermark" });
	fireEvent.change(screen.getByRole("combobox", { name: "Font source" }), { target: { value: "google" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Google font family" }), { target: { value: "Laila" } });
	fireEvent.click(screen.getByRole("button", { name: "Save brand" }));
	await waitFor(() => expect(save).toHaveBeenCalled());
	if (code === "PRO_REQUIRED") expect(await screen.findByRole("dialog")).toHaveTextContent("Upgrade branding");
	else if (code === "FONT_UNAVAILABLE") expect(await screen.findByText(/This font could not be loaded/)).toBeVisible();
	else await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
	expect(screen.getByRole("textbox", { name: "Google font family" })).toHaveValue("Laila");
});
it("validates unsupported fonts locally and preserves drafts during preview recovery", async () => {
	render(<Panel user={user} />);
	await screen.findByRole("switch", { name: "Clipify watermark" });
	fireEvent.change(screen.getByRole("combobox", { name: "Font source" }), { target: { value: "google" } });
	fireEvent.change(screen.getByRole("textbox", { name: "Google font family" }), { target: { value: "bad; css" } });
	fireEvent.click(screen.getByRole("button", { name: "Save brand" }));
	expect(screen.getByText("Choose a valid font and appearance.")).toBeVisible();
	expect(save).not.toHaveBeenCalled();
	fireEvent.change(screen.getByRole("textbox", { name: "Google font family" }), { target: { value: "Laila" } });
	const image = await screen.findByRole("img");
	fireEvent.error(image);
	fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
	expect(screen.getByRole("textbox", { name: "Google font family" })).toHaveValue("Laila");
});
it("retries loading and ignores responses for an unmounted creator", async () => {
	load.mockRejectedValueOnce(Error("offline"));
	sources.mockRejectedValueOnce(Error("offline"));
	const view = render(<Panel user={user} />);
	fireEvent.click(await screen.findByRole("button", { name: "Retry brand styling" }));
	await screen.findByRole("switch", { name: "Clipify watermark" });
	view.unmount();
	load.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	const next = render(<Panel user={user} />);
	await screen.findByRole("button", { name: "Retry brand styling" });
	next.unmount();
	let resolve: (v: unknown) => void = () => {};
	load.mockReturnValue(
		new Promise((r) => {
			resolve = r;
		}),
	);
	const stale = render(<Panel user={user} />);
	stale.unmount();
	await act(async () => resolve({ ok: true, canEdit: true, brand: null, revision: 0 }));
});
it("imports an existing style, preserves local drafts and exposes navigation recovery", async () => {
	load.mockResolvedValue({ ok: true, canEdit: true, brand: null, revision: 0, canRemoveWatermark: true });
	sources.mockResolvedValue({ ok: true, overlays: [{ id: "legacy", name: "OBS style", themeFontFamily: "Laila, sans-serif||url||https://fonts.googleapis.com/css2?family=Laila", themeTextColor: "#ffeecc", themeBackgroundColor: "#112233", themeAccentColor: "#7C3AED", borderRadius: 10, borderSize: 0 }] });
	const view = render(<Panel user={user} />);
	fireEvent.change(await screen.findByRole("combobox", { name: "Start from an existing overlay" }), { target: { value: "legacy" } });
	expect(screen.getByRole("textbox", { name: "Google font family" })).toHaveValue("Laila");
	fireEvent.click(screen.getByRole("button", { name: "Apply brand" }));
	fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
	await act(async () => restoreDraft(creatorBrandSchema.parse({ themeTextColor: "#ff0000" }), creatorBrandSchema.parse({})));
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("#ff0000");
	guard.active = true;
	view.rerender(<Panel user={user} />);
	fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
	expect(guard.accept).toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
	expect(guard.reject).toHaveBeenCalled();
});
it("shows collaborators a read-only brand without inviting an unauthorized save", async () => {
	load.mockResolvedValue({ ok: true, brand: creatorBrandSchema.parse({}), revision: 1, canEdit: false, canRemoveWatermark: true });
	render(<Panel user={user} />);
	await screen.findByRole("switch", { name: "Clipify watermark" });
	expect(screen.getByRole("button", { name: "Save brand" })).toBeDisabled();
	expect(screen.getByRole("textbox", { name: "Text Color" })).toBeDisabled();
	expect(screen.getByText("You can view this brand. An account owner can change it.")).toBeVisible();
});

it("ends a stalled brand skeleton, retries, and ignores the superseded response", async () => {
	jest.useFakeTimers();
	let resolveOld: (v: unknown) => void = () => {};
	load.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				resolveOld = resolve;
			}),
	);
	render(<Panel user={user} />);
	await act(async () => {
		jest.advanceTimersByTime(15000);
	});
	expect(screen.getByRole("button", { name: "Retry brand styling" })).toBeVisible();
	load.mockResolvedValueOnce({ ok: true, brand: creatorBrandSchema.parse({ themeTextColor: "#ff0000" }), revision: 2, canEdit: true, canRemoveWatermark: true });
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "Retry brand styling" }));
	});
	await act(async () => {
		resolveOld({ ok: true, brand: creatorBrandSchema.parse({}), revision: 1, canEdit: true, canRemoveWatermark: true });
	});
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("#ff0000");
	jest.useRealTimers();
});

it.each(["https://fonts.googleapis.com.evil.example/css2?family=Laila", "https://evil-fonts.googleapis.com/css2?family=Laila", "https://evil.example/fonts.googleapis.com", "https://evil.example/?host=fonts.googleapis.com", "https://evil.example/#fonts.googleapis.com", "https://fonts.googleapis.com@evil.example/css2?family=Laila", "http://fonts.googleapis.com/css2?family=Laila", "not-a-url-fonts.googleapis.com"])("does not import an untrusted stylesheet as a Google font: %s", async (fontUrl) => {
	load.mockResolvedValue({ ok: true, canEdit: true, brand: null, revision: 0, canRemoveWatermark: true });
	sources.mockResolvedValue({ ok: true, overlays: [{ id: "legacy", name: "OBS style", themeFontFamily: `Laila, sans-serif||url||${fontUrl}`, themeTextColor: "#ffeecc", themeBackgroundColor: "#112233", themeAccentColor: "#7C3AED", borderRadius: 10, borderSize: 0 }] });
	render(<Panel user={user} />);
	fireEvent.change(await screen.findByRole("combobox", { name: "Start from an existing overlay" }), { target: { value: "legacy" } });
	expect(screen.getByRole("combobox", { name: "Font source" })).toHaveValue("builtin");
	expect(screen.queryByRole("textbox", { name: "Google font family" })).not.toBeInTheDocument();
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("#ffeecc");
	fireEvent.click(screen.getByRole("button", { name: "Apply brand" }));
	fireEvent.click(screen.getByRole("button", { name: "Apply to overlays and clips" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("creator", expect.objectContaining({ fontSource: "builtin", fontFamily: "DejaVu Sans", themeTextColor: "#ffeecc" }), 0));
});

it.each(["https://fonts.googleapis.com/css?family=Laila", "https://FONTS.GOOGLEAPIS.COM/css2?family=Laila"])("preserves a legitimate Google font import: %s", async (fontUrl) => {
	load.mockResolvedValue({ ok: true, canEdit: true, brand: null, revision: 0, canRemoveWatermark: true });
	sources.mockResolvedValue({ ok: true, overlays: [{ id: "legacy", name: "OBS style", themeFontFamily: `Laila, sans-serif||url||${fontUrl}`, themeTextColor: "#ffeecc", themeBackgroundColor: "#112233", themeAccentColor: "#7C3AED", borderRadius: 10, borderSize: 0 }] });
	render(<Panel user={user} />);
	fireEvent.change(await screen.findByRole("combobox", { name: "Start from an existing overlay" }), { target: { value: "legacy" } });
	expect(screen.getByRole("combobox", { name: "Font source" })).toHaveValue("google");
	expect(screen.getByRole("textbox", { name: "Google font family" })).toHaveValue("Laila");
	fireEvent.click(screen.getByRole("button", { name: "Apply brand" }));
	fireEvent.click(screen.getByRole("button", { name: "Apply to overlays and clips" }));
	await waitFor(() => expect(save).toHaveBeenCalledWith("creator", expect.objectContaining({ fontSource: "google", fontFamily: "Laila", themeTextColor: "#ffeecc" }), 0));
});
