import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { parseDate } from "@internationalized/date";

const getAllPlaylists = jest.fn();
const getPlaylistClips = jest.fn();
const previewImportPlaylistClips = jest.fn();
const savePlaylist = jest.fn();
const upsertPlaylistClips = jest.fn();
const validateAuth = jest.fn();
const getCachedClipsByOwner = jest.fn();
const getGamesDetailsBulk = jest.fn();
const getTwitchGames = jest.fn();
const featureAccess = jest.fn();
const router = { push: jest.fn() };
const notify = jest.fn();
const navigationGuard = { active: false, reject: jest.fn(), accept: jest.fn() };
const mockSelectionContext = React.createContext<{ selected: Set<string>; change?: (keys: Set<string>) => void }>({ selected: new Set() });
const mockRowContext = React.createContext("");
const mockTabContext = React.createContext<((key: string) => void) | undefined>(undefined);
const mockComboContext = React.createContext<{ value?: string; input?: (value: string) => void; select?: (key: string) => void }>({});
const mockSortContext = React.createContext<((sort: { column: string; direction: "ascending" | "descending" }) => void) | undefined>(undefined);

jest.mock("next/navigation", () => ({
	useRouter: () => router,
	useParams: () => ({ playlistId: "playlist-1" }),
}));

jest.mock("nextjs-nav-guard", () => ({
	useNavigationGuard: () => navigationGuard,
}));

jest.mock("@actions/database", () => ({
	getAllPlaylists: (...args: unknown[]) => getAllPlaylists(...args),
	getPlaylistClips: (...args: unknown[]) => getPlaylistClips(...args),
	previewImportPlaylistClips: (...args: unknown[]) => previewImportPlaylistClips(...args),
	savePlaylist: (...args: unknown[]) => savePlaylist(...args),
	upsertPlaylistClips: (...args: unknown[]) => upsertPlaylistClips(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/twitch", () => ({
	getCachedClipsByOwner: (...args: unknown[]) => getCachedClipsByOwner(...args),
	getGamesDetailsBulk: (...args: unknown[]) => getGamesDetailsBulk(...args),
	getTwitchGames: (...args: unknown[]) => getTwitchGames(...args),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: (...args: unknown[]) => featureAccess(...args),
}));

jest.mock("@components/dashboardNavbar", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@components/tagsInput", () => ({
	__esModule: true,
	default: ({ label, onValueChange }: { label: string; onValueChange: (values: string[]) => void }) => <input aria-label={label} onChange={(event) => onValueChange(event.target.value.split(","))} />,
}));

jest.mock("@tabler/icons-react", () => new Proxy({}, { get: () => () => <span /> }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@components/appDateRangePicker", () => ({
	__esModule: true,
	default: ({ label, onChange }: { label: string; onChange: (range: { start: ReturnType<typeof parseDate>; end: ReturnType<typeof parseDate> } | null) => void }) => (
		<div>
			{label}
			<button onClick={() => onChange({ start: parseDate("2026-01-01"), end: parseDate("2026-01-02") })}>Set date range</button>
			<button onClick={() => onChange(null)}>Clear date range</button>
		</div>
	),
}));
jest.mock("@components/appPagination", () => ({ __esModule: true, default: ({ page, onChange }: { page: number; onChange: (page: number) => void }) => <button onClick={() => onChange(page + 1)}>Next page</button> }));

jest.mock("@heroui/react", () => ({
	addToast: jest.fn(),
	useOverlayState: () => {
		const [isOpen, setOpen] = React.useState(false);
		return { isOpen, open: () => setOpen(true), close: () => setOpen(false), setOpen, toggle: () => setOpen((open) => !open) };
	},
	Button: ({ children, onPress, onClick, isDisabled, isIconOnly: _iconOnly, variant: _variant, size: _size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onPress?: () => void; isDisabled?: boolean; isIconOnly?: boolean; variant?: string; size?: string }) => (
		<button {...props} disabled={isDisabled} onClick={() => (onPress ? onPress() : onClick ? onClick({} as React.MouseEvent<HTMLButtonElement>) : undefined)}>
			{children}
		</button>
	),
	Form: ({ children, onSubmit }: { children?: React.ReactNode; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) => <form onSubmit={onSubmit}>{children}</form>,
	TextField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
		const context = React.useContext(mockComboContext);
		return <input {...props} {...(props.placeholder === "Search and add a game..." ? { value: context.value, onChange: (event: React.ChangeEvent<HTMLInputElement>) => context.input?.(event.target.value) } : {})} />;
	},
	InputGroup: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
		Prefix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		Suffix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
	}),
	CloseButton: ({ onPress }: { onPress?: () => void }) => <button type='button' aria-label='Clear' onClick={onPress} />,
	Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
	ComboBox: Object.assign(({ children, inputValue, onInputChange, onSelectionChange }: { children?: React.ReactNode; inputValue?: string; onInputChange?: (value: string) => void; onSelectionChange?: (key: string) => void }) => <mockComboContext.Provider value={{ value: inputValue, input: onInputChange, select: onSelectionChange }}>{children}</mockComboContext.Provider>, {
		InputGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Trigger: () => null,
		Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	ListBox: Object.assign(({ children, items = [] }: { children?: React.ReactNode | ((item: unknown) => React.ReactNode); items?: unknown[] }) => <div>{typeof children === "function" ? items.map((item, index) => <div key={index}>{children(item)}</div>) : children}</div>, {
		Item: ({ children, id }: { children?: React.ReactNode; id: string }) => {
			const context = React.useContext(mockComboContext);
			return <button onClick={() => context.select?.(id)}>{children}</button>;
		},
		ItemIndicator: () => null,
	}),
	Card: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		Content: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	Checkbox: Object.assign(
		({ children, isSelected, onChange, "aria-label": label }: { children?: React.ReactNode; isSelected?: boolean; onChange?: (selected: boolean) => void; "aria-label"?: string }) => {
			const context = React.useContext(mockSelectionContext);
			const row = React.useContext(mockRowContext);
			return (
				<label>
					<input
						type='checkbox'
						aria-label={label}
						checked={isSelected ?? context.selected.has(row)}
						onChange={(event) => {
							if (onChange) onChange(event.target.checked);
							else if (context.change && row) {
								const next = new Set(context.selected);
								if (event.target.checked) next.add(row);
								else next.delete(row);
								context.change(next);
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
	DateRangePicker: () => <div />,
	Separator: () => <div />,
	Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
	Tabs: Object.assign(({ children, onSelectionChange }: { children?: React.ReactNode; onSelectionChange?: (key: string) => void }) => <mockTabContext.Provider value={onSelectionChange}>{children}</mockTabContext.Provider>, {
		ListContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		List: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Tab: ({ children, id }: { children?: React.ReactNode; id: string }) => {
			const change = React.useContext(mockTabContext);
			return <button onClick={() => change?.(id)}>{children}</button>;
		},
		Indicator: () => null,
	}),
	Modal: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		Backdrop: ({ children, isOpen }: { children?: React.ReactNode; isOpen?: boolean }) => (isOpen ? <div role='dialog'>{children}</div> : null),
		Container: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		CloseTrigger: () => null,
		Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Heading: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Body: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Footer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	NumberField: Object.assign(
		({ children, value, onChange }: { children?: React.ReactNode; value: number; onChange: (value: number) => void }) => (
			<div>
				{children}
				<input aria-label='Minimum Views' type='number' value={value} onChange={(event) => onChange(Number(event.target.value))} />
			</div>
		),
		{
			Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Input: () => <input type='number' />,
			IncrementButton: () => <button type='button'>+</button>,
			DecrementButton: () => <button type='button'>-</button>,
		},
	),
	Slider: Object.assign(
		({ children, value, onChange }: { children?: React.ReactNode; value: number[]; onChange: (value: number[]) => void }) => (
			<div>
				{children}
				<input type='range' aria-label='Minimum duration' value={value[0]} onChange={(event) => onChange([Number(event.target.value), value[1]])} />
				<input type='range' aria-label='Maximum duration' value={value[1]} onChange={(event) => onChange([value[0], Number(event.target.value)])} />
			</div>
		),
		{
			Track: ({ children }: { children?: React.ReactNode | ((props: { state: { values: number[] } }) => React.ReactNode) }) => <div>{typeof children === "function" ? children({ state: { values: [0, 60] } }) : children}</div>,
			Fill: () => <span />,
			Thumb: () => <span />,
		},
	),
	Pagination: () => <div />,
	Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
	Table: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		ScrollContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Content: ({ children, selectedKeys, onSelectionChange, onSortChange }: { children?: React.ReactNode; selectedKeys?: Set<string>; onSelectionChange?: (keys: Set<string>) => void; onSortChange?: (sort: { column: string; direction: "ascending" | "descending" }) => void }) => (
			<mockSelectionContext.Provider value={{ selected: selectedKeys ?? new Set(), change: onSelectionChange }}>
				<mockSortContext.Provider value={onSortChange}>{children}</mockSortContext.Provider>
			</mockSelectionContext.Provider>
		),
		Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Column: ({ children, id, allowsSorting }: { children?: React.ReactNode | ((props: { sortDirection: null }) => React.ReactNode); id?: string; allowsSorting?: boolean }) => {
			const change = React.useContext(mockSortContext);
			return (
				<div>
					{typeof children === "function" ? children({ sortDirection: null }) : children}
					{allowsSorting && id ? (
						<>
							<button onClick={() => change?.({ column: id, direction: "ascending" })}>Sort {id} ascending</button>
							<button onClick={() => change?.({ column: id, direction: "descending" })}>Sort {id} descending</button>
						</>
					) : null}
				</div>
			);
		},
		SortableColumnHeader: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
		Body: ({ children, renderEmptyState }: { children?: React.ReactNode; renderEmptyState?: () => React.ReactNode }) => <div>{React.Children.count(children) ? children : renderEmptyState?.()}</div>,
		Row: ({ children, id }: { children?: React.ReactNode; id: string }) => (
			<mockRowContext.Provider value={id}>
				<div role='row'>{children}</div>
			</mockRowContext.Provider>
		),
		Cell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Footer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	TableBody: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableCell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableColumn: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableRow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe("dashboard playlist page", () => {
	const clip = (id: string) => ({ id, title: `Clip ${id}`, creator_name: "Clip maker", creator_id: "maker", game_id: "", duration: 10, view_count: 2, created_at: "2026-10-05T00:00:00Z", thumbnail_url: "https://example.invalid/clip.png" });
	async function openPage() {
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		return screen.findByPlaceholderText("Playlist name");
	}
	async function press(name: string | RegExp) {
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name }));
		});
	}
	it("redirects an unauthenticated editor to logout", async () => {
		validateAuth.mockResolvedValue(null);
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		expect(router.push).toHaveBeenCalledWith("/logout");
	});
	it.each([null, []])("shows unavailable playlists without reading clips: %p", async (records) => {
		getAllPlaylists.mockResolvedValue(records);
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		expect(screen.getByText("Playlist not found")).toBeInTheDocument();
		expect(getPlaylistClips).not.toHaveBeenCalled();
	});
	it("saves a trimmed name and remembers the returned revision", async () => {
		savePlaylist.mockResolvedValue({ name: "Renamed", configurationRevision: 2 });
		const input = await openPage();
		fireEvent.change(input, { target: { value: " Renamed " } });
		await press("Save Playlist");
		expect(savePlaylist).toHaveBeenCalledWith("playlist-1", { name: "Renamed" }, 1);
		expect(input).toHaveValue("Renamed");
		expect(screen.getByRole("button", { name: "Save Playlist" })).toBeDisabled();
		expect(notify).toHaveBeenCalledWith({ title: "Playlist saved", color: "success" });
	});
	it("preserves the unsaved name after a rejected backend save", async () => {
		savePlaylist.mockRejectedValueOnce(new Error("private database diagnostic"));
		const input = await openPage();
		fireEvent.change(input, { target: { value: "Draft" } });
		await press("Save Playlist");
		expect(input).toHaveValue("Draft");
		expect(notify).toHaveBeenCalledWith({ title: "Playlist could not be saved. Try again.", color: "danger" });
	});
	it("keeps an empty or whitespace-only name from being saved", async () => {
		const input = await openPage();
		fireEvent.change(input, { target: { value: "  " } });
		expect(screen.getByRole("button", { name: "Save Playlist" })).toBeDisabled();
		expect(savePlaylist).not.toHaveBeenCalled();
	});
	it("shows the Free auto-import upgrade dialog and closes it", async () => {
		featureAccess.mockReturnValue({ allowed: false });
		await openPage();
		expect(screen.getByText("Free plan usage")).toBeInTheDocument();
		await press("Auto Import");
		expect(screen.getByText("Auto Import Requires Pro")).toBeInTheDocument();
		await press("Close");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(previewImportPlaylistClips).not.toHaveBeenCalled();
	});
	it("adds selected cached clips to the draft and saves them once", async () => {
		getCachedClipsByOwner.mockResolvedValue([clip("new")]);
		upsertPlaylistClips.mockResolvedValue({ clips: [clip("new")], configurationRevision: 2, name: "Shared" });
		await openPage();
		await press("Add Clips");
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip new" }));
		await press("Add selected clips");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
		await press("Save Playlist");
		expect(upsertPlaylistClips).toHaveBeenCalledWith("playlist-1", [expect.objectContaining({ id: "new" })], "replace", 1, undefined);
	});
	it.each(["append", "replace"])("reviews an import and applies %s to the draft before saving", async (mode) => {
		getPlaylistClips.mockResolvedValue([clip("old")]);
		previewImportPlaylistClips.mockResolvedValue([clip("new")]);
		await openPage();
		await press("Auto Import");
		await press("Import");
		expect(screen.getByText("Review imported clips")).toBeInTheDocument();
		if (mode === "replace") await press("Replace");
		await press(mode === "replace" ? "Replace 1 clip" : "Add 1 clip");
		expect(screen.getByText("Clip new")).toBeInTheDocument();
		if (mode === "replace") expect(screen.queryByText("Clip old")).not.toBeInTheDocument();
		else expect(screen.getByText("Clip old")).toBeInTheDocument();
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
		expect(notify).toHaveBeenCalledWith({ title: "Added 1 clips to draft", color: "success" });
	});
	it("cancels the cached clip picker without changing its draft", async () => {
		getCachedClipsByOwner.mockResolvedValue([clip("new")]);
		await openPage();
		await press("Add Clips");
		await press("Cancel");
		expect(screen.queryByText("Clip new")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save Playlist" })).toBeDisabled();
	});
	it("clears selection without removing saved clips", async () => {
		getPlaylistClips.mockResolvedValue([clip("saved")]);
		await openPage();
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip saved" }));
		await press("Clear");
		expect(screen.getByRole("checkbox", { name: "Select Clip saved" })).not.toBeChecked();
		expect(screen.getByText("Clip saved")).toBeInTheDocument();
	});
	it.each([1, 2])("reorders a draft by dragging with %s hover events and saves the resulting order", async (hovers) => {
		getPlaylistClips.mockResolvedValue([clip("first"), clip("second")]);
		upsertPlaylistClips.mockResolvedValue({ clips: [clip("second"), clip("first")], name: "Shared", configurationRevision: 2 });
		await openPage();
		const first = screen.getByText("Clip first").closest("li")!;
		const second = screen.getByText("Clip second").closest("li")!;
		fireEvent.dragOver(second);
		fireEvent.drop(second);
		fireEvent.dragStart(first);
		fireEvent.dragOver(first);
		for (let index = 0; index < hovers; index++) fireEvent.dragOver(second);
		expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Clip second");
		fireEvent.drop(second);
		fireEvent.dragEnd(first);
		expect(screen.getByRole("button", { name: "Save Playlist" })).toBeEnabled();
		await press("Save Playlist");
		expect(upsertPlaylistClips.mock.calls[0][1].map((entry: { id: string }) => entry.id)).toEqual(["second", "first"]);
	});
	it("removes one clip without removing the remaining selected clip", async () => {
		getPlaylistClips.mockResolvedValue([clip("first"), clip("second")]);
		await openPage();
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip first" }));
		const first = screen.getByText("Clip first").closest("li")!;
		await act(async () => {
			fireEvent.click(within(first).getByRole("button"));
		});
		expect(screen.queryByText("Clip first")).not.toBeInTheDocument();
		expect(screen.getByText("Clip second")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Remove selected (0)" })).toBeDisabled();
	});
	it("searches and clears cached clips by creator and resolved category", async () => {
		getCachedClipsByOwner.mockResolvedValue([{ ...clip("one"), game_id: "game", creator_name: "Specific maker" }, clip("two")]);
		getGamesDetailsBulk.mockResolvedValue([{ id: "game", name: "Specific category", box_art_url: "", igdb_id: "" }]);
		await openPage();
		await press("Add Clips");
		const input = screen.getByPlaceholderText("Search by title or creator...");
		fireEvent.change(input, { target: { value: "specific maker" } });
		expect(screen.getByText("Clip one")).toBeInTheDocument();
		expect(screen.queryByText("Clip two")).not.toBeInTheDocument();
		fireEvent.change(input, { target: { value: "specific category" } });
		expect(screen.getByText("Clip one")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
		});
		expect(screen.getByText("Clip two")).toBeInTheDocument();
	});
	it.each(["clip", "creator", "category", "views", "date"])("sorts cached clips by %s in both directions", async (column) => {
		getCachedClipsByOwner.mockResolvedValue([
			{ ...clip("a"), creator_name: "Alpha", game_id: "a", view_count: 1, created_at: "2026-01-01T00:00:00Z" },
			{ ...clip("z"), creator_name: "Zulu", game_id: "z", view_count: 9, created_at: "2026-02-01T00:00:00Z" },
		]);
		getGamesDetailsBulk.mockResolvedValue([
			{ id: "a", name: "Alpha" },
			{ id: "z", name: "Zulu" },
		]);
		await openPage();
		await press("Add Clips");
		await press(`Sort ${column} ascending`);
		expect(
			within(screen.getByRole("dialog"))
				.getAllByRole("row")
				.map((row) => row.textContent),
		).toEqual([expect.stringContaining("Clip a"), expect.stringContaining("Clip z")]);
		await press(`Sort ${column} descending`);
		expect(
			within(screen.getByRole("dialog"))
				.getAllByRole("row")
				.map((row) => row.textContent),
		).toEqual([expect.stringContaining("Clip z"), expect.stringContaining("Clip a")]);
	});
	it("blocks an addition above the Free limit while allowing the existing selection", async () => {
		featureAccess.mockReturnValue({ allowed: false });
		getPlaylistClips.mockResolvedValue(Array.from({ length: 50 }, (_, index) => clip(String(index))));
		getCachedClipsByOwner.mockResolvedValue([clip("0"), clip("new")]);
		await openPage();
		await press("Add Clips");
		expect(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Select Clip 0" })).toBeChecked();
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip new" }));
		expect(screen.getByRole("button", { name: "Add selected clips" })).toBeDisabled();
		expect(screen.getByText("Free plan limit is 50 clips per playlist.")).toBeInTheDocument();
	});
	it.each([new Error("Preview unavailable"), "unexpected"])("shows a failed import without losing the current draft: %p", async (error) => {
		previewImportPlaylistClips.mockRejectedValueOnce(error);
		await openPage();
		await press("Auto Import");
		await press("Import");
		expect(notify).toHaveBeenCalledWith({ title: "Import failed", description: error instanceof Error ? error.message : "Please try again.", color: "danger" });
		expect(screen.getByText("Auto Import to Playlist")).toBeInTheDocument();
	});
	it("changes import filters and sends them to the backend preview", async () => {
		previewImportPlaylistClips.mockResolvedValue([]);
		await openPage();
		await press("Auto Import");
		await press("Set date range");
		fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum Views" }), { target: { value: "20" } });
		fireEvent.change(screen.getByRole("slider", { name: "Minimum duration" }), { target: { value: "5" } });
		fireEvent.change(screen.getByRole("slider", { name: "Maximum duration" }), { target: { value: "25" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Creator Allowlist" }), { target: { value: "maker" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Creator Denylist" }), { target: { value: "blocked" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Blacklisted Words" }), { target: { value: "spoiler" } });
		await press("Import");
		expect(previewImportPlaylistClips).toHaveBeenCalledWith("playlist-1", expect.objectContaining({ startDate: "2026-01-01", endDate: "2026-01-02", minViews: 20, minDuration: 5, maxDuration: 25, clipCreatorsOnly: ["maker"], clipCreatorsBlocked: ["blocked"], blacklistWords: ["spoiler"] }));
		expect(screen.getByText("No clips matched these filters.")).toBeInTheDocument();
		await press("Cancel");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
	it("loads game search options and sends the selected category to preview", async () => {
		getTwitchGames.mockResolvedValue([
			{ id: "exact", name: "Game", box_art_url: "https://example.invalid/{width}/{height}.png" },
			{ id: "prefix", name: "Game 2", box_art_url: "" },
			{ id: "suffix", name: "The Game", box_art_url: "" },
			{ id: "normalized", name: "G-a-m-e", box_art_url: "" },
			{ id: "irrelevant", name: "Other", box_art_url: "" },
		]);
		previewImportPlaylistClips.mockResolvedValue([]);
		await openPage();
		await press("Auto Import");
		fireEvent.change(screen.getByPlaceholderText("Search and add a game..."), { target: { value: "game" } });
		await waitFor(() => expect(getTwitchGames).toHaveBeenCalledWith("game", "editor-1"));
		await waitFor(() => expect(screen.getByRole("button", { name: /^Game(?: Game)?$/ })).toBeInTheDocument());
		expect(screen.queryByRole("button", { name: "Other" })).not.toBeInTheDocument();
		await press(/^Game(?: Game)?$/);
		expect(screen.getByPlaceholderText("Search and add a game...")).toHaveValue("Game");
		await press("Import");
		expect(previewImportPlaylistClips).toHaveBeenCalledWith("playlist-1", expect.objectContaining({ categoryId: "exact" }));
	});
	it("uses resolved cached categories and resets cleared date range", async () => {
		getPlaylistClips.mockResolvedValue([{ ...clip("old"), game_id: "cached" }]);
		getGamesDetailsBulk.mockResolvedValue([{ id: "cached", name: "Cached Game", box_art_url: "" }]);
		previewImportPlaylistClips.mockResolvedValue([]);
		await openPage();
		await press("Auto Import");
		fireEvent.change(screen.getByPlaceholderText("Search and add a game..."), { target: { value: "cached" } });
		await press("Cached Game");
		await press("Set date range");
		await press("Clear date range");
		await press("Import");
		expect(previewImportPlaylistClips).toHaveBeenCalledWith("playlist-1", expect.objectContaining({ categoryId: "cached", startDate: "2016-01-01", endDate: new Date().toISOString().slice(0, 10) }));
	});
	it("retains its draft if the shared clip save returns unavailable", async () => {
		getPlaylistClips.mockResolvedValue([clip("old")]);
		upsertPlaylistClips.mockResolvedValueOnce(null);
		await openPage();
		await press("Select all");
		await press("Remove selected (1)");
		await press("Save Playlist");
		expect(notify).toHaveBeenCalledWith({ title: "Playlist changed or access was updated. Reload and try again.", color: "danger" });
		expect(screen.getByRole("button", { name: "Save Playlist" })).toBeEnabled();
	});
	it("closes the cached picker and shows safe feedback when loading fails", async () => {
		const diagnostic = jest.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const cause = new Error("cache unavailable");
			getCachedClipsByOwner.mockRejectedValueOnce(cause);
			await openPage();
			await press("Add Clips");
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			expect(notify).toHaveBeenCalledWith({ title: "Failed to load clips", color: "danger" });
			expect(diagnostic).toHaveBeenCalledWith("Failed to load cached clips:", cause);
		} finally {
			diagnostic.mockRestore();
		}
	});
	it("reviews a subset of import results and restores select all", async () => {
		previewImportPlaylistClips.mockResolvedValue([clip("one"), clip("two")]);
		await openPage();
		await press("Auto Import");
		await press("Import");
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip one" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip two" }));
		expect(screen.getByRole("button", { name: "Replace 0 clips" })).toBeDisabled();
		fireEvent.click(screen.getByRole("checkbox", { name: "Select Clip two" }));
		expect(screen.getByText("1 selected")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Select all" }));
		});
		expect(screen.getByText("2 selected")).toBeInTheDocument();
		await press("Replace 0 clips");
		expect(screen.getByText("Clip one")).toBeInTheDocument();
		expect(screen.getByText("Clip two")).toBeInTheDocument();
	});
	it.each(["Cancel", "Discard Changes"])("routes unsaved-change %s to the navigation guard", async (choice) => {
		const input = await openPage();
		navigationGuard.active = true;
		fireEvent.change(input, { target: { value: "Unsaved draft" } });
		await press(choice);
		expect(choice === "Cancel" ? navigationGuard.reject : navigationGuard.accept).toHaveBeenCalled();
		expect(savePlaylist).not.toHaveBeenCalled();
	});
	it("paginates a cache larger than fifty clips without changing the selected draft", async () => {
		getCachedClipsByOwner.mockResolvedValue(Array.from({ length: 51 }, (_, index) => ({ ...clip(String(index)), created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString() })));
		await openPage();
		await press("Add Clips");
		expect(within(screen.getByRole("dialog")).getAllByRole("row")).toHaveLength(50);
		await press("Next page");
		expect(within(screen.getByRole("dialog")).getAllByRole("row")).toHaveLength(1);
		expect(screen.getByText("Clip 0")).toBeInTheDocument();
	});
	it("shows loading then an empty cache without enabling an empty selection", async () => {
		let resolve!: (clips: unknown[]) => void;
		getCachedClipsByOwner.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			}),
		);
		await openPage();
		await press("Add Clips");
		expect(screen.getByText("Loading clips...")).toBeInTheDocument();
		await act(async () => {
			resolve([]);
		});
		expect(screen.getByText("No clips found in cache.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add selected clips" })).toBeDisabled();
	});
	it("clears an individual selected clip and preserves the draft", async () => {
		getPlaylistClips.mockResolvedValue([clip("saved")]);
		await openPage();
		const checkbox = screen.getByRole("checkbox", { name: "Select Clip saved" });
		fireEvent.click(checkbox);
		fireEvent.click(checkbox);
		expect(screen.getByRole("button", { name: "Remove selected (0)" })).toBeDisabled();
		expect(screen.getByText("Clip saved")).toBeInTheDocument();
	});
	it("returns from a missing playlist to the dashboard", async () => {
		getAllPlaylists.mockResolvedValue([]);
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		await act(async () => {
			render(<Page />);
		});
		await press("Back to Dashboard");
		expect(router.push).toHaveBeenCalledWith("/dashboard");
	});
	it("uses a safe category label for missing names and unresolved provider identifiers", async () => {
		getCachedClipsByOwner.mockResolvedValue([
			{ ...clip("empty"), game_id: "empty" },
			{ ...clip("identifier"), game_id: "identifier" },
		]);
		getGamesDetailsBulk.mockResolvedValue([
			{ id: "empty", name: "" },
			{ id: "identifier", name: "identifier" },
		]);
		await openPage();
		await press("Add Clips");
		expect(screen.getAllByText("Unknown category")).toHaveLength(2);
	});
	it("keeps the all-category choice available after clearing the search", async () => {
		await openPage();
		await press("Auto Import");
		fireEvent.change(screen.getByPlaceholderText("Search and add a game..."), { target: { value: "" } });
		await press("All categories");
		expect(screen.getByPlaceholderText("Search and add a game...")).toHaveValue("All categories");
		expect(getTwitchGames).not.toHaveBeenCalled();
	});
	it.each(["parent", "clips"])("an obsolete pending %s read cannot replace a remounted editor", async (stage) => {
		let resolve!: (value: unknown[]) => void;
		const pending = new Promise<unknown[]>((done) => {
			resolve = done;
		});
		if (stage === "parent") getAllPlaylists.mockReturnValueOnce(pending);
		else getPlaylistClips.mockReturnValueOnce(pending);
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		let old!: ReturnType<typeof render>;
		await act(async () => {
			old = render(<Page />);
		});
		old.unmount();
		getAllPlaylists.mockResolvedValue([{ id: "playlist-1", ownerId: "owner-1", name: "Latest", clipCount: 0, configurationRevision: 9 }]);
		await act(async () => {
			render(<Page />);
		});
		await act(async () => {
			resolve(stage === "parent" ? [{ id: "playlist-1", ownerId: "owner-1", name: "Obsolete", clipCount: 0, configurationRevision: 1 }] : [clip("obsolete")]);
		});
		expect(screen.getByPlaceholderText("Playlist name")).toHaveValue("Latest");
		expect(screen.queryByText("Clip obsolete")).not.toBeInTheDocument();
	});
	beforeEach(() => {
		jest.clearAllMocks();
		navigationGuard.active = false;
		featureAccess.mockReturnValue({ allowed: true });
		validateAuth.mockResolvedValue({ id: "editor-1", plan: "pro" });
		getAllPlaylists.mockResolvedValue([{ id: "playlist-1", ownerId: "owner-1", name: "Shared", clipCount: 0, accessType: "editor", configurationRevision: 1 }]);
		getPlaylistClips.mockResolvedValue([]);
		getCachedClipsByOwner.mockResolvedValue([]);
		getGamesDetailsBulk.mockResolvedValue([]);
		getTwitchGames.mockResolvedValue([]);
	});

	it("loads cached clips from playlist owner for editors", async () => {
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		render(<Page />);

		expect(await screen.findByPlaceholderText("Playlist name")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Add Clips" }));

		await waitFor(() => {
			expect(getCachedClipsByOwner).toHaveBeenCalledWith("owner-1");
		});
	});
	it("TDD-US2-038 preserves a newer remote edit and tells the stale browser to reload", async () => {
		savePlaylist.mockResolvedValueOnce(null);
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		render(<Page />);
		const input = await screen.findByPlaceholderText("Playlist name");
		fireEvent.change(input, { target: { value: "Stale browser name" } });
		fireEvent.click(screen.getByRole("button", { name: "Save Playlist" }));
		await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Playlist changed or access was updated. Reload and try again.", color: "danger" })));
		expect(savePlaylist).toHaveBeenCalledWith("playlist-1", { name: "Stale browser name" }, 1);
		expect(upsertPlaylistClips).not.toHaveBeenCalled();
	});
	it.each([false, true])("TDD-BROWSER-ITEMS-004 clip save forwards read revision with atomic rename=%s", async (rename) => {
		getPlaylistClips.mockResolvedValue([{ id: "ClipFirst", title: "Fixture clip", thumbnail_url: "https://example.invalid/clip.png", created_at: "2026-10-05T00:00:00Z", duration: 10 }]);
		upsertPlaylistClips.mockResolvedValue({ clips: [], configurationRevision: 2, name: rename ? "New name" : "Shared" });
		const Page = (await import("@/app/dashboard/playlist/[playlistId]/page")).default;
		render(<Page />);
		const input = await screen.findByPlaceholderText("Playlist name");
		await screen.findByText("Fixture clip");
		fireEvent.click(screen.getAllByRole("button", { name: "Select all" })[0]);
		fireEvent.click(screen.getByRole("button", { name: "Remove selected (1)" }));
		if (rename) fireEvent.change(input, { target: { value: "New name" } });
		fireEvent.click(screen.getByRole("button", { name: "Save Playlist" }));
		await waitFor(() => expect(upsertPlaylistClips).toHaveBeenCalledWith("playlist-1", [], "replace", 1, rename ? "New name" : undefined));
		expect(savePlaylist).not.toHaveBeenCalled();
	});
});
