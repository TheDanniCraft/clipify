import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const validateAuth = jest.fn();
const getOverlay = jest.fn();
const getOverlayOwnerPlan = jest.fn();
const saveOverlay = jest.fn();
const notify = jest.fn();
const push = jest.fn();
const router = { push };
jest.mock("next/navigation", () => ({ useRouter: () => router, useParams: () => ({ overlayId: "overlay-1" }) }));
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@actions/database", () => ({ getOverlay: (...args: unknown[]) => getOverlay(...args), getOverlayOwnerPlan: (...args: unknown[]) => getOverlayOwnerPlan(...args), saveOverlay: (...args: unknown[]) => saveOverlay(...args) }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@lib/featureAccess", () => ({ getFeatureAccess: (user: { plan: string }) => ({ allowed: user.plan === "pro" }), getTrialDaysLeft: () => 0, isReverseTrialActive: () => false }));
jest.mock("@components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock("@components/chatwootData", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/upgradeModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/fullscreenLoadingState", () => ({ __esModule: true, default: ({ message }: { message: string }) => <div>{message}</div> }));
jest.mock("@tabler/icons-react", () => new Proxy({}, { get: () => () => null }));
jest.mock("@heroui/react", () => {
	const R = jest.requireActual<typeof import("react")>("react");
	const shared = jest.requireActual("../../__mocks__/heroui-react.cjs");
	const parseColor = jest.requireActual("@react-stately/color").parseColor;
	function labelOf(children: any): string {
		for (const child of R.Children.toArray(children)) {
			if (typeof child === "string") return child;
			if (R.isValidElement(child)) {
				const label = labelOf((child.props as any).children);
				if (label) return label;
			}
		}
		return "";
	}
	const Track = ({ children }: { children: any }) => R.createElement("div", null, typeof children === "function" ? children({ state: { values: [0] } }) : children);
	const Slider = Object.assign(
		function ThemeSlider({ children, value, onChange, minValue, maxValue, step }: any) {
			return R.createElement("div", null, R.createElement("input", { type: "range", "aria-label": labelOf(children), value: Array.isArray(value) ? value[0] : value, min: minValue, max: maxValue, step, onChange: (event: any) => onChange(Number(event.target.value)) }), children);
		},
		{ Track, Thumb: shared.Card.Content, Fill: shared.Card.Content, Output: shared.Card.Content },
	);
	const SelectContext = R.createContext<any>(null);
	const Select = Object.assign(
		function ThemeSelect(props: any) {
			return R.createElement(SelectContext.Provider, { value: props }, R.createElement("div", { role: "group", "aria-label": props["aria-label"] || labelOf(props.children) }, props.children));
		},
		{ Trigger: shared.Card.Content, Popover: shared.Card.Content, Value: shared.Card.Content, Indicator: shared.Card.Content },
	);
	const ListBox = Object.assign(
		function ThemeListBox({ children }: any) {
			return R.createElement("div", null, children);
		},
		{
			Item: function ThemeOption({ id, textValue, children }: any) {
				const select = R.useContext(SelectContext);
				return R.createElement(
					"button",
					{
						type: "button",
						onClick: () => {
							if (!select) return;
							if (select.selectionMode === "multiple") {
								const selected = new Set(select.value);
								if (selected.has(id)) selected.delete(id);
								else selected.add(id);
								select.onChange([...selected]);
							} else select.onChange(id);
						},
					},
					textValue || children,
				);
			},
			ItemIndicator: shared.Card.Content,
		},
	);
	const TabsContext = R.createContext<any>(null);
	const Tabs = Object.assign(
		function ThemeTabs({ children, onSelectionChange, selectedKey }: any) {
			return R.createElement(TabsContext.Provider, { value: { onSelectionChange, selectedKey } }, children);
		},
		{
			ListContainer: shared.Card.Content,
			List: function ThemeTabList({ children, ...props }: any) {
				return R.createElement("div", { role: "tablist", "aria-label": props["aria-label"] }, children);
			},
			Tab: function ThemeTab({ id, children }: any) {
				const tabs = R.useContext(TabsContext);
				return R.createElement("button", { role: "tab", type: "button", "aria-selected": tabs.selectedKey === id, onClick: () => tabs.onSelectionChange(id) }, children);
			},
			Indicator: shared.Card.Content,
		},
	);
	const ColorContext = R.createContext<any>(null);
	const FieldContext = R.createContext<any>(null);
	const ColorPicker = Object.assign(
		function ThemeColorPicker({ children, value, onChange }: any) {
			const label = labelOf(children);
			return R.createElement(ColorContext.Provider, { value: { value, onChange, label } }, R.createElement("div", { role: "group", "aria-label": label }, children));
		},
		{
			Trigger: shared.Button,
			Popover: function ThemeColorPopover({ children, onOpenChange }: any) {
				const context = R.useContext(ColorContext);
				return R.createElement("div", null, children, R.createElement("button", { type: "button", "aria-label": `Close ${context.label} picker`, onClick: () => onOpenChange(false) }, "Close"));
			},
		},
	);
	const ColorField = Object.assign(
		function ThemeColorField(props: any) {
			return R.createElement(FieldContext.Provider, { value: { label: props["aria-label"] || labelOf(props.children), channel: props.channel, colorSpace: props.colorSpace } }, props.children);
		},
		{
			Group: shared.Card.Content,
			Suffix: shared.Card.Content,
			Input: function ThemeColorInput(inputProps: any) {
				const context = R.useContext(ColorContext);
				const field = R.useContext(FieldContext);
				const value = field.channel ? context.value.toFormat(field.colorSpace).getChannelValue(field.channel) : context.value.toString("rgba");
				return R.createElement("input", {
					type: field.channel ? "number" : "text",
					"aria-label": field.label,
					onBlur: inputProps.onBlur,
					value,
					onChange: (event: any) => {
						try {
							context.onChange(field.channel ? context.value.toFormat(field.colorSpace).withChannelValue(field.channel, Number(event.target.value)) : parseColor(event.target.value));
						} catch {}
					},
				});
			},
		},
	);
	const ColorSlider = Object.assign(
		function ThemeColorSlider(props: any) {
			const context = R.useContext(ColorContext);
			const color = context.value.toFormat(props.colorSpace);
			return R.createElement(
				"div",
				null,
				R.createElement("input", {
					type: "range",
					"aria-label": props["aria-label"],
					value: color.getChannelValue(props.channel),
					min: 0,
					max: props.channel === "alpha" ? 1 : 360,
					step: 0.01,
					onChange: (event: any) => {
						const next = color.withChannelValue(props.channel, Number(event.target.value));
						context.onChange(next);
						props.onChangeEnd?.(next);
					},
				}),
				props.children,
			);
		},
		{ Output: shared.Card.Content, Track: shared.Card.Content, Thumb: shared.Card.Content },
	);
	const ColorArea = Object.assign(
		function ThemeColorArea(props: any) {
			const context = R.useContext(ColorContext);
			return R.createElement(
				"button",
				{
					type: "button",
					"aria-label": props["aria-label"],
					onClick: () => {
						const next = parseColor("#123456");
						context.onChange(next);
						props.onChangeEnd?.(next);
					},
				},
				props.children,
			);
		},
		{ Thumb: shared.Card.Content },
	);
	const SwatchContext = R.createContext<any>(null);
	const ColorSwatchPicker = Object.assign(
		function ThemeSwatches({ children, onChange }: any) {
			return R.createElement(SwatchContext.Provider, { value: onChange }, R.createElement("div", null, children));
		},
		{
			Item: function ThemeSwatch({ color, children }: any) {
				const context = R.useContext(ColorContext);
				const onChange = R.useContext(SwatchContext);
				return R.createElement("button", { type: "button", "aria-label": `Swatch ${color}`, onClick: () => (onChange ?? context.onChange)(parseColor(color)) }, children);
			},
			Swatch: shared.Card.Content,
		},
	);
	const TextField = function ThemeTextField({ children, isReadOnly }: any) {
		return R.createElement(
			"div",
			null,
			R.Children.map(children, (child: any) => (R.isValidElement(child) && child.type === shared.Input ? R.cloneElement(child as any, { readOnly: isReadOnly, "aria-label": labelOf(children) }) : child)),
		);
	};
	return new Proxy(
		{ ...shared, TextField, Slider, Select, ListBox, Tabs, ColorPicker, ColorField, ColorSlider, ColorArea, ColorSwatchPicker, parseColor },
		{
			get(target, key) {
				return key in target ? target[key] : shared[key];
			},
		},
	);
});
import Page from "@/app/dashboard/overlay/[overlayId]/theme/page";
const saved = {
	id: "overlay-1",
	ownerId: "creator",
	name: "Creator overlay",
	status: "active",
	type: "Featured",
	configurationRevision: 7,
	playerVolume: 83,
	overlayInfoFadeOutSeconds: 12,
	showChannelInfo: true,
	showClipInfo: true,
	showTimer: true,
	showProgressBar: true,
	themeFontFamily: "Inter",
	themeTextColor: "#112233",
	themeAccentColor: "#123456",
	themeBackgroundColor: "rgba(10,10,10,0.65)",
	progressBarStartColor: "#26018E",
	progressBarEndColor: "#8D42F9",
	borderSize: 8,
	borderRadius: 24,
	effectScanlines: true,
	effectStatic: true,
	effectCrt: true,
	channelInfoX: 0,
	channelInfoY: 0,
	clipInfoX: 100,
	clipInfoY: 100,
	timerX: 100,
	timerY: 0,
	channelScale: 100,
	clipScale: 100,
	timerScale: 100,
};
beforeEach(() => {
	Object.defineProperty(window, "innerWidth", { value: 1440, writable: true, configurable: true });
	window.matchMedia = jest.fn((query: string) => ({ matches: true, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(() => true) }));
	jest.clearAllMocks();
	window.localStorage.clear();
	document.head.querySelectorAll('link[id^="theme-font-"]').forEach((link) => link.remove());
	validateAuth.mockResolvedValue({ id: "actor", plan: "pro", avatar: "" });
	getOverlay.mockResolvedValue(saved);
	getOverlayOwnerPlan.mockResolvedValue("pro");
	saveOverlay.mockReset().mockImplementation(async (_id, patch) => ({ ...saved, ...patch, configurationRevision: 8 }));
});
async function ready() {
	render(<Page />);
	await screen.findByRole("button", { name: "Save Style" });
}
test("loaded style starts clean and back navigation keeps the overlay target", async () => {
	await ready();
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Back to Overlay Settings" }));
	expect(push).toHaveBeenCalledWith("/dashboard/overlay/overlay-1");
});
test("reset and save carry the last-read revision and preserve unrelated player volume", async () => {
	await ready();
	fireEvent.click(screen.getByRole("button", { name: "Reset Theme" }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ playerVolume: 83, themeFontFamily: "inherit", effectCrt: false }), 7));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Style saved" })));
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});
test.each(["unavailable", "rejected"])("%s save keeps edits and shows reload guidance", async (mode) => {
	if (mode === "unavailable") saveOverlay.mockResolvedValue(null);
	else saveOverlay.mockRejectedValue(new Error("fixture write failure"));
	await ready();
	fireEvent.click(screen.getByRole("button", { name: "Reset Theme" }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ description: "Overlay changed or access was updated. Reload and try again." })));
	expect(screen.getByRole("button", { name: "Save Style" })).toBeEnabled();
});
test("missing authentication redirects without exposing the style editor", async () => {
	validateAuth.mockResolvedValue(null);
	render(<Page />);
	await waitFor(() => expect(push).toHaveBeenCalledWith("/logout"));
	expect(screen.queryByRole("button", { name: "Save Style" })).not.toBeInTheDocument();
});
test("late overlay load after unmount cannot start an owner-plan request", async () => {
	let resolve!: (value: typeof saved) => void;
	getOverlay.mockImplementation(
		() =>
			new Promise((done) => {
				resolve = done;
			}),
	);
	const view = render(<Page />);
	view.unmount();
	await act(async () => {
		resolve(saved);
	});
	expect(getOverlayOwnerPlan).not.toHaveBeenCalled();
});

test.each([0, 100])("volume %s remains bounded in the saved style patch", async (value) => {
	await ready();
	fireEvent.change(screen.getByRole("slider", { name: "Player Volume" }), { target: { value: String(value) } });
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ playerVolume: value }), 7));
});
test("fade duration saves without changing the player volume", async () => {
	await ready();
	fireEvent.change(screen.getByRole("slider", { name: "Overlay Fade Out (seconds)" }), { target: { value: "30" } });
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ overlayInfoFadeOutSeconds: 30, playerVolume: 83 }), 7));
});
test.each([
	["Timer", "showTimer"],
	["Channel Info", "showChannelInfo"],
	["Clip Info", "showClipInfo"],
	["Progress Bar", "showProgressBar"],
])("disabling %s preserves other saved style fields", async (label, key) => {
	await ready();
	fireEvent.click(within(screen.getByRole("group", { name: "Enabled Components" })).getByRole("button", { name: label }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ [key]: false, playerVolume: 83 }), 7));
});
test.each([
	["Scanlines", "effectScanlines"],
	["Static", "effectStatic"],
	["CRT (Old TV)", "effectCrt"],
])("disabling %s preserves the current revision", async (label, key) => {
	await ready();
	fireEvent.click(within(screen.getByRole("group", { name: "Visual Effects" })).getByRole("button", { name: label }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ [key]: false }), 7));
});
test.each([
	["Website", "inherit"],
	["System", "system-ui"],
])("%s typography saves its matching font source", async (label, font) => {
	await ready();
	fireEvent.click(screen.getByRole("tab", { name: label }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeFontFamily: font }), 7));
});
test("Google typography generates a safe stylesheet and saves the encoded family", async () => {
	await ready();
	fireEvent.click(screen.getByRole("tab", { name: "Google" }));
	expect(document.head.querySelector('link[id^="theme-font-"]')).toHaveAttribute("href", "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap");
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeFontFamily: "Inter, sans-serif||url||https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" }), 7));
});
test.each([
	["Text Color", "themeTextColor"],
	["Progress Gradient Start", "progressBarStartColor"],
	["Progress Gradient End", "progressBarEndColor"],
])("%s uses validated native Color callback values", async (label, key) => {
	await ready();
	fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value: "#ABCDEF" } });
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ [key]: expect.stringMatching(/^#abcdef$/i) }), 7));
});
test("background opacity is preserved through color validation", async () => {
	await ready();
	fireEvent.change(screen.getByRole("textbox", { name: "Background Color" }), { target: { value: "rgba(12,34,56,0.4)" } });
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeBackgroundColor: "rgba(12, 34, 56, 0.4)" }), 7));
});
test("field blur commits the exact chosen color to the recent palette", async () => {
	await ready();
	fireEvent.change(screen.getByRole("textbox", { name: "Text Color" }), { target: { value: "#ABCDEF" } });
	fireEvent.blur(screen.getByRole("textbox", { name: "Text Color" }));
	await waitFor(() => expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors") ?? "[]")).toEqual(["rgba(171, 205, 239, 1)"]));
});

test("picker controlled color preserves the selected RGB bytes", async () => {
	await ready();
	fireEvent.change(screen.getByRole("textbox", { name: "Text Color" }), { target: { value: "#ABCDEF" } });
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("rgba(171, 205, 239, 1)");
});
test("picker controlled background preserves fractional opacity and RGB bytes", async () => {
	await ready();
	fireEvent.change(screen.getByRole("textbox", { name: "Background Color" }), { target: { value: "rgba(12,34,56,0.1234)" } });
	expect(screen.getByRole("textbox", { name: "Background Color" })).toHaveValue("rgba(12, 34, 56, 0.1234)");
});

function layoutGeometry() {
	Object.defineProperty(window, "PointerEvent", { value: MouseEvent, writable: true, configurable: true });
	jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
		if (this.classList.contains("aspect-video")) return { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, toJSON: () => ({}) } as DOMRect;
		const positioned = this.closest(".absolute") as HTMLElement | null;
		const scale = Number(this.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? 1);
		const width = 100 * scale,
			height = 50 * scale;
		const left = (Number.parseFloat(positioned?.style.left ?? "0") || 0) * 10 - (this.style.transformOrigin.includes("right") ? width : 0);
		const top = (Number.parseFloat(positioned?.style.top ?? "0") || 0) * 5 - (this.style.transformOrigin.includes("bottom") ? height : 0);
		return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) } as DOMRect;
	});
}
afterEach(() => jest.restoreAllMocks());
function box(target: string) {
	const label = target === "channel" ? "TheDanniCraft" : target === "clip" ? "Insane comeback in ranked" : "18";
	return screen.getByText(label, { exact: true }).closest(".cursor-grab") as HTMLElement;
}
function selectBox(target: string) {
	const element = box(target);
	const rect = element.getBoundingClientRect();
	fireEvent.pointerDown(element, { clientX: rect.left + 10, clientY: rect.top + 10 });
	fireEvent.pointerUp(window);
	return element;
}
test.each([
	["channel", 210, 110, "channelInfoX", 20, "channelInfoY", 20],
	["clip", 650, 350, "clipInfoX", 74, "clipInfoY", 78],
	["timer", 650, 150, "timerX", 74, "timerY", 28],
])("dragging %s preserves bounded normalized coordinates", async (target, x, y, xKey, expectedX, yKey, expectedY) => {
	layoutGeometry();
	await ready();
	const element = box(String(target));
	const rect = element.getBoundingClientRect();
	fireEvent.pointerDown(element, { clientX: rect.left + 10, clientY: rect.top + 10 });
	fireEvent.pointerMove(window, { clientX: x, clientY: y });
	fireEvent.pointerUp(window);
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ [String(xKey)]: expectedX, [String(yKey)]: expectedY }), 7));
});
test.each(["channel", "clip", "timer"].flatMap((target) => ["top left", "top right", "bottom left", "bottom right"].map((handle) => ({ target, handle }))))("$target $handle resize preserves aspect and shared revision", async ({ target, handle }) => {
	layoutGeometry();
	await ready();
	const element = selectBox(target);
	const rect = element.getBoundingClientRect();
	fireEvent.pointerDown(screen.getByRole("button", { name: `Resize ${target} ${handle}` }), { clientX: rect.left, clientY: rect.top });
	const x = handle.endsWith("left") ? rect.left - rect.width / 2 : rect.right + rect.width / 2;
	const y = handle.startsWith("top") ? rect.top - rect.height / 2 : rect.bottom + rect.height / 2;
	fireEvent.pointerMove(window, { clientX: x, clientY: y });
	fireEvent.pointerUp(window);
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ [`${target}Scale`]: 150 }), 7));
});
test.each([
	[1, 1, 50],
	[10000, 10000, 250],
])("resize at %s/%s clamps scale to %s", async (x, y, scale) => {
	layoutGeometry();
	await ready();
	selectBox("channel");
	fireEvent.pointerDown(screen.getByRole("button", { name: "Resize channel bottom right" }), { clientX: 100, clientY: 50 });
	fireEvent.pointerMove(window, { clientX: x, clientY: y });
	fireEvent.pointerUp(window);
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ channelScale: scale }), 7));
});
test.each([
	["channel", "ArrowRight", "channelInfoX", 0.2],
	["clip", "ArrowLeft", "clipInfoX", 99.8],
	["timer", "ArrowDown", "timerY", 0.4],
])("keyboard %s %s uses the viewport pixel step", async (target, key, field, value) => {
	layoutGeometry();
	await ready();
	selectBox(String(target));
	fireEvent.keyDown(window, { key });
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ [String(field)]: value }), 7));
});
test("arrow keys in a color field do not move the selected layout element", async () => {
	layoutGeometry();
	await ready();
	selectBox("channel");
	screen.getByRole("textbox", { name: "Text Color" }).focus();
	fireEvent.keyDown(window, { key: "ArrowRight" });
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});
test("blank preview interaction deselects resize handles without dirtying configuration", async () => {
	layoutGeometry();
	await ready();
	const selected = selectBox("channel");
	expect(screen.getByRole("button", { name: "Resize channel top left" })).toBeInTheDocument();
	const preview = selected.closest(".aspect-video")!;
	fireEvent.pointerDown(preview, { clientX: 500, clientY: 250 });
	expect(screen.queryByRole("button", { name: "Resize channel top left" })).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});

test.each(["not-json", '{"invalid":true}', '[null,4,"rgba(1, 2, 3, 1)"]'])("recent palette tolerates stored value %s and replaces it with a valid commit", async (stored) => {
	window.localStorage.setItem("clipify:overlay-theme-recent-colors", stored);
	await ready();
	fireEvent.change(screen.getByRole("textbox", { name: "Text Color" }), { target: { value: "#ABCDEF" } });
	fireEvent.blur(screen.getByRole("textbox", { name: "Text Color" }));
	await waitFor(() => expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe("rgba(171, 205, 239, 1)"));
	expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!).every((value: unknown) => typeof value === "string")).toBe(true);
});
test("opacity slider commit preserves the chosen alpha in saved settings and recent palette", async () => {
	await ready();
	fireEvent.change(screen.getByRole("slider", { name: "Background Color opacity" }), { target: { value: "0.25" } });
	expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe("rgba(10, 10, 10, 0.25)");
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeBackgroundColor: "rgba(10, 10, 10, 0.25)" }), 7));
});
test("editing the Google family updates the saved family and encoded stylesheet", async () => {
	await ready();
	fireEvent.click(screen.getByRole("tab", { name: "Google" }));
	fireEvent.change(screen.getByRole("textbox", { name: "Google Font Family" }), { target: { value: "Space Grotesk" } });
	expect(screen.getByRole("textbox", { name: "Google CSS URL" })).toHaveValue("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap");
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeFontFamily: "Space Grotesk, sans-serif||url||https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" }), 7));
});

test.each(["#0f0", "#00f", "#f0f", "#ff0", "#0ff", "#808080", "#1234", "#12345678"])("saved native color %s round trips without corrupting the editor", async (color) => {
	getOverlay.mockResolvedValue({ ...saved, themeTextColor: color });
	await ready();
	const input = screen.getByRole("textbox", { name: "Text Color" });
	expect((input as HTMLInputElement).value).toMatch(/^rgba\(/);
	fireEvent.blur(input);
	await waitFor(() => expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe((input as HTMLInputElement).value));
});
test.each(["http://fonts.googleapis.com/css2?family=Test", "https://example.com/font.css", "not-a-url"])("untrusted stored font URL %s does not load a stylesheet", async (url) => {
	getOverlay.mockResolvedValue({ ...saved, themeFontFamily: `Test||url||${url}` });
	await ready();
	expect(document.head.querySelector('link[id^="theme-font-"]')).toBeNull();
	expect(screen.getByRole("tab", { name: "Website" })).toHaveAttribute("aria-selected", "true");
});
test.each([800, 1099])("narrow viewport %s preserves saved coordinates during attempted dragging", async (width) => {
	layoutGeometry();
	window.innerWidth = width;
	await ready();
	expect(screen.queryByText("TheDanniCraft", { exact: true })?.closest(".cursor-grab")).toBeNull();
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});

test.each(["", "#ggg", "#12", "rgb(1,2)", "rgba(x,2,3,1)", "hsl(120, 100%, 50%)", "hsla(240, 100%, 50%, 0.4)"])("stored background %s renders through the color parser safely", async (color) => {
	getOverlay.mockResolvedValue({ ...saved, themeBackgroundColor: color });
	await ready();
	expect((screen.getByRole("textbox", { name: "Background Color" }) as HTMLInputElement).value).toMatch(/^rgba\(/);
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});
test("touch-only viewport offers desktop guidance and disables drag affordances", async () => {
	window.matchMedia = jest.fn((query: string) => ({ matches: false, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(() => true) }));
	await ready();
	expect(screen.getByText(/Drag & drop positioning is not supported on mobile/)).toBeInTheDocument();
	expect(screen.queryByText("TheDanniCraft", { exact: true })?.closest(".cursor-grab")).toBeNull();
});
test("viewport resize restores desktop layout editing without making saved settings dirty", async () => {
	window.innerWidth = 800;
	await ready();
	expect(screen.getByText(/Drag & drop needs a wider viewport/)).toBeInTheDocument();
	window.innerWidth = 1440;
	fireEvent(window, new Event("resize"));
	expect(screen.queryByText(/Drag & drop needs a wider viewport/)).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});

test("swatch selection commits exact recent color and saving advances the loaded revision", async () => {
	await ready();
	const picker = screen.getByRole("group", { name: "Text Color" });
	fireEvent.click(within(picker).getByRole("button", { name: "Swatch #9146FF" }));
	expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe("rgba(145, 70, 255, 1)");
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeTextColor: expect.stringMatching(/^#9146ff$/i) }), 7));
});
test("single color reset preserves unrelated current style fields", async () => {
	await ready();
	fireEvent.click(within(screen.getByRole("group", { name: "Text Color" })).getByRole("button", { name: "Reset to default" }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ playerVolume: 83, themeAccentColor: "#123456" }), 7));
});
test("RGB channel blur records native channel edit", async () => {
	await ready();
	const picker = screen.getByRole("group", { name: "Text Color" });
	const red = within(picker).getByRole("spinbutton", { name: "red" });
	fireEvent.change(red, { target: { value: "200" } });
	fireEvent.blur(red);
	await waitFor(() => expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe("rgba(200, 34, 51, 1)"));
});

test("color area completion records exact color through the supported callback", async () => {
	await ready();
	fireEvent.click(screen.getByRole("button", { name: "Text Color color area" }));
	expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe("rgba(18, 52, 86, 1)");
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("rgba(18, 52, 86, 1)");
});
test("hue slider completion updates controlled color and recent palette", async () => {
	await ready();
	fireEvent.change(screen.getByRole("slider", { name: "Text Color hue" }), { target: { value: "120" } });
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("rgba(17, 51, 17, 1)");
	expect(JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors")!)[0]).toBe("rgba(17, 51, 17, 1)");
});

test("actor personal Pro does not unlock the Free creator theme editor", async () => {
	validateAuth.mockResolvedValue({ id: "actor", plan: "pro", avatar: "" });
	getOverlayOwnerPlan.mockResolvedValue("free");
	await ready();
	expect(await screen.findByText("Pro Feature Locked")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeInTheDocument();
});

test("creator Pro keeps theme editing available when actor personal plan is Free", async () => {
	validateAuth.mockResolvedValue({ id: "actor", plan: "free", avatar: "" });
	getOverlayOwnerPlan.mockResolvedValue("pro");
	await ready();
	expect(screen.queryByText("Pro Feature Locked")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Reset Theme" }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeTextColor: "#FFFFFF" }), 7));
});

test("nullable legacy style displays defaults and reset preserves unrelated playback volume", async () => {
	getOverlay.mockResolvedValue({ ...saved, themeFontFamily: null, themeTextColor: null, themeAccentColor: null, themeBackgroundColor: null, progressBarStartColor: null, progressBarEndColor: null, borderSize: null, borderRadius: null, channelInfoX: null, channelInfoY: null, clipInfoX: null, clipInfoY: null, timerX: null, timerY: null, channelScale: null, clipScale: null, timerScale: null });
	await ready();
	expect(screen.getByRole("textbox", { name: "Text Color" })).toHaveValue("rgba(255, 255, 255, 1)");
	expect(screen.getByRole("textbox", { name: "Background Color" })).toHaveValue("rgba(10, 10, 10, 0.65)");
	fireEvent.click(screen.getByRole("button", { name: "Reset Theme" }));
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ playerVolume: 83, themeFontFamily: "inherit", themeTextColor: "#FFFFFF", themeAccentColor: "#7C3AED" }), 7));
});

test("unavailable overlay keeps private style controls hidden without requesting owner plan", async () => {
	getOverlay.mockResolvedValue(null);
	render(<Page />);
	await waitFor(() => expect(getOverlay).toHaveBeenCalledWith("overlay-1"));
	expect(getOverlayOwnerPlan).not.toHaveBeenCalled();
	expect(screen.queryByRole("button", { name: "Save Style" })).not.toBeInTheDocument();
	expect(screen.getByText("Loading overlay style editor")).toBeInTheDocument();
});
test.each(["||url||", "Inter||url||"])("incomplete legacy font setting %s does not load an empty stylesheet", async (font) => {
	getOverlay.mockResolvedValue({ ...saved, themeFontFamily: font });
	await ready();
	expect(document.head.querySelector('link[id^="theme-font-"]')).toBeNull();
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
});
test("cleared Google font family falls back to a usable Poppins source", async () => {
	await ready();
	fireEvent.click(screen.getByRole("tab", { name: "Google" }));
	const family = screen.getByRole("textbox", { name: "Google Font Family" });
	fireEvent.change(family, { target: { value: "" } });
	expect(family).toHaveValue("Poppins");
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeFontFamily: "Poppins, sans-serif||url||https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" }), 7));
});

test.each([
	{ width: 0, height: 500 },
	{ width: 1000, height: 0 },
])("unmeasurable preview $width by $height does not dirty saved coordinates", async ({ width, height }) => {
	Object.defineProperty(window, "PointerEvent", { value: MouseEvent, writable: true, configurable: true });
	jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) } as DOMRect);
	await ready();
	fireEvent.pointerDown(box("channel"), { clientX: 10, clientY: 10 });
	fireEvent.pointerMove(window, { clientX: 500, clientY: 250 });
	fireEvent.pointerUp(window);
	expect(screen.getByRole("button", { name: "Save Style" })).toBeDisabled();
	expect(saveOverlay).not.toHaveBeenCalled();
});

test("quoted font family preserves the saved complete font stack", async () => {
	await ready();
	fireEvent.click(screen.getByRole("tab", { name: "Google" }));
	fireEvent.change(screen.getByRole("textbox", { name: "Google Font Family" }), { target: { value: "''" } });
	fireEvent.click(screen.getByRole("button", { name: "Save Style" }));
	await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ themeFontFamily: "'', sans-serif" }), 7));
});
