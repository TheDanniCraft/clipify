import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GalleryEditor from "@components/gallery/GalleryEditor";
import { buildClip, buildGallery } from "../../gallery/fixtures";

const saveGallery = jest.fn();
const getGalleryDraftPreview = jest.fn();
const notify = jest.fn();
const push = jest.fn();
let previewGallery = buildGallery();
let previewClips = [buildClip("initial")];

jest.mock("@actions/gallery", () => ({ saveGallery: (...args: unknown[]) => saveGallery(...args), getGalleryDraftPreview: (...args: unknown[]) => getGalleryDraftPreview(...args) }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@components/gallery/GalleryInlinePreview", () => ({
	__esModule: true,
	default: ({ gallery, clips, isUpdating, hasError }: { gallery: ReturnType<typeof buildGallery>; clips: ReturnType<typeof buildClip>[]; isUpdating?: boolean; hasError?: boolean }) => {
		previewGallery = gallery;
		previewClips = clips;
		return (
			<div data-testid='preview'>
				{gallery.name}:{gallery.layout}:{gallery.theme}:{clips.map((clip) => clip.id).join(",")}:{isUpdating ? "updating" : "ready"}:{hasError ? "error" : "ok"}
			</div>
		);
	},
}));
jest.mock("@components/codeSnippet", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <code>{children}</code> }));
jest.mock("@components/tagsInput", () => ({
	__esModule: true,
	default: ({ label, onValueChange, isDisabled }: { label: string; onValueChange: (value: string[]) => void; isDisabled?: boolean }) => (
		<button type='button' disabled={isDisabled} onClick={() => onValueChange([`${label}-value`])}>
			{label}
		</button>
	),
}));
jest.mock("@components/appDateRangePicker", () => ({
	__esModule: true,
	default: ({ onChange }: { onChange: (value: { start: { toString(): string }; end: { toString(): string } } | null) => void }) => (
		<>
			<button type='button' onClick={() => onChange({ start: { toString: () => "2026-07-01" }, end: { toString: () => "2026-07-31" } })}>
				Set date range
			</button>
			<button type='button' onClick={() => onChange(null)}>
				Clear date range
			</button>
		</>
	),
}));

jest.mock("@heroui/react", () => {
	const React = require("react");
	const options = ["curated", "live", "none", "playlist-owner", "newest", "most_viewed", "stable_random", "today", "7d", "30d", "all", "custom", "grid", "list", "carousel", "compact", "comfortable", "system", "light", "dark", "transparent", "solid"];
	const Div = React.forwardRef(({ children, ...props }: any, ref: any) => (
		<div ref={ref} {...props}>
			{children}
		</div>
	));
	Div.displayName = "MockDiv";
	const Compound = new Proxy(Div, { get: (target, property) => (property in target ? target[property] : Compound) });
	const Button = React.forwardRef(({ children, onPress, isDisabled, isPending, ...props }: any, ref: any) => (
		<button ref={ref} disabled={isDisabled || isPending} onClick={onPress} {...props}>
			{children}
		</button>
	));
	Button.displayName = "MockButton";
	const SelectRoot = ({ children, value, onChange, isDisabled }: any) => (
		<div>
			{children}
			<select data-testid='select' data-current={value} value={value} disabled={isDisabled} onChange={(event) => onChange(event.target.value)}>
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</div>
	);
	const Select = Object.assign(SelectRoot, { Trigger: Div, Value: Div, Indicator: Div, Popover: Div });
	const NumberRoot = ({ children, value, onChange, minValue, maxValue, isDisabled }: any) => (
		<div>
			{children}
			<input data-testid='number' type='number' value={value} min={minValue} max={maxValue} disabled={isDisabled} onChange={(event) => onChange(Number(event.target.value))} />
		</div>
	);
	const NumberField = Object.assign(NumberRoot, { Group: Div, DecrementButton: Div, Input: Div, IncrementButton: Div });
	const SwitchRoot = ({ children, isSelected, onChange, isDisabled, ...props }: any) => (
		<button type='button' data-testid='switch' aria-pressed={isSelected} disabled={isDisabled} onClick={() => onChange(!isSelected)} {...props}>
			{children}
		</button>
	);
	const Switch = Object.assign(SwitchRoot, { Content: Div, Control: Div, Thumb: Div, Icon: Div });
	const CheckboxRoot = ({ children, isSelected, onChange, isDisabled }: any) => (
		<button type='button' data-testid='checkbox' aria-pressed={isSelected} disabled={isDisabled} onClick={() => onChange(!isSelected)}>
			{children}
		</button>
	);
	const Checkbox = Object.assign(CheckboxRoot, { Content: Div, Control: Div, Indicator: Div });
	const ColorRoot = ({ children, onChange }: any) => (
		<div>
			{children}
			<button type='button' data-testid='color' onClick={() => onChange({ toString: (format: string) => (format === "rgba" ? "rgba(1,2,3,.5)" : "#010203") })}>
				Choose color
			</button>
		</div>
	);
	const ColorPicker = Object.assign(ColorRoot, { Trigger: Div, Popover: Div });
	const Form = React.forwardRef((props: any, ref: any) => <form ref={ref} {...props} />);
	Form.displayName = "MockForm";
	const Input = React.forwardRef((props: any, ref: any) => <input ref={ref} {...props} />);
	Input.displayName = "MockInput";
	const parseColor = (value: string) => {
		if (value === "invalid") throw new Error("invalid");
		return { toString: () => value };
	};
	const components: Record<PropertyKey, any> = { Alert: Compound, Button, Card: Compound, Checkbox, ColorArea: Compound, ColorField: Compound, ColorPicker, ColorSlider: Compound, ColorSwatch: Div, ColorSwatchPicker: Compound, Description: Div, FieldError: Div, Form, Input, Label: Div, ListBox: Compound, NumberField, parseColor, Select, Separator: Div, Switch, TextField: Div, Tooltip: Compound };
	return new Proxy(components, { get: (target, property) => (property in target ? target[property] : Compound) });
});

const playlist = (id: string, ownerId: string, name: string) => ({ id, ownerId, name, createdAt: new Date(), updatedAt: new Date() }) as never;
const selectWith = (value: string) => screen.getAllByTestId("select").find((element) => element.getAttribute("data-current") === value) as HTMLSelectElement;

describe("GalleryEditor", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		previewGallery = buildGallery();
		previewClips = [buildClip("initial")];
		saveGallery.mockImplementation(async (_id, next) => next);
		getGalleryDraftPreview.mockImplementation(async (_id, patch) => ({ clips: patch.source === "live" ? [buildClip("live-preview")] : [] }));
	});

	it("refreshes source and filter clips live without saving", async () => {
		jest.useFakeTimers();
		try {
			render(<GalleryEditor initialGallery={buildGallery({ source: "curated", playlistId: "playlist-owner" })} playlists={[playlist("playlist-owner", "owner", "Owner playlist")]} canUseAdvanced canUseStyling previewClips={[buildClip("curated-preview")]} previewOwnerName='Alice' showPreviewAttribution={false} />);
			expect(previewClips.map((clip) => clip.id)).toEqual(["curated-preview"]);
			fireEvent.change(selectWith("curated"), { target: { value: "live" } });
			expect(previewGallery.playlistId).toBeNull();
			expect(previewClips).toEqual([]);
			expect(screen.getByTestId("preview")).toHaveTextContent("updating");
			await act(async () => {
				jest.advanceTimersByTime(200);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(getGalleryDraftPreview).toHaveBeenCalledWith("gallery-1", expect.objectContaining({ source: "live", playlistId: null }));
			expect(previewClips.map((clip) => clip.id)).toEqual(["live-preview"]);
			expect(screen.getByText("All time")).toBeInTheDocument();
			expect(saveGallery).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});

	it("shows draft preview failures and keeps internal navigation in the router", async () => {
		jest.useFakeTimers();
		try {
			getGalleryDraftPreview.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("preview failed"));
			render(<GalleryEditor initialGallery={buildGallery({ source: "live", liveSort: "newest" })} playlists={[]} canUseAdvanced canUseStyling previewClips={[buildClip("initial")]} previewOwnerName='Alice' showPreviewAttribution={false} />);

			fireEvent.change(selectWith("newest"), { target: { value: "most_viewed" } });
			await act(async () => {
				jest.advanceTimersByTime(200);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(screen.getByTestId("preview")).toHaveTextContent("error");
			expect(screen.getByTestId("preview")).toHaveTextContent("ready");

			fireEvent.change(selectWith("most_viewed"), { target: { value: "newest" } });
			await act(async () => {
				jest.advanceTimersByTime(200);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(screen.getByTestId("preview")).toHaveTextContent("error");

			fireEvent.click(screen.getByRole("button", { name: "Open in Tools" }));
			expect(push).toHaveBeenCalledWith("/dashboard/tools?tool=gallery&gallery=gallery-1");
		} finally {
			jest.useRealTimers();
		}
	});

	it("renders the dashboard style, filters playlists, navigates, publishes, edits, and saves", async () => {
		render(<GalleryEditor initialGallery={buildGallery({ published: false })} playlists={[playlist("playlist-owner", "owner", "Owner playlist"), playlist("foreign", "other", "Foreign playlist")]} canUseAdvanced canUseStyling previewClips={[buildClip("one")]} previewOwnerName='Alice' showPreviewAttribution />);
		expect(screen.getByText("Gallery Settings")).toBeInTheDocument();
		expect(screen.getByText("Draft")).toBeInTheDocument();
		expect(screen.getByText("Website Preview")).toBeInTheDocument();
		expect(screen.getByText("gallery-1")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
		expect(push).toHaveBeenCalledWith("/dashboard");

		fireEvent.click(screen.getByRole("button", { name: "Set gallery publication status" }));
		expect(screen.getByText("Published")).toBeInTheDocument();
		fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Updated gallery" } });
		fireEvent.change(selectWith("live"), { target: { value: "curated" } });
		expect(screen.getByText("Owner playlist")).toBeInTheDocument();
		expect(screen.queryByText("Foreign playlist")).not.toBeInTheDocument();
		fireEvent.change(selectWith("none"), { target: { value: "playlist-owner" } });

		fireEvent.click(screen.getByRole("button", { name: "Save Gallery Settings" }));
		await waitFor(() => expect(saveGallery).toHaveBeenCalledWith("gallery-1", expect.objectContaining({ name: "Updated gallery", published: true, source: "curated", playlistId: "playlist-owner" })));
		expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Gallery settings saved", color: "success" }));
	});

	it("updates every layout family, metadata option, advanced filter, and custom range", () => {
		render(<GalleryEditor initialGallery={buildGallery({ gridAuto: true, liveTimeWindow: "custom", liveCustomStart: new Date("2026-06-01"), liveCustomEnd: new Date("2026-06-30") })} playlists={[]} canUseAdvanced canUseStyling previewClips={[]} previewOwnerName='Alice' showPreviewAttribution={false} />);
		fireEvent.click(screen.getByRole("button", { name: "Set date range" }));
		expect(previewGallery.liveCustomStart).toEqual(new Date("2026-07-01T00:00:00"));
		fireEvent.click(screen.getByRole("button", { name: "Clear date range" }));
		expect(previewGallery.liveCustomStart).toBeNull();

		fireEvent.change(selectWith("grid"), { target: { value: "list" } });
		fireEvent.change(selectWith("comfortable"), { target: { value: "compact" } });
		expect(previewGallery.listDensity).toBe("compact");
		fireEvent.change(selectWith("list"), { target: { value: "carousel" } });
		for (const input of screen.getAllByTestId("number").slice(1, 4)) fireEvent.change(input, { target: { value: "2" } });
		for (const checkbox of screen.getAllByTestId("checkbox")) fireEvent.click(checkbox);
		expect(previewGallery.layout).toBe("carousel");
		expect(previewGallery.showTitle).toBe(false);

		for (const label of ["Included Category IDs", "Excluded Category IDs", "Title Blacklist", "Creator Allowlist", "Creator Blocklist"]) fireEvent.click(screen.getByRole("button", { name: label }));
		expect(previewGallery.includeCategories).toEqual(["Included Category IDs-value"]);
	});

	it("supports Pro styling, color fallback, alpha colors, and reset", () => {
		render(<GalleryEditor initialGallery={buildGallery({ accentColor: "invalid", theme: "dark", backgroundMode: "solid", cardRadius: 30, gap: 40, desktopModalWidth: 1200 })} playlists={[]} canUseAdvanced canUseStyling previewClips={[]} previewOwnerName='Alice' showPreviewAttribution={false} />);
		fireEvent.change(selectWith("dark"), { target: { value: "light" } });
		fireEvent.change(selectWith("solid"), { target: { value: "transparent" } });
		const colorButtons = screen.getAllByTestId("color");
		for (const button of colorButtons) fireEvent.click(button);
		expect(previewGallery.theme).toBe("light");
		expect(previewGallery.accentColor).toBe("#010203");
		expect(previewGallery.modalBackdrop).toBe("rgba(1,2,3,.5)");

		fireEvent.click(screen.getByRole("button", { name: /Reset Theme/ }));
		expect(previewGallery).toMatchObject({ theme: "system", accentColor: "#7C3AED", backgroundMode: "transparent", cardRadius: 16, gap: 16, desktopModalWidth: 960 });
		fireEvent.click(screen.getAllByRole("button", { name: "Reset to default" })[0]);
		expect(previewGallery.accentColor).toBe("#7C3AED");
	});

	it("shows Free gates and sends users to pricing", () => {
		render(<GalleryEditor initialGallery={buildGallery()} playlists={[]} canUseAdvanced={false} canUseStyling={false} previewClips={[]} previewOwnerName='Alice' showPreviewAttribution />);
		expect(screen.getByText("Advanced live filters require Pro")).toBeInTheDocument();
		expect(screen.queryByText("Stable random")).not.toBeInTheDocument();
		expect(screen.queryByText("Custom dates")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "View Pro" }));
		expect(push).toHaveBeenCalledWith("/pricing");
		expect(screen.getByRole("button", { name: /Reset Theme/ })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Included Category IDs" })).toBeDisabled();
	});

	it("wires live, manual-grid, numeric-filter, carousel, and modal sizing controls", () => {
		render(<GalleryEditor initialGallery={buildGallery({ source: "live", layout: "grid", gridAuto: true })} playlists={[]} canUseAdvanced canUseStyling previewClips={[]} previewOwnerName='Alice' showPreviewAttribution={false} />);
		fireEvent.change(selectWith("newest"), { target: { value: "most_viewed" } });
		fireEvent.change(screen.getAllByTestId("select")[2], { target: { value: "7d" } });
		fireEvent.click(screen.getAllByTestId("switch").find((control) => control.textContent?.includes("Auto-responsive grid"))!);
		for (const input of screen.getAllByTestId("number")) fireEvent.change(input, { target: { value: "3" } });
		expect(previewGallery).toMatchObject({ liveSort: "most_viewed", liveTimeWindow: "7d", gridAuto: false, gridDesktopColumns: 3, minimumViews: 3, minimumDuration: 3, maximumDuration: 3, cardRadius: 3, gap: 3 });

		fireEvent.change(selectWith("grid"), { target: { value: "carousel" } });
		for (const input of screen.getAllByTestId("number")) fireEvent.change(input, { target: { value: "2" } });
		expect(previewGallery).toMatchObject({ carouselMobileCards: 2, carouselTabletCards: 2, carouselDesktopCards: 2, desktopModalWidth: 2 });
	});

	it("reports null and thrown save failures and always unlocks the form", async () => {
		const { rerender } = render(<GalleryEditor initialGallery={buildGallery()} playlists={[]} canUseAdvanced canUseStyling previewClips={[]} previewOwnerName='Alice' showPreviewAttribution={false} />);
		saveGallery.mockResolvedValueOnce(null);
		fireEvent.click(screen.getByRole("button", { name: "Save Gallery Settings" }));
		await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Save failed", description: "Gallery could not be saved" })));
		expect(screen.getByRole("button", { name: "Save Gallery Settings" })).not.toBeDisabled();

		saveGallery.mockRejectedValueOnce("unknown");
		rerender(<GalleryEditor initialGallery={buildGallery()} playlists={[]} canUseAdvanced canUseStyling previewClips={[]} previewOwnerName='Alice' showPreviewAttribution={false} />);
		fireEvent.click(screen.getByRole("button", { name: "Save Gallery Settings" }));
		await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Save failed", description: "Please try again." })));
	});
});
