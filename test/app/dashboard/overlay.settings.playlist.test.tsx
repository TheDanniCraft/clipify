import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const getOverlay = jest.fn();
const getOverlayOwnerPlan = jest.fn();
const getClipCacheStatus = jest.fn();
const getPlaylistsForOwner = jest.fn();
const saveOverlay = jest.fn();
const savePlaylist = jest.fn();
const upsertPlaylistClips = jest.fn();
const validateAuth = jest.fn();
const getTwitchClips = jest.fn();
const router = { push: jest.fn() };
const getCachedClipsByOwner = jest.fn();
const getGameDetails = jest.fn();
const getTwitchGames = jest.fn();
const previewImportPlaylistClips = jest.fn();
const createPlaylist = jest.fn();
const getReward = jest.fn();
const createChannelReward = jest.fn();
const removeChannelReward = jest.fn();
const titleBlocked = jest.fn();
const navigationGuard = { active: false, reject: jest.fn(), accept: jest.fn() };
const mockFieldContext = React.createContext<{ label: string; value?: string; input?: (value: string) => void; select?: (value: string) => void; open: boolean; setOpen: (open: boolean) => void }>({ label: "", open: false, setOpen: () => undefined });
const mockNumberContext = React.createContext<{ label: string; value: number; change?: (value: number) => void }>({ label: "", value: 0 });
const mockSliderContext = React.createContext<number[]>([]);
const mockTableContext = React.createContext<{ selectedKeys?: Set<string> | string; onSelectionChange?: (keys: Set<string>) => void; sortDescriptor?: { column: string; direction: string }; onSortChange?: (sort: { column: string; direction: string }) => void }>({});
const mockRowContext = React.createContext<string | undefined>(undefined);
function mockFieldLabel(children: React.ReactNode): string {
	for (const child of React.Children.toArray(children)) {
		if (React.isValidElement<{ children?: React.ReactNode }>(child) && typeof child.props.children === "string") return child.props.children;
	}
	return "Field";
}

jest.mock("next/navigation", () => ({
	useRouter: () => router,
	useParams: () => ({ overlayId: "overlay-1" }),
}));

jest.mock("nextjs-nav-guard", () => ({
	useNavigationGuard: () => navigationGuard,
}));

jest.mock("@actions/database", () => ({
	getOverlay: (...args: unknown[]) => getOverlay(...args),
	getOverlayOwnerPlan: (...args: unknown[]) => getOverlayOwnerPlan(...args),
	getClipCacheStatus: (...args: unknown[]) => getClipCacheStatus(...args),
	getPlaylistsForOwner: (...args: unknown[]) => getPlaylistsForOwner(...args),
	createPlaylist: (...args: unknown[]) => createPlaylist(...args),
	previewImportPlaylistClips: (...args: unknown[]) => previewImportPlaylistClips(...args),
	importPlaylistClips: jest.fn(),
	reorderPlaylistClips: jest.fn(),
	upsertPlaylistClips: (...args: unknown[]) => upsertPlaylistClips(...args),
	savePlaylist: (...args: unknown[]) => savePlaylist(...args),
	saveOverlay: (...args: unknown[]) => saveOverlay(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/twitch", () => ({
	getTwitchClips: (...args: unknown[]) => getTwitchClips(...args),
	getCachedClipsByOwner: (...args: unknown[]) => getCachedClipsByOwner(...args),
	getGameDetails: (...args: unknown[]) => getGameDetails(...args),
	getTwitchGames: (...args: unknown[]) => getTwitchGames(...args),
	getReward: (...args: unknown[]) => getReward(...args),
	createChannelReward: (...args: unknown[]) => createChannelReward(...args),
	removeChannelReward: (...args: unknown[]) => removeChannelReward(...args),
	handleClip: jest.fn(),
}));

jest.mock("@lib/twitchErrors", () => ({
	REWARD_NOT_FOUND: "not-found",
}));

jest.mock("@/app/utils/regexFilter", () => ({
	isTitleBlocked: (...args: unknown[]) => titleBlocked(...args),
}));

jest.mock("next-plausible", () => ({
	usePlausible: () => jest.fn(),
}));

jest.mock("@lib/paywallTracking", () => ({
	trackPaywallEvent: jest.fn(),
}));

jest.mock("@lib/featureAccess", () => ({
	getTrialDaysLeft: () => 0,
	isReverseTrialActive: () => false,
}));

jest.mock("@components/dashboardNavbar", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@components/SentryFeedbackWidget", () => ({
	__esModule: true,
	default: () => <div />,
}));

jest.mock("@components/upgradeModal", () => ({
	__esModule: true,
	default: () => <div />,
}));

jest.mock("@components/chatwootData", () => ({
	__esModule: true,
	default: () => <div />,
}));

jest.mock("@components/tagsInput", () => ({
	__esModule: true,
	default: ({ label, onValueChange }: { label: string; onValueChange: (values: string[]) => void }) => <input aria-label={label} onChange={(event) => onValueChange(event.target.value.split(","))} />,
}));

jest.mock("@tabler/icons-react", () => new Proxy({}, { get: () => () => <span /> }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
jest.mock("@components/appDateRangePicker", () => ({
	__esModule: true,
	default: ({ label, onChange }: { label: string; onChange: (range: { start: { toString: () => string }; end: { toString: () => string } } | null) => void }) => (
		<div>
			{label}
			<button type='button' onClick={() => onChange({ start: { toString: () => "2026-09-01" }, end: { toString: () => "2026-09-30" } })}>
				Set {label}
			</button>
			<button type='button' onClick={() => onChange(null)}>
				Clear {label}
			</button>
		</div>
	),
}));

jest.mock("@heroui/react", () => {
	jest.requireActual<typeof import("react")>("react");
	return {
		addToast: jest.fn(),
		useOverlayState: () => {
			const [isOpen, setOpen] = React.useState(false);
			return { isOpen, open: () => setOpen(true), close: () => setOpen(false), setOpen, toggle: () => setOpen((open) => !open) };
		},
		Button: ({ children, onPress, onClick, isDisabled, isIconOnly: _iconOnly, variant: _variant, size: _size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onPress?: () => void; isDisabled?: boolean; isIconOnly?: boolean; variant?: string; size?: string }) => (
			<button {...props} type={props.type ?? "button"} disabled={isDisabled} onClick={() => (onPress ? onPress() : onClick ? onClick({} as React.MouseEvent<HTMLButtonElement>) : undefined)}>
				{children}
			</button>
		),
		Form: ({ children, onSubmit }: { children: React.ReactNode; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) => <form onSubmit={onSubmit}>{children}</form>,
		TextField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Description: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		Alert: Object.assign(({ children }: { children: React.ReactNode }) => <div role='alert'>{children}</div>, { Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Description: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Indicator: () => <span /> }),
		Chip: Object.assign(({ children }: { children: React.ReactNode }) => <span>{children}</span>, { Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }),
		Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
		FieldError: () => null,
		Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
			const field = React.useContext(mockFieldContext);
			return (
				<input
					{...props}
					{...(field.input
						? {
								"aria-label": field.label,
								value: field.value,
								onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
									field.input?.(event.target.value);
									field.setOpen(true);
								},
							}
						: {})}
				/>
			);
		},
		InputGroup: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Prefix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Suffix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} value={props.value ?? ""} />,
		}),
		CloseButton: ({ onPress, "aria-label": label }: { onPress?: () => void; "aria-label"?: string }) => <button type='button' aria-label={label ?? "Clear"} onClick={onPress} />,
		Select: Object.assign(
			({ children, value, onChange }: { children: React.ReactNode; value?: string; onChange?: (value: string) => void }) => {
				const [open, setOpen] = React.useState(false);
				return <mockFieldContext.Provider value={{ label: mockFieldLabel(children), value, select: onChange, open, setOpen }}>{children}</mockFieldContext.Provider>;
			},
			{
				Trigger: ({ children }: { children: React.ReactNode }) => {
					const field = React.useContext(mockFieldContext);
					return (
						<button type='button' aria-label={field.label} onClick={() => field.setOpen(!field.open)}>
							{children}
							{field.value}
						</button>
					);
				},
				Value: () => null,
				Indicator: () => null,
				Popover: ({ children }: { children: React.ReactNode }) => {
					const field = React.useContext(mockFieldContext);
					return field.open ? <div>{children}</div> : null;
				},
			},
		),
		ComboBox: Object.assign(
			({ children, inputValue, onInputChange, onSelectionChange }: { children?: React.ReactNode; inputValue?: string; onInputChange?: (value: string) => void; onSelectionChange?: (value: string) => void }) => {
				const [open, setOpen] = React.useState(false);
				return <mockFieldContext.Provider value={{ label: mockFieldLabel(children), value: inputValue, input: onInputChange, select: onSelectionChange, open, setOpen }}>{children}</mockFieldContext.Provider>;
			},
			{
				InputGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
				Trigger: () => {
					const field = React.useContext(mockFieldContext);
					return <button type='button' aria-label={`Open ${field.label}`} onClick={() => field.setOpen(!field.open)} />;
				},
				Popover: ({ children }: { children: React.ReactNode }) => {
					const field = React.useContext(mockFieldContext);
					return field.open ? <div>{children}</div> : null;
				},
			},
		),
		ListBox: Object.assign(({ children, items = [], renderEmptyState }: { children?: React.ReactNode | ((item: unknown) => React.ReactNode); items?: unknown[]; renderEmptyState?: () => React.ReactNode }) => <div>{typeof children === "function" ? (items.length ? items.map((item, index) => <div key={index}>{children(item)}</div>) : renderEmptyState?.()) : children}</div>, {
			Item: ({ children, id }: { children?: React.ReactNode; id: string }) => {
				const field = React.useContext(mockFieldContext);
				return (
					<button
						type='button'
						role='option'
						aria-selected={field.value === id}
						onClick={() => {
							field.select?.(id);
							field.setOpen(false);
						}}
					>
						{children}
					</button>
				);
			},
			ItemIndicator: () => null,
		}),
		Switch: Object.assign(
			({ children, isSelected, onChange, "aria-label": label }: { children: React.ReactNode; isSelected?: boolean; onChange?: (checked: boolean) => void; "aria-label"?: string }) => (
				<label>
					<input type='checkbox' aria-label={label} checked={isSelected ?? false} onChange={(event) => onChange?.(event.target.checked)} />
					{children}
				</label>
			),
			{
				Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
				Control: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
				Thumb: () => <span />,
				Icon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			},
		),
		Checkbox: Object.assign(
			({ children, isSelected, onChange, "aria-label": label }: { children?: React.ReactNode; isSelected?: boolean; onChange?: (selected: boolean) => void; "aria-label"?: string }) => {
				const table = React.useContext(mockTableContext);
				const row = React.useContext(mockRowContext);
				return (
					<label>
						<input
							type='checkbox'
							aria-label={label}
							checked={isSelected ?? (row ? table.selectedKeys instanceof Set && table.selectedKeys.has(row) : false)}
							onChange={(event) => {
								if (onChange) onChange(event.target.checked);
								else if (row && table.onSelectionChange) {
									const keys = new Set(table.selectedKeys instanceof Set ? table.selectedKeys : []);
									if (event.target.checked) keys.add(row);
									else keys.delete(row);
									table.onSelectionChange(keys);
								}
							}}
						/>
						{children}
					</label>
				);
			},
			{
				Content: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
				Control: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
				Indicator: () => null,
			},
		),
		Slider: Object.assign(
			({ children, value, onChange, isDisabled }: { children?: React.ReactNode; value: number | number[]; onChange?: (value: number | number[]) => void; isDisabled?: boolean }) => {
				const values = Array.isArray(value) ? value : [value];
				const label = mockFieldLabel(children);
				return (
					<mockSliderContext.Provider value={values}>
						<div>
							{children}
							{values.map((current, index) => (
								<input
									key={index}
									type='range'
									aria-label={`${label}${values.length > 1 ? (index === 0 ? " minimum" : " maximum") : ""}`}
									value={current}
									disabled={isDisabled}
									onChange={(event) => {
										const next = [...values];
										next[index] = Number(event.target.value);
										onChange?.(Array.isArray(value) ? next : next[0]);
									}}
								/>
							))}
						</div>
					</mockSliderContext.Provider>
				);
			},
			{
				Output: () => null,
				Track: ({ children }: { children?: React.ReactNode | ((value: { state: { values: number[] } }) => React.ReactNode) }) => {
					const values = React.useContext(mockSliderContext);
					return <div>{typeof children === "function" ? children({ state: { values } }) : children}</div>;
				},
				Fill: () => null,
				Thumb: () => null,
			},
		),
		NumberField: Object.assign(
			({ children, value, defaultValue, onChange, isDisabled }: { children?: React.ReactNode; value?: number; defaultValue?: number; onChange?: (value: number) => void; isDisabled?: boolean }) => (
				<mockNumberContext.Provider value={{ label: mockFieldLabel(children), value: value ?? defaultValue ?? 0, change: onChange }}>
					<fieldset disabled={isDisabled}>{children}</fieldset>
				</mockNumberContext.Provider>
			),
			{
				Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
				Input: () => {
					const field = React.useContext(mockNumberContext);
					return <input type='number' aria-label={field.label} value={field.value} onChange={(event) => field.change?.(Number(event.target.value))} />;
				},
				IncrementButton: () => <button type='button'>+</button>,
				DecrementButton: () => <button type='button'>-</button>,
			},
		),
		DateRangePicker: ({ label }: { label?: string }) => <div>{label}</div>,
		Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		Separator: () => <div />,
		Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
		Modal: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Backdrop: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) => (isOpen ? <div role='dialog'>{children}</div> : null),
			Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			CloseTrigger: () => null,
			Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Heading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		Table: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
			ScrollContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Content: ({ children, selectedKeys, onSelectionChange, sortDescriptor, onSortChange }: { children?: React.ReactNode; selectedKeys?: Set<string> | string; onSelectionChange?: (keys: Set<string>) => void; sortDescriptor?: { column: string; direction: string }; onSortChange?: (sort: { column: string; direction: string }) => void }) => (
				<mockTableContext.Provider value={{ selectedKeys, onSelectionChange, sortDescriptor, onSortChange }}>
					<div>{children}</div>
				</mockTableContext.Provider>
			),
			Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Column: ({ children, id, allowsSorting }: { children?: React.ReactNode | ((props: { sortDirection: null }) => React.ReactNode); id?: string; allowsSorting?: boolean }) => {
				const table = React.useContext(mockTableContext);
				const content = typeof children === "function" ? children({ sortDirection: null }) : children;
				return allowsSorting && id ? (
					<button type='button' onClick={() => table.onSortChange?.({ column: id, direction: table.sortDescriptor?.column === id && table.sortDescriptor.direction === "ascending" ? "descending" : "ascending" })}>
						{content}
					</button>
				) : (
					<div>{content}</div>
				);
			},
			SortableColumnHeader: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
			Body: ({ children, renderEmptyState }: { children?: React.ReactNode; renderEmptyState?: () => React.ReactNode }) => <div>{React.Children.count(children) ? children : renderEmptyState?.()}</div>,
			Row: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
				<mockRowContext.Provider value={id}>
					<div role='row'>{children}</div>
				</mockRowContext.Provider>
			),
			Cell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Footer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		}),
		TableHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		TableColumn: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		TableBody: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		TableRow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		TableCell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Snippet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
		Tooltip: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
			Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		}),
	};
});

function buildOverlay() {
	return {
		id: "overlay-1",
		configurationRevision: 4,
		ownerId: "owner-1",
		secret: "secret",
		name: "Playlist Overlay",
		status: "active",
		type: "Playlist",
		playlistId: "playlist-1",
		rewardId: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		lastUsedAt: null,
		minClipDuration: 0,
		maxClipDuration: 60,
		maxDurationMode: "filter",
		minClipViews: 0,
		blacklistWords: [],
		categoriesOnly: [] as string[],
		categoriesBlocked: [] as string[],
		playbackMode: "random",
		preferCurrentCategory: false,
		clipCreatorsOnly: [],
		clipCreatorsBlocked: [],
		clipPackSize: 100,
		playerVolume: 50,
		showChannelInfo: true,
		showClipInfo: true,
		showTimer: false,
		showProgressBar: false,
		overlayInfoFadeOutSeconds: 6,
		themeFontFamily: "inherit",
		themeTextColor: "#FFFFFF",
		themeAccentColor: "#7C3AED",
		themeBackgroundColor: "rgba(10,10,10,0.65)",
		progressBarStartColor: "#26018E",
		progressBarEndColor: "#8D42F9",
		borderSize: 0,
		borderRadius: 10,
		effectScanlines: false,
		effectStatic: false,
		effectCrt: false,
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
}

describe("dashboard overlay settings playlist mode", () => {
	const clip = (id: string, extras: Record<string, unknown> = {}) => ({ id, title: `Clip ${id}`, thumbnail_url: "https://example.invalid/clip.png", url: `https://clips.twitch.tv/${id}`, created_at: "2026-10-05T00:00:00Z", duration: 10, game_id: "", creator_name: "Maker", creator_id: "maker", view_count: 1, ...extras });
	async function openPage() {
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		return screen.findByDisplayValue("Playlist Overlay");
	}
	async function press(name: string | RegExp) {
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name }));
		});
	}
	async function submit() {
		await act(async () => {
			fireEvent.submit(screen.getByRole("button", { name: "Save Overlay Settings" }).closest("form")!);
		});
	}
	async function change(input: HTMLElement, value: string) {
		await act(async () => {
			fireEvent.change(input, { target: { value } });
		});
	}
	it("redirects an unauthenticated user to logout", async () => {
		validateAuth.mockResolvedValue(null);
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		expect(router.push).toHaveBeenCalledWith("/logout");
	});
	it("saves the selected status and preserves normalized backend results", async () => {
		await openPage();
		await act(async () => {
			fireEvent.click(screen.getByRole("checkbox", { name: "Set overlay status" }));
		});
		await submit();
		expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ status: "paused" }), 4);
	});
	it("navigates to the theme studio and owned playlist editor", async () => {
		await openPage();
		await press("Customize Overlay Style");
		expect(router.push).toHaveBeenCalledWith("/dashboard/overlay/overlay-1/theme");
		await press("Manage");
		expect(router.push).toHaveBeenCalledWith("/dashboard/playlist/playlist-1");
	});
	it.each(["free", "pro"])("remote controller respects the current owner %s plan", async (plan) => {
		getOverlayOwnerPlan.mockResolvedValue(plan);
		const popup = jest.spyOn(window, "open").mockImplementation(() => null);
		try {
			await openPage();
			const button = screen.getByRole("button", { name: "Open remote controller" });
			if (plan === "free") {
				expect(button).toBeDisabled();
				expect(popup).not.toHaveBeenCalled();
			} else {
				await press("Open remote controller");
				expect(popup).toHaveBeenCalledWith("http://localhost/controller/overlay-1", "_blank", "noopener,noreferrer");
			}
		} finally {
			popup.mockRestore();
		}
	});
	it.each(["1", "7", "30", "90", "180", "365", "Featured", "All", "Queue"])("source %s clears playlist binding and normalizes ordered playback", async (type) => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), playbackMode: "order" });
		await openPage();
		await press("Overlay Type");
		await act(async () => {
			fireEvent.click(screen.getByRole("option", { name: ({ "1": "Top Clips - Today", "7": "Top Clips - Last 7 Days", "30": "Top Clips - Last 30 Days", "90": "Top Clips - Last 90 Days", "180": "Top Clips - Last 180 Days", "365": "Top Clips - Last Year", Featured: "Featured only", All: "All Clips", Queue: "Clip Queue" } as Record<string, string>)[type] }));
		});
		await submit();
		expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ type, playlistId: null, playbackMode: "random" }), 4);
	});
	it("updates advanced owner filters through their real controls", async () => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", playlistId: null });
		await openPage();
		await change(screen.getByRole("slider", { name: "Filter clips by duration (seconds) minimum" }), "5");
		await change(screen.getByRole("slider", { name: "Filter clips by duration (seconds) maximum" }), "25");
		await change(screen.getByRole("spinbutton", { name: "Minimum Clip Views" }), "20");
		await change(screen.getByRole("textbox", { name: "Creator Allowlist" }), "maker");
		await change(screen.getByRole("textbox", { name: "Creator Denylist" }), "blocked");
		await change(screen.getByRole("textbox", { name: "Blacklisted Words" }), "spoiler");
		await submit();
		expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ minClipDuration: 5, maxClipDuration: 25, minClipViews: 20, clipCreatorsOnly: ["maker"], clipCreatorsBlocked: ["blocked"], blacklistWords: ["spoiler"] }), 4);
	});
	it.each(["random", "order", "top", "smart_shuffle"])("preview includes the appropriate owned clip pool in %s playback", async (mode) => {
		const clips = Array.from({ length: 15 }, (_, index) => clip(String(index), { view_count: index + 1, creator_id: index % 2 ? "maker-a" : "maker-b", game_id: "" }));
		getOverlay.mockResolvedValue({ ...buildOverlay(), playbackMode: mode });
		getTwitchClips.mockResolvedValue(clips);
		await openPage();
		await press("15");
		const items = within(screen.getByRole("dialog")).getAllByRole("listitem");
		expect(items).toHaveLength(mode === "smart_shuffle" ? 12 : 15);
		if (mode === "top") expect(items[0]).toHaveTextContent("Clip 14");
		fireEvent.click(screen.getByRole("checkbox", { name: "Review mode" }));
		expect(within(screen.getByRole("dialog")).getAllByRole("listitem")).toHaveLength(15);
	});
	it.each([
		{ label: "minimum duration", patch: { minClipDuration: 11 }, expected: 0 },
		{ label: "maximum duration", patch: { maxClipDuration: 9 }, expected: 0 },
		{ label: "minimum views", patch: { minClipViews: 2 }, expected: 0 },
		{ label: "blocked title", patch: { blacklistWords: ["Clip"] }, expected: 0, blocked: true },
		{ label: "other creator allowlist", patch: { clipCreatorsOnly: ["another"] }, expected: 0 },
		{ label: "creator name allowlist", patch: { clipCreatorsOnly: ["maker"] }, expected: 1 },
		{ label: "creator id allowlist", patch: { clipCreatorsOnly: ["maker"] }, expected: 1, clipPatch: { creator_name: "Display name" } },
		{ label: "creator name denylist", patch: { clipCreatorsBlocked: ["maker"] }, expected: 0 },
		{ label: "creator id denylist", patch: { clipCreatorsBlocked: ["maker"] }, expected: 0, clipPatch: { creator_name: "Display name" } },
		{ label: "other category allowlist", patch: { categoriesOnly: ["another"] }, expected: 0 },
		{ label: "matched category", patch: { categoriesOnly: ["game"] }, expected: 1 },
		{ label: "blocked category", patch: { categoriesBlocked: ["game"] }, expected: 0 },
	])("preview respects the saved %s filter", async ({ patch, expected, blocked, clipPatch }) => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", playlistId: null, ...patch });
		getTwitchClips.mockResolvedValue([clip("filtered", { game_id: "game", ...clipPatch })]);
		titleBlocked.mockReturnValue(blocked === true);
		await openPage();
		await press(String(expected));
		const dialog = screen.getByRole("dialog");
		expect(within(dialog).queryAllByRole("listitem")).toHaveLength(expected);
	});
	it.each([
		{ type: "All", status: { backfillComplete: false }, warning: "All-time crawl is still syncing." },
		{ type: "All", status: { backfillComplete: true }, warning: null },
		{ type: "7", status: { oldestClipDate: null }, warning: "Selected time range is not fully cached yet." },
		{ type: "7", status: { oldestClipDate: "not-a-date" }, warning: "Selected time range is not fully cached yet." },
		{ type: "7", status: { oldestClipDate: "2016-01-01" }, warning: null },
		{ type: "Queue", status: { backfillComplete: false }, warning: null },
		{ type: "Featured", status: { backfillComplete: false }, warning: null },
	])("cache coverage indicator reflects %p", async ({ type, status, warning }) => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type, playlistId: null });
		getClipCacheStatus.mockResolvedValue(status);
		await openPage();
		if (warning) expect(screen.getByText(new RegExp(warning))).toBeInTheDocument();
		else expect(screen.queryByText(/still syncing|not fully cached/)).not.toBeInTheDocument();
	});
	it.each(["found", "not-found", "unavailable", "conflict"])("reward metadata %s uses the owned overlay revision and safe feedback", async (mode) => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), rewardId: "reward" });
		if (mode === "found") getReward.mockResolvedValue({ id: "reward", title: "Reward title" });
		else getReward.mockRejectedValueOnce(new Error(mode === "unavailable" ? "private provider failure" : "not-found"));
		if (mode === "conflict") saveOverlay.mockResolvedValueOnce(null);
		await openPage();
		expect(getReward).toHaveBeenCalledWith("owner-1", "reward");
		if (mode === "not-found" || mode === "conflict") expect(saveOverlay).toHaveBeenCalledWith("overlay-1", { rewardId: null }, 4);
		if (mode === "conflict") expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to update reward", color: "danger" }));
		if (mode === "unavailable") expect(saveOverlay).not.toHaveBeenCalled();
	});
	it.each([true, false])("creating a provider reward with result=%s only binds a returned owned reward", async (available) => {
		createChannelReward.mockResolvedValue(available ? { id: "created", title: "Created reward" } : null);
		getReward.mockResolvedValue({ id: "created", title: "Created reward" });
		await openPage();
		await press("Create Reward");
		expect(createChannelReward).toHaveBeenCalledWith("owner-1");
		if (available) {
			await submit();
			expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ rewardId: "created" }), 4);
		} else expect(saveOverlay).not.toHaveBeenCalled();
	});
	it.each([1, 2])("quick playlist drag preserves its preview after %s hover events and drop", async (hovers) => {
		const clips = ["first", "second"].map((id) => ({ id, title: `Clip ${id}`, thumbnail_url: "https://example.invalid/clip.png", created_at: "2026-10-05T00:00:00Z", duration: 10, game_id: "", creator_name: "Maker", creator_id: "maker", view_count: 1 }));
		getTwitchClips.mockResolvedValue(clips);
		getPlaylistsForOwner.mockResolvedValue([{ id: "playlist-1", name: "Roadmap", clipCount: 2, configurationRevision: 3 }]);
		upsertPlaylistClips.mockResolvedValue({ clips: [clips[1], clips[0]], name: "Roadmap", configurationRevision: 4 });
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Quick edit playlist" }));
		});
		const dialog = screen.getByRole("dialog");
		const first = within(dialog).getByText("Clip first").closest("li")!;
		const second = within(dialog).getByText("Clip second").closest("li")!;
		fireEvent.dragStart(first);
		for (let index = 0; index < hovers; index++) fireEvent.dragOver(second);
		expect(within(dialog).getAllByRole("listitem")[0]).toHaveTextContent("Clip second");
		fireEvent.drop(second);
		fireEvent.dragEnd(first);
		expect(within(dialog).getByRole("button", { name: "Save Playlist" })).toBeEnabled();
		await act(async () => {
			fireEvent.click(within(dialog).getByRole("button", { name: "Save Playlist" }));
		});
		expect(upsertPlaylistClips.mock.calls[0][1].map((clip: { id: string }) => clip.id)).toEqual(["second", "first"]);
	});

	it("TDD-BROWSER-ITEMS-005 opens the owned playlist quick editor without leaving overlay settings", async () => {
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		await screen.findByDisplayValue("Playlist Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Quick edit playlist" }));
		});
		expect(screen.getByRole("dialog")).toHaveTextContent("Manage Playlist: Roadmap");
		expect(screen.getByPlaceholderText("Playlist name")).toHaveValue("Roadmap");
		expect(router.push).not.toHaveBeenCalled();
	});
	beforeEach(() => {
		jest.clearAllMocks();
		titleBlocked.mockReturnValue(false);
		navigationGuard.active = false;
		getCachedClipsByOwner.mockResolvedValue([]);
		getGameDetails.mockResolvedValue(null);
		getTwitchGames.mockResolvedValue([]);
		previewImportPlaylistClips.mockResolvedValue([]);
		validateAuth.mockResolvedValue({
			id: "owner-1",
			plan: "pro",
		});
		getOverlay.mockResolvedValue(buildOverlay());
		getOverlayOwnerPlan.mockResolvedValue("pro");
		getClipCacheStatus.mockResolvedValue(null);
		getPlaylistsForOwner.mockResolvedValue([{ id: "playlist-1", name: "Roadmap", clipCount: 3 }]);
		getTwitchClips.mockResolvedValue([]);
		saveOverlay.mockResolvedValue(buildOverlay());
		savePlaylist.mockResolvedValue({ id: "playlist-1", name: "Roadmap", clipCount: 3 });
	});

	it("adds selected cached clips to the inline draft without persisting before Save", async () => {
		getCachedClipsByOwner.mockResolvedValue([clip("cached-one"), clip("cached-two")]);
		await openPage();
		await press("Quick edit playlist");
		await press("Add clips");
		await screen.findByText("Select clips to add");
		const checkbox = await screen.findByRole("checkbox", { name: "Select Clip cached-one" });
		await act(async () => {
			fireEvent.click(checkbox);
		});
		const picker = checkbox.closest("[role='dialog']") as HTMLElement;
		const add = within(picker).getByRole("button", { name: /Add.*selected/i });
		expect(add).toBeEnabled();
		await act(async () => {
			fireEvent.click(add);
		});
		expect(screen.getByText("Clip cached-one")).toBeInTheDocument();
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
	});

	it.each(["success", "stale", "error"])("saves a name-only inline edit with its revision: %s", async (outcome) => {
		getPlaylistsForOwner.mockResolvedValue([{ id: "playlist-1", name: "Roadmap", clipCount: 0, configurationRevision: 3 }]);
		if (outcome === "success") savePlaylist.mockResolvedValue({ id: "playlist-1", name: "New name", configurationRevision: 4 });
		else if (outcome === "stale") savePlaylist.mockResolvedValue(null);
		else savePlaylist.mockRejectedValue(new Error("fixture save failure"));
		await openPage();
		await press("Quick edit playlist");
		await change(screen.getByPlaceholderText("Playlist name"), " New name ");
		await press("Save Playlist");
		expect(savePlaylist).toHaveBeenCalledWith("playlist-1", { name: "New name" }, 3);
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
		const title = outcome === "success" ? "Playlist saved" : outcome === "stale" ? "Playlist changed or access was updated. Reload and try again." : "Playlist could not be saved. Try again.";
		expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title }));
	});

	it.each(["success", "error", "non-error"])("auto imports into an empty draft without writing items: %s", async (outcome) => {
		if (outcome === "success") previewImportPlaylistClips.mockResolvedValue([clip("imported")]);
		else previewImportPlaylistClips.mockRejectedValue(outcome === "error" ? new Error("Provider unavailable") : "unavailable");
		await openPage();
		await press("Quick edit playlist");
		await press("Auto import");
		await press("Import");
		expect(previewImportPlaylistClips).toHaveBeenCalledWith("playlist-1", expect.objectContaining({ categoryId: "all", minViews: 0 }));
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
		if (outcome === "success") expect(screen.getByText("Clip imported")).toBeInTheDocument();
		else expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Import failed", description: outcome === "error" ? "Provider unavailable" : "Please try again." }));
	});

	it("offers the Pro upgrade instead of importing for a Free owner", async () => {
		getOverlayOwnerPlan.mockResolvedValue("free");
		await openPage();
		await press("Quick edit playlist");
		await press("Auto import");
		expect(screen.getByText("Auto Import Requires Pro")).toBeInTheDocument();
		expect(previewImportPlaylistClips).not.toHaveBeenCalled();
	});

	it.each(["append", "replace"])("confirms %s import and preserves draft-only semantics", async (mode) => {
		getTwitchClips.mockResolvedValue([clip("existing")]);
		previewImportPlaylistClips.mockResolvedValue([clip("imported")]);
		await openPage();
		await press("Quick edit playlist");
		await press("Auto import");
		await press("Import");
		expect(previewImportPlaylistClips).not.toHaveBeenCalled();
		expect(screen.getByText("Import Behavior")).toBeInTheDocument();
		await press(mode === "append" ? "Append" : "Replace");
		expect(screen.getByText("Clip imported")).toBeInTheDocument();
		expect(screen.queryByText("Clip existing") !== null).toBe(mode === "append");
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
	});

	it.each(["Allowed Games / Categories", "Blocked Games / Categories"])("searches, selects and removes an advanced category: %s", async (label) => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", playlistId: null });
		saveOverlay.mockImplementation(async (_id, data) => ({ ...buildOverlay(), ...data }));
		getTwitchGames.mockResolvedValue([{ id: "game-1", name: "Puzzle", box_art_url: "", igdb_id: "" }]);
		await openPage();
		await change(screen.getByRole("textbox", { name: label }), "Puzzle");
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 450));
		});
		expect(getTwitchGames).toHaveBeenCalledWith("Puzzle", "owner-1");
		await act(async () => {
			fireEvent.click(screen.getByRole("option", { name: "Puzzle" }));
		});
		await submit();
		const field = label.startsWith("Allowed") ? "categoriesOnly" : "categoriesBlocked";
		expect(saveOverlay).toHaveBeenLastCalledWith("overlay-1", expect.objectContaining({ [field]: ["game-1"] }), expect.anything());
		await press("Remove Puzzle");
		await submit();
		expect(saveOverlay).toHaveBeenLastCalledWith("overlay-1", expect.objectContaining({ [field]: [] }), expect.anything());
	});

	it.each(["success", "null", "error"])("creates a playlist from the selector: %s", async (outcome) => {
		if (outcome === "success") createPlaylist.mockResolvedValue({ id: "new-playlist", name: "New Playlist" });
		else if (outcome === "null") createPlaylist.mockResolvedValue(null);
		else createPlaylist.mockRejectedValue(new Error("creation denied"));
		await openPage();
		await press("Playlist");
		await act(async () => {
			fireEvent.click(screen.getByRole("option", { name: "Create new playlist..." }));
		});
		expect(createPlaylist).toHaveBeenCalledWith("owner-1", "New Playlist");
		if (outcome === "success") expect(router.push).toHaveBeenCalledWith("/dashboard/playlist/new-playlist");
		if (outcome === "error") expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to create playlist" }));
	});

	it.each(["Clip", "Creator", "Category", "Views", "Date"])("sorts cached clips in both directions by %s", async (column) => {
		getCachedClipsByOwner.mockResolvedValue([clip("a", { creator_name: "Alpha", game_id: "a", view_count: 1, created_at: "2026-09-01T00:00:00Z" }), clip("z", { creator_name: "Zulu", game_id: "z", view_count: 9, created_at: "2026-09-30T00:00:00Z" })]);
		getGameDetails.mockImplementation(async (id) => ({ id, name: id === "a" ? "Alpha" : "Zulu", box_art_url: "", igdb_id: "" }));
		await openPage();
		await press("Quick edit playlist");
		await press("Add clips");
		await screen.findByRole("checkbox", { name: "Select Clip a" });
		await press(column);
		expect(screen.getAllByRole("row")[0]).toHaveTextContent("Clip a");
		await press(column);
		expect(screen.getAllByRole("row")[0]).toHaveTextContent("Clip z");
	});

	it.each(["title", "creator", "category", "missing"])("filters cached clips by %s and clears the filter", async (field) => {
		getCachedClipsByOwner.mockResolvedValue([clip("a", { creator_name: "Maker One", game_id: "a" }), clip("z", { creator_name: "Maker Two", game_id: "z" })]);
		getGameDetails.mockImplementation(async (id) => ({ id, name: id === "a" ? "Puzzle" : "Racing", box_art_url: "", igdb_id: "" }));
		await openPage();
		await press("Quick edit playlist");
		await press("Add clips");
		await screen.findByRole("checkbox", { name: "Select Clip a" });
		await change(screen.getByPlaceholderText("Search by title or creator..."), { title: "Clip a", creator: "Maker One", category: "Puzzle", missing: "absent" }[field]!);
		if (field === "missing") expect(screen.getByText("No clips found in cache.")).toBeInTheDocument();
		else {
			expect(screen.getAllByRole("row")).toHaveLength(1);
			expect(screen.getAllByRole("row")[0]).toHaveTextContent("Clip a");
		}
		const picker = screen.getByPlaceholderText("Search by title or creator...").closest("[role='dialog']") as HTMLElement;
		await act(async () => {
			fireEvent.click(within(picker).getByRole("button", { name: "Clear" }));
		});
		expect(screen.getAllByRole("row")).toHaveLength(2);
	});

	it("passes chosen import filters and dates to the preview service", async () => {
		await openPage();
		await press("Quick edit playlist");
		await press("Auto import");
		await press("Set Date Range");
		for (const [label, value] of [
			["Minimum Views", "100"],
			["Min Duration (sec)", "5"],
			["Max Duration (sec)", "30"],
			["Creator Allowlist", "one"],
			["Creator Denylist", "two"],
			["Blacklisted Words", "skip"],
		])
			await change(screen.getByRole(label.includes("Views") || label.includes("Duration") ? "spinbutton" : "textbox", { name: label }), value);
		await press("Import");
		expect(previewImportPlaylistClips).toHaveBeenCalledWith("playlist-1", expect.objectContaining({ startDate: "2026-09-01", endDate: "2026-09-30", minViews: 100, minDuration: 5, maxDuration: 30, clipCreatorsOnly: ["one"], clipCreatorsBlocked: ["two"], blacklistWords: ["skip"] }));
	});

	it("resolves preconfigured category names and retains unresolved category labels", async () => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", categoriesOnly: ["known", "missing"], playlistId: null });
		getGameDetails.mockImplementation(async (id) => (id === "known" ? { id, name: "Puzzle", box_art_url: "", igdb_id: "" } : null));
		await openPage();
		expect(await screen.findByRole("button", { name: "Remove Puzzle" })).toBeInTheDocument();
		expect(await screen.findByRole("button", { name: "Remove Game missing" })).toBeInTheDocument();
	});

	it("selects a searched importer category and returns to All Categories after clearing", async () => {
		getTwitchGames.mockResolvedValue([
			{ id: "puzzle", name: "Puzzle", box_art_url: "", igdb_id: "" },
			{ id: "puzzle-two", name: "Puzzle Two", box_art_url: "", igdb_id: "" },
			{ id: "other", name: "Other", box_art_url: "", igdb_id: "" },
		]);
		await openPage();
		await press("Quick edit playlist");
		await press("Auto import");
		await change(screen.getByPlaceholderText("Type at least 3 characters or choose all"), "Puzzle");
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350));
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("option", { name: "Puzzle" }));
		});
		await press("Clear category");
		expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
		await press("Open Category");
		await act(async () => {
			fireEvent.click(screen.getByRole("option", { name: "All categories" }));
		});
		await press("Clear Date Range");
		await press("Import");
		expect(previewImportPlaylistClips).toHaveBeenCalledWith("playlist-1", expect.objectContaining({ categoryId: "all", endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
	});

	it("clears a resolved reward through the owning account before saving", async () => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), rewardId: "reward-1" });
		getReward.mockResolvedValue({ id: "reward-1", title: "Play clip" });
		await openPage();
		await screen.findByDisplayValue("Play clip");
		await press("Clear");
		await submit();
		expect(removeChannelReward).toHaveBeenCalledWith("reward-1", "owner-1");
		expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ rewardId: null }), expect.anything());
	});

	it("reports a rejected overlay save without a success notification", async () => {
		saveOverlay.mockRejectedValue(new Error("denied"));
		await openPage();
		await submit();
		expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Could not save overlay", color: "danger" }));
		expect(jest.requireMock("@lib/toast").notify).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Overlay settings saved" }));
	});

	it("keeps or discards a dirty draft through the navigation guard", async () => {
		navigationGuard.active = true;
		await openPage();
		await press("Cancel");
		await press("Discard Changes");
		expect(navigationGuard.reject).toHaveBeenCalledTimes(1);
		expect(navigationGuard.accept).toHaveBeenCalledTimes(1);
	});

	it("preselects existing cached clips and merges additions without duplicates", async () => {
		getTwitchClips.mockResolvedValue([clip("a")]);
		getCachedClipsByOwner.mockResolvedValue([clip("a"), clip("b")]);
		await openPage();
		await press("Quick edit playlist");
		await press("Add clips");
		const picker = screen.getByText("Select clips to add").closest("[role='dialog']") as HTMLElement;
		const selected = await within(picker).findByRole("checkbox", { name: "Select Clip a" });
		expect(selected).toBeChecked();
		await act(async () => {
			fireEvent.click(within(picker).getByRole("checkbox", { name: "Select Clip b" }));
		});
		await press("Add selected clips");
		expect(screen.getAllByText("Clip a")).toHaveLength(1);
		expect(screen.getByText("Clip b")).toBeInTheDocument();
	});

	it("selects, clears and removes individual inline draft items", async () => {
		getTwitchClips.mockResolvedValue([clip("a"), clip("b")]);
		await openPage();
		await press("Quick edit playlist");
		await act(async () => {
			fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip a" }));
		});
		expect(screen.getByRole("button", { name: "Remove selected (1)" })).toBeEnabled();
		await press("Clear");
		expect(screen.getByRole("checkbox", { name: "Select Clip a" })).not.toBeChecked();
		await act(async () => {
			fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip a" }));
			fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip a" }));
		});
		const row = screen.getByText("Clip a").closest("li")!;
		await act(async () => {
			fireEvent.dragEnd(row);
			fireEvent.click(within(row).getByRole("button"));
		});
		expect(screen.queryByText("Clip a")).not.toBeInTheDocument();
		expect(screen.getByText("Clip b")).toBeInTheDocument();
	});

	it.each(["Allowed Games / Categories", "Blocked Games / Categories", "Category"])("shows empty, short and unmatched search feedback for %s", async (label) => {
		if (label !== "Category") getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", playlistId: null });
		await openPage();
		if (label === "Category") {
			await press("Quick edit playlist");
			await press("Auto import");
			await press("Clear category");
		}
		await press(`Open ${label}`);
		if (label !== "Category") expect(screen.getByText("Type to search...")).toBeInTheDocument();
		await change(screen.getByRole("textbox", { name: label }), "ab");
		if (label !== "Category") expect(screen.getByText("Keep typing...")).toBeInTheDocument();
		await change(screen.getByRole("textbox", { name: label }), "nomatch");
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 450));
		});
		if (label !== "Category") expect(screen.getByText("No games found.")).toBeInTheDocument();
		expect(getTwitchGames).toHaveBeenCalledWith("nomatch", "owner-1");
	});

	it.each(["owner", "delegate"])("enforces the advanced-feature paywall for a Free %s", async (actor) => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", playlistId: null });
		getOverlayOwnerPlan.mockResolvedValue("free");
		validateAuth.mockResolvedValue({ id: actor === "owner" ? "owner-1" : "delegate-1", plan: "free" });
		await openPage();
		const upgrade = screen.getByRole("button", { name: "Upgrade to Pro" });
		if (actor === "delegate") {
			expect(upgrade).toBeDisabled();
			expect(screen.getByText("Only the overlay owner can unlock Pro features.")).toBeInTheDocument();
		} else {
			await press("Upgrade to Pro");
			await press("Upgrade now");
			expect(jest.requireMock("@lib/paywallTracking").trackPaywallEvent).toHaveBeenCalledWith(expect.anything(), "paywall_cta_click", expect.objectContaining({ feature: "advanced_filters" }));
		}
		expect(screen.getByRole("button", { name: "Create Reward" })).toBeDisabled();
	});

	it("falls back safely when the playlist list is unavailable and the overlay has no secret", async () => {
		getPlaylistsForOwner.mockResolvedValue(null);
		getOverlay.mockResolvedValue({ ...buildOverlay(), secret: null, playlistId: null, type: "All" });
		await openPage();
		expect(screen.getByText("Missing secret. Refresh this page to generate one.")).toBeInTheDocument();
		await press("Overlay Type");
		await act(async () => {
			fireEvent.click(screen.getByRole("option", { name: "Playlist" }));
		});
		expect(screen.getByRole("button", { name: "Manage" })).toBeDisabled();
		await submit();
		expect(saveOverlay).toHaveBeenCalledWith("overlay-1", expect.objectContaining({ playlistId: null }), expect.anything());
	});

	it("keeps unique clips in a Smart Shuffle pool with tied views and missing creator IDs", async () => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), playbackMode: "smart_shuffle" });
		getTwitchClips.mockResolvedValue(Array.from({ length: 14 }, (_, index) => clip(String(index), { view_count: 1, creator_id: "", game_id: index % 2 ? "" : "game", created_at: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z` })));
		await openPage();
		await press("14");
		const dialog = screen.getByText("Preview Clips").closest("[role='dialog']") as HTMLElement;
		expect(within(dialog).getAllByRole("listitem")).toHaveLength(12);
	});

	it.each(["stale", "error"])("preserves an item draft on a failed combined save: %s", async (outcome) => {
		getPlaylistsForOwner.mockResolvedValue([{ id: "playlist-1", name: "Roadmap", clipCount: 1, configurationRevision: 3 }]);
		getTwitchClips.mockResolvedValue([clip("a")]);
		if (outcome === "stale") upsertPlaylistClips.mockResolvedValue(null);
		else upsertPlaylistClips.mockRejectedValue(new Error("denied"));
		await openPage();
		await press("Quick edit playlist");
		await press("Select all");
		await press("Remove selected (1)");
		await press("Save Playlist");
		expect(jest.requireMock("@lib/toast").notify).toHaveBeenCalledWith(expect.objectContaining({ title: outcome === "stale" ? "Playlist changed or access was updated. Reload and try again." : "Playlist could not be saved. Try again." }));
		expect(jest.requireMock("@lib/toast").notify).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Playlist saved" }));
		expect(screen.getByRole("button", { name: "Save Playlist" })).toBeEnabled();
	});

	it("accepts legacy absent filter arrays in a non-playlist preview", async () => {
		getOverlay.mockResolvedValue({ ...buildOverlay(), type: "All", playlistId: null, categoriesOnly: undefined, categoriesBlocked: undefined, clipCreatorsOnly: undefined, clipCreatorsBlocked: undefined });
		getTwitchClips.mockResolvedValue([clip("a")]);
		await openPage();
		await press("1");
		expect(screen.getByText("Clip a")).toBeInTheDocument();
	});

	it("reorders a direct drop without a prior hover", async () => {
		getTwitchClips.mockResolvedValue([clip("a"), clip("b")]);
		await openPage();
		await press("Quick edit playlist");
		const from = screen.getByText("Clip a").closest("li")!;
		const to = screen.getByText("Clip b").closest("li")!;
		await act(async () => {
			fireEvent.dragStart(from);
		});
		await act(async () => {
			fireEvent.drop(to);
		});
		expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Clip b");
	});

	it("ranks normalized category matches ahead of less exact results", async () => {
		getTwitchGames.mockResolvedValue(["X Game", "Game II", "Ga-me", "Game Z", "Game A"].map((name, index) => ({ id: String(index), name, box_art_url: "", igdb_id: "" })));
		await openPage();
		await press("Quick edit playlist");
		await press("Auto import");
		await change(screen.getByRole("textbox", { name: "Category" }), "game");
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350));
		});
		const options = screen.getAllByRole("option");
		expect(options.map((option) => option.textContent)).toEqual(["All categories", "Ga-me", "Game A", "Game II", "Game Z", "X Game"]);
	});

	it("renders playlist controls and submits playlistId in save payload", async () => {
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(<Page />);

		await screen.findByDisplayValue("Playlist Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Quick edit playlist" }));
		expect(await screen.findByText("Playlist name")).toBeInTheDocument();

		fireEvent.submit(screen.getByRole("button", { name: "Save Overlay Settings" }).closest("form") as HTMLFormElement);

		await waitFor(() => {
			expect(saveOverlay).toHaveBeenCalledWith(
				"overlay-1",
				expect.objectContaining({
					type: "Playlist",
					playlistId: "playlist-1",
				}),
				4,
			);
		});
	});

	it("TDD-BROWSER-OVERLAY-SAVE-004 an obsolete initial read cannot erase a typed draft", async () => {
		let releaseOld!: (value: unknown) => void;
		getOverlay
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						releaseOld = resolve;
					}),
			)
			.mockResolvedValueOnce(buildOverlay());
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(
			<React.StrictMode>
				<Page />
			</React.StrictMode>,
		);
		const input = await screen.findByDisplayValue("Playlist Overlay");
		fireEvent.change(input, { target: { value: "Typed draft" } });
		await act(async () => {
			releaseOld(buildOverlay());
		});
		expect(screen.getByDisplayValue("Typed draft")).toBeInTheDocument();
	});
	it("TDD-BROWSER-OVERLAY-SAVE-003 adopts committed normalization and revision for the next save", async () => {
		const committed = { ...(buildOverlay() as any), name: "Normalized", configurationRevision: 5 };
		saveOverlay.mockResolvedValueOnce(committed);
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(<Page />);
		await screen.findByDisplayValue("Playlist Overlay");
		fireEvent.submit(screen.getByRole("button", { name: "Save Overlay Settings" }).closest("form") as HTMLFormElement);
		await screen.findByDisplayValue("Normalized");
		fireEvent.change(screen.getByDisplayValue("Normalized"), { target: { value: "Next edit" } });
		fireEvent.submit(screen.getByRole("button", { name: "Save Overlay Settings" }).closest("form") as HTMLFormElement);
		await waitFor(() => expect(saveOverlay).toHaveBeenLastCalledWith("overlay-1", expect.objectContaining({ name: "Next edit" }), 5));
	});
	it("TDD-BROWSER-OVERLAY-SAVE-003 rejected save shows reload guidance without success", async () => {
		saveOverlay.mockResolvedValueOnce(null);
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(<Page />);
		await screen.findByDisplayValue("Playlist Overlay");
		fireEvent.submit(screen.getByRole("button", { name: "Save Overlay Settings" }).closest("form") as HTMLFormElement);
		const { notify: addToast } = jest.requireMock("@lib/toast");
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ description: "Overlay changed or access was updated. Reload and try again.", color: "danger" })));
		expect(addToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Overlay settings saved" }));
	});
	it("TDD-BROWSER-ITEMS-005 overlay playlist editor sends one combined save at its loaded revision", async () => {
		getPlaylistsForOwner.mockResolvedValue([{ id: "playlist-1", name: "Roadmap", clipCount: 1, configurationRevision: 3 }]);
		getTwitchClips.mockResolvedValue([{ id: "ClipFirst", title: "Fixture clip", thumbnail_url: "https://example.invalid/clip.png", created_at: "2026-10-05T00:00:00Z", duration: 10 }]);
		upsertPlaylistClips.mockResolvedValue({ clips: [], configurationRevision: 4, name: "Renamed" });
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(<Page />);
		await screen.findByDisplayValue("Playlist Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Quick edit playlist" }));
		const input = await screen.findByPlaceholderText("Playlist name");
		await waitFor(() => expect(input).toHaveValue("Roadmap"));
		await waitFor(() => expect(screen.getByRole("button", { name: "Remove selected (0)" })).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Select all" }));
		fireEvent.click(await screen.findByRole("button", { name: "Remove selected (1)" }));
		fireEvent.change(input, { target: { value: "Renamed" } });
		fireEvent.click(screen.getByRole("button", { name: "Save Playlist" }));
		await waitFor(() => expect(upsertPlaylistClips).toHaveBeenCalledWith("playlist-1", [], "replace", 3, "Renamed"));
		expect(savePlaylist).not.toHaveBeenCalled();
	});
});
