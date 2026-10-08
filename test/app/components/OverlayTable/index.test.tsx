import React from "react";
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => addToast(...args) }));
jest.mock("@components/appPagination", () => ({ __esModule: true, default: () => <div>Pagination</div> }));
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const getAllOverlays = jest.fn();
const getEditorOverlays = jest.fn();
const getAllPlaylists = jest.fn();
const getEditorAccess = jest.fn();
const getAllGalleries = jest.fn();
const createGallery = jest.fn();
const deleteGallery = jest.fn();
const createOverlay = jest.fn();
const createOverlayWithFeedback = jest.fn();
const createPlaylist = jest.fn();
const deleteOverlay = jest.fn();
const deletePlaylist = jest.fn();
const saveOverlay = jest.fn();
const validateAuth = jest.fn();
const getAvatar = jest.fn();
const getUsersDetailsBulk = jest.fn();
const addToast = jest.fn();
const push = jest.fn();
const createRunner = jest.fn();
const getAllRunners = jest.fn();
const getAllStreamSessions = jest.fn();
const unlinkRunner = jest.fn();
const deleteRunner = jest.fn();
const reverseTrial = jest.fn(() => false);
const trialDays = jest.fn(() => 0);
const trackPaywall = jest.fn();
const featureAccess = jest.fn((_user?: unknown, _feature?: unknown) => ({ allowed: true }));

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
	useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next-plausible", () => ({
	usePlausible: () => jest.fn(),
}));

jest.mock("@lib/paywallTracking", () => ({
	trackPaywallEvent: (...args: unknown[]) => trackPaywall(...args),
}));

jest.mock("@actions/database", () => ({
	getAllOverlays: (...args: unknown[]) => getAllOverlays(...args),
	getEditorOverlays: (...args: unknown[]) => getEditorOverlays(...args),
	getAllPlaylists: (...args: unknown[]) => getAllPlaylists(...args),
	getEditorAccess: (...args: unknown[]) => getEditorAccess(...args),
	createOverlay: (...args: unknown[]) => createOverlay(...args),
	createOverlayWithFeedback: (...args: unknown[]) => createOverlayWithFeedback(...args),
	createPlaylist: (...args: unknown[]) => createPlaylist(...args),
	deleteOverlay: (...args: unknown[]) => deleteOverlay(...args),
	deletePlaylist: (...args: unknown[]) => deletePlaylist(...args),
	saveOverlay: (...args: unknown[]) => saveOverlay(...args),
}));

jest.mock("@actions/gallery", () => ({
	getAllGalleries: (...args: unknown[]) => getAllGalleries(...args),
	createGallery: (...args: unknown[]) => createGallery(...args),
	deleteGallery: (...args: unknown[]) => deleteGallery(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/runner", () => ({
	createRunner: (...args: unknown[]) => createRunner(...args),
	deleteRunner: (...args: unknown[]) => deleteRunner(...args),
	getAllRunners: (...args: unknown[]) => getAllRunners(...args),
	getAllStreamSessions: (...args: unknown[]) => getAllStreamSessions(...args),
	getStreamSessionsForRunner: jest.fn().mockResolvedValue([]),
	setStreamDesiredState: jest.fn(),
	unlinkRunner: (...args: unknown[]) => unlinkRunner(...args),
}));

jest.mock("@actions/twitch", () => ({
	getAvatar: (...args: unknown[]) => getAvatar(...args),
	getUsersDetailsBulk: (...args: unknown[]) => getUsersDetailsBulk(...args),
	searchCategories: jest.fn(),
}));

jest.mock("@components/upgradeModal", () => ({
	__esModule: true,
	default: () => <div data-testid='upgrade-modal' />,
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: (...args: unknown[]) => featureAccess(...args),
	getTrialDaysLeft: () => trialDays(),
	isReverseTrialActive: () => reverseTrial(),
}));

jest.mock(
	"@tabler/icons-react",
	() =>
		new Proxy(
			{},
			{
				get: (_target, name) => {
					const MockIcon = ({ onClick }: { onClick?: React.MouseEventHandler<HTMLSpanElement> }) => <span data-testid={String(name)} onClick={onClick} />;
					MockIcon.displayName = "MockIcon";
					return MockIcon;
				},
			},
		),
);

jest.mock("next/dynamic", () => {
	const ReactLib = jest.requireActual<typeof import("react")>("react");
	return (loader: () => Promise<unknown>) => {
		const DynamicTableMock = (props: Record<string, unknown>) => {
			const [Component, setComponent] = ReactLib.useState<React.ComponentType<Record<string, unknown>> | null>(null);
			ReactLib.useEffect(() => {
				loader().then((mod) => {
					const resolved = (mod as { default?: React.ComponentType<Record<string, unknown>> }).default ?? (mod as React.ComponentType<Record<string, unknown>>);
					setComponent(() => resolved);
				});
			}, []);

			if (!Component) return <div data-testid='dynamic-table' />;
			return <Component {...props} />;
		};
		DynamicTableMock.displayName = "DynamicTableMock";
		return DynamicTableMock;
	};
});

jest.mock("@heroui/react", () => {
	const ReactLib = jest.requireActual<typeof import("react")>("react");
	const RowActionContext = ReactLib.createContext<((id: string) => void) | undefined>(undefined);
	return {
		cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
		addToast: (...args: unknown[]) => addToast(...args),
		useOverlayState: () => ({ isOpen: false, open: jest.fn(), close: jest.fn(), setOpen: jest.fn(), toggle: jest.fn() }),
		Dropdown: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Menu: ({ children, items = [] }: { children: React.ReactNode | ((item: unknown) => React.ReactNode); items?: Iterable<unknown> }) => <div>{typeof children === "function" ? Array.from(items).map((item, index) => <div key={index}>{children(item)}</div>) : children}</div>,
			Item: ({ children, onAction }: { children: React.ReactNode; onAction?: () => void }) => <button onClick={onAction}>{children}</button>,
			ItemIndicator: () => null,
		}),
		Table: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			ScrollContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Content: ({ children, onSelectionChange, onRowAction }: { children: React.ReactNode; onSelectionChange?: (value: "all" | Set<string>) => void; onRowAction?: (id: string) => void }) => (
				<div>
					<button onClick={() => onSelectionChange?.("all")}>Select fixture items</button>
					<button onClick={() => onSelectionChange?.(new Set(["overlay-1"]))}>Select first fixture overlay</button>
					<button onClick={() => onSelectionChange?.(new Set(["last"]))}>Select last fixture overlay</button>
					<button onClick={() => onSelectionChange?.(new Set())}>Clear fixture selection</button>
					<RowActionContext.Provider value={onRowAction}>{children}</RowActionContext.Provider>
				</div>
			),
			Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Column: ({ children }: { children: React.ReactNode | ((props: { sortDirection: null }) => React.ReactNode) }) => <div>{typeof children === "function" ? children({ sortDirection: null }) : children}</div>,
			SortableColumnHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
			Body: ({ children, renderEmptyState }: { children: React.ReactNode; renderEmptyState?: () => React.ReactNode }) => <div>{ReactLib.Children.count(children) ? children : renderEmptyState?.()}</div>,
			Row: ({ children, id, textValue }: { children: React.ReactNode; id: string; textValue: string }) => {
				const onRowAction = ReactLib.useContext(RowActionContext);
				return (
					<div role='row'>
						<button onClick={() => onRowAction?.(id)}>Open {textValue}</button>
						{children}
					</div>
				);
			},
			Cell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		Checkbox: Object.assign(({ children }: { children?: React.ReactNode }) => <span>{children}</span>, {
			Content: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
			Control: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
			Indicator: () => null,
		}),
		TableHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableColumn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableCell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TextField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
		FieldError: () => null,
		InputGroup: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Prefix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Suffix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
		}),
		Button: ({ children, onPress, onClick, "aria-label": ariaLabel }: { children: React.ReactNode; onPress?: () => void; onClick?: () => void; "aria-label"?: string }) => (
			<button aria-label={ariaLabel} onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>
				{children}
			</button>
		),
		Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		RadioGroup: ({ children, onChange }: { children: React.ReactNode; onChange?: (value: string) => void }) => <div>{ReactLib.Children.map(children, (child) => (ReactLib.isValidElement(child) ? ReactLib.cloneElement(child, { onChange } as Record<string, unknown>) : child))}</div>,
		Radio: Object.assign(
			({ children, value, onChange }: { children: React.ReactNode; value: string; onChange?: (value: string) => void }) => (
				<label>
					<input type='radio' name='fixture-filter' onChange={() => onChange?.(value)} />
					{children}
				</label>
			),
			{
				Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
				Control: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
				Indicator: () => null,
			},
		),
		Chip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Pagination: () => <div />,
		Separator: () => <div />,
		Tooltip: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
			Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		}),
		Popover: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
			Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Arrow: () => null,
		}),
		Spinner: () => <div>loading</div>,
		Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
		Modal: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Backdrop: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (isOpen ? <div>{children}</div> : null),
			Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			CloseTrigger: () => null,
			Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Heading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		Avatar: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
			Image: () => <span />,
			Fallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
		}),
		Skeleton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Tabs: Object.assign(({ children, onSelectionChange }: { children: React.ReactNode; onSelectionChange?: (key: string) => void }) => <div>{ReactLib.Children.map(children, (child) => (ReactLib.isValidElement(child) ? ReactLib.cloneElement(child, { onSelectionChange } as Record<string, unknown>) : child))}</div>, {
			ListContainer: ({ children, onSelectionChange }: { children: React.ReactNode; onSelectionChange?: (key: string) => void }) => <div>{ReactLib.Children.map(children, (child) => (ReactLib.isValidElement(child) ? ReactLib.cloneElement(child, { onSelectionChange } as Record<string, unknown>) : child))}</div>,
			List: ({ children, onSelectionChange }: { children: React.ReactNode; onSelectionChange?: (key: string) => void }) => <div>{ReactLib.Children.map(children, (child) => (ReactLib.isValidElement(child) ? ReactLib.cloneElement(child, { onSelectionChange } as Record<string, unknown>) : child))}</div>,
			Tab: ({ children, id, onSelectionChange }: { children: React.ReactNode; id: string; onSelectionChange?: (key: string) => void }) => <button onClick={() => onSelectionChange?.(id)}>{children}</button>,
			Indicator: () => null,
		}),
	};
});

function buildOverlay(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "overlay-1",
		ownerId: "owner-1",
		secret: "secret",
		name: "Main Overlay",
		configurationRevision: 4,
		status: "active",
		type: "All",
		playlistId: null,
		rewardId: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		lastUsedAt: null,
		minClipDuration: 0,
		maxClipDuration: 60,
		maxDurationMode: "filter",
		minClipViews: 0,
		blacklistWords: [],
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
		...overrides,
	} as never;
}

describe("components/OverlayTable/index", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		featureAccess.mockReturnValue({ allowed: true });
		reverseTrial.mockReturnValue(false);
		trialDays.mockReturnValue(0);
		createRunner.mockResolvedValue({ success: true, runner: { id: "created-runner" } });
		getAllRunners.mockResolvedValue([]);
		getAllStreamSessions.mockResolvedValue([]);
		unlinkRunner.mockResolvedValue({ success: true });
		deleteRunner.mockResolvedValue({ success: true });
		validateAuth.mockResolvedValue({
			id: "owner-1",
			plan: "pro",
			entitlements: { effectivePlan: "pro" },
		});
		getAllOverlays.mockResolvedValue([buildOverlay()]);
		getEditorOverlays.mockResolvedValue([]);
		getAllPlaylists.mockResolvedValue([{ id: "playlist-1", ownerId: "owner-1", name: "Roadmap", clipCount: 2, configurationRevision: 7, accessType: "owner" }]);
		getAllGalleries.mockResolvedValue([]);
		getEditorAccess.mockResolvedValue([]);
		getUsersDetailsBulk.mockResolvedValue([]);
		getAvatar.mockResolvedValue(null);
		deletePlaylist.mockResolvedValue(true);
	});

	it("shows playlists tab content", async () => {
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<OverlayTable userId='owner-1' accessToken='token' />);
		});

		await waitFor(() => {
			expect(getAllPlaylists).toHaveBeenCalledWith("owner-1");
		});

		await act(async () => {
			fireEvent.click(screen.getByText("Playlists"));
		});
		expect(screen.getByText("Add Playlist")).toBeInTheDocument();
	});

	it("confirms playlist deletion with the revision loaded in the dashboard", async () => {
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<OverlayTable userId='owner-1' accessToken='token' />);
		});
		await waitFor(() => expect(getAllPlaylists).toHaveBeenCalled());
		await act(async () => {
			fireEvent.click(screen.getByText("Playlists"));
		});
		fireEvent.click(await screen.findByRole("button", { name: "Delete Roadmap" }));
		expect(deletePlaylist).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(deletePlaylist).toHaveBeenCalledWith("playlist-1", 7));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Playlist deleted" })));
	});
	it("stale deletion retains the row and provides reload guidance", async () => {
		deletePlaylist.mockResolvedValue(false);
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<OverlayTable userId='owner-1' accessToken='token' />);
		});
		await waitFor(() => expect(getAllPlaylists).toHaveBeenCalled());
		await act(async () => {
			fireEvent.click(screen.getByText("Playlists"));
		});
		fireEvent.click(await screen.findByRole("button", { name: "Delete Roadmap" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ description: "Playlist changed or access was updated. Reload and try again." })));
		expect(screen.getByText("Roadmap")).toBeTruthy();
	});

	it("renders overlay tab by default", async () => {
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<OverlayTable userId='owner-1' accessToken='token' />);
		});

		await waitFor(() => {
			expect(getAllOverlays).toHaveBeenCalledWith("owner-1");
		});
		expect(screen.getAllByText("Overlays").length).toBeGreaterThan(0);
	});

	it("renders an overlay only once when owned and delegated results overlap", async () => {
		const overlappingOverlay = buildOverlay({ name: "Shared Overlay" });
		getAllOverlays.mockResolvedValueOnce([overlappingOverlay]);
		getEditorOverlays.mockResolvedValueOnce([overlappingOverlay]);
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;

		await act(async () => {
			render(<OverlayTable userId='owner-1' accessToken='token' />);
		});

		await waitFor(() => {
			expect(screen.getAllByText("Shared Overlay")).toHaveLength(1);
		});
	});
	it("TDD-BROWSER-OVERLAY-DELETE-003 uses named HeroUI control and explicit confirmation with cached revision", async () => {
		deleteOverlay.mockResolvedValueOnce(true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		fireEvent.click(await screen.findByRole("button", { name: "Delete Main Overlay" }));
		expect(deleteOverlay).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(deleteOverlay).toHaveBeenCalledWith("overlay-1", 4));
	});
	it("TDD-BROWSER-OVERLAY-DELETE-003 stale deletion retains overlay and gives reload guidance", async () => {
		deleteOverlay.mockResolvedValueOnce(false);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		fireEvent.click(await screen.findByRole("button", { name: "Delete Main Overlay" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ description: "Overlay changed or access was updated. Reload and try again." })));
		expect(screen.getByText("Main Overlay")).toBeTruthy();
	});
	it.each(["denied", "rejected"])("TDD-BULK-UI-001 retains committed status/revision when another update is %s", async (failure) => {
		getAllOverlays.mockResolvedValue([buildOverlay(), buildOverlay({ id: "overlay-2", name: "Second Overlay" })]);
		saveOverlay.mockImplementation((id: string, _patch: unknown, revision: number) => (id === "overlay-1" ? Promise.resolve({ configurationRevision: revision + 1 }) : failure === "rejected" ? Promise.reject(new Error("Unavailable")) : Promise.resolve(undefined)));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Second Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		fireEvent.click(screen.getByRole("button", { name: "Toggle status" }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
		saveOverlay.mockClear();
		fireEvent.click(screen.getByRole("button", { name: "Toggle status" }));
		await waitFor(() => expect(saveOverlay).toHaveBeenCalledWith("overlay-1", { status: "active" }, 5));
		expect(saveOverlay).toHaveBeenCalledWith("overlay-2", { status: "paused" }, 4);
	});
	it.each(["denied", "rejected"])("TDD-BULK-UI-001 removes committed deletion when another deletion is %s", async (failure) => {
		getAllOverlays.mockResolvedValue([buildOverlay(), buildOverlay({ id: "overlay-2", name: "Second Overlay" })]);
		deleteOverlay.mockImplementation((id: string) => (id === "overlay-1" ? Promise.resolve(true) : failure === "rejected" ? Promise.reject(new Error("Unavailable")) : Promise.resolve(false)));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Second Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
		await waitFor(() => expect(screen.queryByText("Main Overlay")).not.toBeInTheDocument());
		expect(screen.getByText("Second Overlay")).toBeInTheDocument();
	});

	it("backend quota feedback reports usage and limit when cached dashboard plan is stale", async () => {
		createOverlay.mockResolvedValue(null);
		createOverlayWithFeedback.mockResolvedValue({ overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 } });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Add Overlay" }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ description: "This creator is using 1 of 1 overlays. Upgrade to Pro to create more." })));
		expect(push).not.toHaveBeenCalled();
	});
	it.each([
		["Overlays", "Add Overlay", "overlay"],
		["Playlists", "Add Playlist", "playlist"],
		["Galleries", "Add Gallery", "gallery"],
	])("owned %s creation navigates to its committed resource", async (tab, label, kind) => {
		createOverlayWithFeedback.mockResolvedValue({ overlay: buildOverlay({ id: "created" }), error: null });
		createPlaylist.mockResolvedValue({ id: "created" });
		createGallery.mockResolvedValue({ id: "created" });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		if (tab !== "Overlays") fireEvent.click(screen.getByRole("button", { name: tab }));
		fireEvent.click(screen.getByRole("button", { name: label }));
		await waitFor(() => expect(push).toHaveBeenCalledWith(`/dashboard/${kind === "gallery" ? "galleries" : kind}/created`));
	});

	it.each(["denied", "unavailable", "rejected"])("owned overlay creation %s never navigates or invents a created row", async (mode) => {
		if (mode === "rejected") createOverlayWithFeedback.mockRejectedValue(new Error("private storage failure"));
		else createOverlayWithFeedback.mockResolvedValue({ overlay: null, error: { code: mode === "denied" ? "ACCESS_DENIED" : "SERVICE_UNAVAILABLE" } });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Add Overlay" }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
		expect(push).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Add Overlay" })).toBeEnabled();
	});

	it.each(["Playlists", "Galleries"])("failed owned %s creation gives actionable feedback", async (tab) => {
		createPlaylist.mockResolvedValue(null);
		createGallery.mockResolvedValue(null);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab }));
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab === "Playlists" ? "Add Playlist" : "Add Gallery" }));
		});
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
		expect(push).not.toHaveBeenCalled();
	});

	it.each(["success", "failed", "rejected", "restricted"])("owned runner creation %s respects entitlement and safe outcomes", async (mode) => {
		validateAuth.mockResolvedValue({ id: "owner-1", plan: "pro", entitlements: { effectivePlan: "pro", runnerAccess: mode !== "restricted" } });
		if (mode === "failed") createRunner.mockResolvedValue({ success: false });
		if (mode === "rejected") createRunner.mockRejectedValue(new Error("private runner failure"));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			await act(async () => {
				fireEvent.click(screen.getByRole("button", { name: "Runners" }));
			});
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Add Runner" }));
		});
		if (mode === "success") await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/runners/created-runner"));
		else if (mode === "restricted") expect(createRunner).not.toHaveBeenCalled();
		else await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
		if (mode !== "success") expect(push).not.toHaveBeenCalled();
	});

	it.each(["Overlays", "Playlists", "Galleries"])("cached Free %s ceiling requests upgrade before creation", async (tab) => {
		featureAccess.mockReturnValue({ allowed: false });
		validateAuth.mockResolvedValue({ id: "owner-1", plan: "free", entitlements: { effectivePlan: "free" } });
		getAllGalleries.mockResolvedValue([{ id: "gallery-1", ownerId: "owner-1", name: "Gallery" }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		if (tab !== "Overlays") fireEvent.click(screen.getByRole("button", { name: tab }));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab === "Overlays" ? "Add Overlay" : tab === "Playlists" ? "Add Playlist" : "Add Gallery" }));
		});
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Upgrade Required" })));
		expect(createOverlayWithFeedback).not.toHaveBeenCalled();
		expect(createPlaylist).not.toHaveBeenCalled();
		expect(createGallery).not.toHaveBeenCalled();
	});

	it("reload refreshes saved dashboard revisions before a later deletion", async () => {
		getAllOverlays.mockResolvedValueOnce([buildOverlay()]).mockResolvedValue([buildOverlay({ configurationRevision: 9 })]);
		deleteOverlay.mockResolvedValue(true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Reload" }));
		});
		await waitFor(() => expect(getAllOverlays).toHaveBeenCalledTimes(2));
		fireEvent.click(screen.getByRole("button", { name: "Delete Main Overlay" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(deleteOverlay).toHaveBeenCalledWith("overlay-1", 9));
	});
	it.each(["overlay", "playlist", "gallery", "runner"])("delegated %s creation uses the selected creator", async (kind) => {
		getEditorAccess.mockResolvedValue([{ userId: "delegated" }]);
		getUsersDetailsBulk.mockResolvedValue([{ id: "delegated", display_name: "Delegated", profile_image_url: "https://example.invalid/avatar.png" }]);
		createOverlayWithFeedback.mockResolvedValue({ overlay: buildOverlay({ id: "created", ownerId: "delegated" }), error: null });
		createPlaylist.mockResolvedValue({ id: "created" });
		createGallery.mockResolvedValue({ id: "created" });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		if (kind !== "overlay") fireEvent.click(screen.getByRole("button", { name: kind === "playlist" ? "Playlists" : kind === "gallery" ? "Galleries" : "Runners" }));
		fireEvent.click(await screen.findByRole("button", { name: new RegExp(`Add new ${kind} for Delegated$`) }));
		await waitFor(() => expect(push).toHaveBeenCalledWith(`/dashboard/${kind === "gallery" ? "galleries" : kind === "runner" ? "runners" : kind}/${kind === "runner" ? "created-runner" : "created"}`));
		if (kind === "overlay") expect(createOverlayWithFeedback).toHaveBeenCalledWith("delegated");
		if (kind === "playlist") expect(createPlaylist).toHaveBeenCalledWith("delegated", "Playlist 2");
		if (kind === "gallery") expect(createGallery).toHaveBeenCalledWith("delegated", "Gallery 1");
		if (kind === "runner") expect(createRunner).toHaveBeenCalledWith("delegated", "New Hardware Node");
	});

	it.each(["overlay", "playlist", "gallery", "runner"])("failed delegated %s creation retains the dashboard", async (kind) => {
		getEditorAccess.mockResolvedValue([{ userId: "delegated" }]);
		getUsersDetailsBulk.mockResolvedValue([{ id: "delegated", display_name: "Delegated", profile_image_url: "https://example.invalid/avatar.png" }]);
		createOverlayWithFeedback.mockResolvedValue({ overlay: null, error: { code: "ACCESS_DENIED" } });
		createPlaylist.mockResolvedValue(null);
		createGallery.mockResolvedValue(null);
		createRunner.mockResolvedValue({ success: false });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		if (kind !== "overlay") fireEvent.click(screen.getByRole("button", { name: kind === "playlist" ? "Playlists" : kind === "gallery" ? "Galleries" : "Runners" }));
		fireEvent.click(await screen.findByRole("button", { name: new RegExp(`Add new ${kind} for Delegated$`) }));
		await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" })));
		expect(push).not.toHaveBeenCalled();
	});
	it("pagination and search return to the first matching page", async () => {
		getAllOverlays.mockResolvedValue(Array.from({ length: 12 }, (_, index) => buildOverlay({ id: `overlay-${index}`, name: `Overlay ${String(index).padStart(2, "0")}` })));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Overlay 00");
		expect(screen.queryByText("Overlay 11")).not.toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
		});
		expect(screen.getByText("Overlay 11")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Previous Page" }));
		});
		expect(screen.getByText("Overlay 00")).toBeInTheDocument();
		await act(async () => {
			fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "overlay 11" } });
		});
		expect(screen.getByText("Overlay 11")).toBeInTheDocument();
		expect(screen.queryByText("Overlay 00")).not.toBeInTheDocument();
		await act(async () => {
			fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "" } });
		});
		expect(screen.getByText("Overlay 00")).toBeInTheDocument();
	});

	it("status filter and filtered selection restrict bulk deletion to matching overlays", async () => {
		getAllOverlays.mockResolvedValue([buildOverlay(), buildOverlay({ id: "paused", name: "Paused Overlay", status: "paused" })]);
		deleteOverlay.mockResolvedValue(true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		fireEvent.click(screen.getByRole("radio", { name: "Paused" }));
		expect(screen.queryByText("Main Overlay")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		await act(async () => {
			fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "Paused" } });
		});
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => expect(deleteOverlay).toHaveBeenCalledWith("paused", 4));
		expect(deleteOverlay).toHaveBeenCalledTimes(1);
	});

	it.each(["offline", "online", "running"])("runner %s state renders current server status", async (state) => {
		getAllRunners.mockResolvedValue([{ id: "runner-one", ownerId: "owner-1", name: "Hardware", status: state === "offline" ? "offline" : "online", createdAt: new Date(), lastHeartbeatAt: state === "offline" ? null : new Date() }]);
		getAllStreamSessions.mockResolvedValue([{ runnerId: "runner-one", actualState: state === "running" ? "running" : "stopped", lastError: state === "running" ? "stream failed" : null }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		await screen.findByText("Hardware");
		expect(screen.getByText(state === "offline" ? "Offline" : state === "running" ? "Streaming" : "Online", { exact: true })).toBeInTheDocument();
		expect(screen.getAllByText(state === "offline" ? "Not linked" : "Linked", { exact: true }).length).toBeGreaterThan(0);
		if (state === "running") expect(screen.getByText("Error", { exact: true })).toBeInTheDocument();
	});

	it.each(["Overlays", "Playlists", "Galleries"])("empty %s gives a clear empty state", async (tab) => {
		getAllOverlays.mockResolvedValue([]);
		getAllPlaylists.mockResolvedValue([]);
		getAllGalleries.mockResolvedValue([]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("No overlays found");
		if (tab !== "Overlays") fireEvent.click(screen.getByRole("button", { name: tab }));
		expect(screen.getByText(`No ${tab.toLowerCase()} found`)).toBeInTheDocument();
	});
	it.each(["Playlists", "Galleries", "Runners"])("bulk %s deletion removes successful rows and keeps failed rows selected", async (tab) => {
		const first = { id: "first", ownerId: "owner-1", name: "First Resource", configurationRevision: 7, accessType: "owner", clipCount: 1, status: "offline", createdAt: new Date(), lastHeartbeatAt: null };
		const second = { ...first, id: "second", name: "Second Resource", configurationRevision: 9 };
		const load = tab === "Playlists" ? getAllPlaylists : tab === "Galleries" ? getAllGalleries : getAllRunners;
		const remove = tab === "Playlists" ? deletePlaylist : tab === "Galleries" ? deleteGallery : deleteRunner;
		load.mockResolvedValue([first, second]);
		remove.mockImplementation(async (id: string) => (tab === "Runners" ? { success: id === "first" } : id === "first"));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab }));
		});
		await screen.findByText("First Resource");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		expect(remove).toHaveBeenCalledTimes(2);
		if (tab === "Playlists") expect(remove).toHaveBeenCalledWith("second", 9);
		if (tab === "Runners") expect(remove).toHaveBeenCalledWith("second", "owner-1");
		expect(screen.queryByText("First Resource")).not.toBeInTheDocument();
		expect(screen.getByText("Second Resource")).toBeInTheDocument();
		expect(screen.getByText("1 Selected")).toBeInTheDocument();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Reload and try again", color: "danger" }));
	});

	it.each(["Playlists", "Galleries", "Runners"])("successful bulk %s deletion clears selection and shows completion", async (tab) => {
		const record = { id: "only", ownerId: "owner-1", name: "Only Resource", configurationRevision: 8, accessType: "owner", clipCount: 1, status: "offline", createdAt: new Date(), lastHeartbeatAt: null };
		const load = tab === "Playlists" ? getAllPlaylists : tab === "Galleries" ? getAllGalleries : getAllRunners;
		const remove = tab === "Playlists" ? deletePlaylist : tab === "Galleries" ? deleteGallery : deleteRunner;
		load.mockResolvedValue([record]);
		remove.mockResolvedValue(tab === "Runners" ? { success: true } : true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab }));
		});
		await screen.findByText("Only Resource");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		expect(screen.queryByText("Only Resource")).not.toBeInTheDocument();
		expect(screen.getByText("0 Selected")).toBeInTheDocument();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Successfully deleted", description: "1 item deleted." }));
	});

	it.each(["success", "denied", "rejected"])("bulk runner unlink handles %s without unlinking disconnected hardware", async (mode) => {
		getAllRunners.mockResolvedValue([
			{ id: "connected", ownerId: "owner-1", name: "Connected Hardware", status: "online", createdAt: new Date(), lastHeartbeatAt: new Date() },
			{ id: "disconnected", ownerId: "owner-1", name: "Disconnected Hardware", status: "offline", createdAt: new Date(), lastHeartbeatAt: null },
		]);
		if (mode === "denied") unlinkRunner.mockResolvedValue({ success: false, error: "Access changed" });
		if (mode === "rejected") unlinkRunner.mockRejectedValue(new Error("Temporary failure"));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		await screen.findByText("Connected Hardware");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		fireEvent.click(screen.getByRole("button", { name: /^Unlink$/ }));
		expect(unlinkRunner).not.toHaveBeenCalled();
		fireEvent.change(screen.getByPlaceholderText("UNLINK"), { target: { value: "UNLINK" } });
		await act(async () => {
			fireEvent.click(screen.getAllByRole("button", { name: /^Unlink$/ }).at(-1)!);
		});
		expect(unlinkRunner).toHaveBeenCalledTimes(1);
		expect(unlinkRunner).toHaveBeenCalledWith("connected", "owner-1");
		if (mode === "success") {
			expect(screen.queryByText("Unlink runners")).not.toBeInTheDocument();
			expect(screen.getAllByText("Offline", { exact: true })).toHaveLength(2);
			expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Runner unlinked", color: "success" }));
		} else {
			expect(screen.getByText("Unlink runners")).toBeInTheDocument();
			expect(screen.getByText("Online", { exact: true })).toBeInTheDocument();
			expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", description: mode === "denied" ? "Access changed" : "Temporary failure" }));
		}
	});

	it("bulk unlink gives guidance when every selected runner is disconnected", async () => {
		getAllRunners.mockResolvedValue([{ id: "disconnected", ownerId: "owner-1", name: "Disconnected Hardware", status: "offline", createdAt: new Date(), lastHeartbeatAt: null }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		await screen.findByText("Disconnected Hardware");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		fireEvent.click(screen.getByRole("button", { name: /^Unlink$/ }));
		expect(unlinkRunner).not.toHaveBeenCalled();
		expect(screen.queryByText("Unlink runners")).not.toBeInTheDocument();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nothing to unlink", color: "warning" }));
	});
	it("partial overlay selection forwards the selected revision and leaves the other row untouched", async () => {
		getAllOverlays.mockResolvedValue([buildOverlay(), buildOverlay({ id: "other", name: "Other Overlay", configurationRevision: 12 })]);
		deleteOverlay.mockResolvedValue(true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Select first fixture overlay" }));
		expect(screen.getByText("1 Selected")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		expect(deleteOverlay).toHaveBeenCalledTimes(1);
		expect(deleteOverlay).toHaveBeenCalledWith("overlay-1", 4);
		expect(screen.queryByText("Main Overlay")).not.toBeInTheDocument();
		expect(screen.getByText("Other Overlay")).toBeInTheDocument();
	});

	it("clearing selection removes bulk actions without deleting resources", async () => {
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		expect(screen.getByRole("button", { name: "Open Selected Actions" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Clear fixture selection" }));
		expect(screen.queryByRole("button", { name: "Open Selected Actions" })).not.toBeInTheDocument();
		expect(screen.getByText("Main Overlay")).toBeInTheDocument();
		expect(deleteOverlay).not.toHaveBeenCalled();
	});

	it("select all after searching only deletes matching overlays", async () => {
		getAllOverlays.mockResolvedValue([buildOverlay(), buildOverlay({ id: "other", name: "Other Overlay", configurationRevision: 12 })]);
		deleteOverlay.mockResolvedValue(true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "Other" } });
		});
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		expect(deleteOverlay).toHaveBeenCalledTimes(1);
		expect(deleteOverlay).toHaveBeenCalledWith("other", 12);
		await act(async () => {
			fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "" } });
		});
		expect(screen.getByText("Main Overlay")).toBeInTheDocument();
	});

	it.each([1, 4])("active trial with %s days displays its deadline and tracks upgrade intent", async (days) => {
		reverseTrial.mockReturnValue(true);
		trialDays.mockReturnValue(days);
		validateAuth.mockResolvedValue({ id: "owner-1", plan: "free", entitlements: { effectivePlan: "pro" } });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText(days === 1 ? "Ends today" : "4 days left");
		fireEvent.click(screen.getByRole("button", { name: "Upgrade now" }));
		expect(trackPaywall).toHaveBeenCalledWith(expect.any(Function), "paywall_cta_click", expect.objectContaining({ feature: "trial_active", plan: "free" }));
	});

	it("rejected owned playlist creation keeps the dashboard and shows a safe retry", async () => {
		createPlaylist.mockRejectedValue(new Error("private upstream details"));
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Add Playlist" }));
		});
		expect(screen.getByText("Roadmap")).toBeInTheDocument();
		expect(push).not.toHaveBeenCalled();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", description: "Failed to create playlist. Please try again.", color: "danger" }));
	});
	it.each([
		["Overlays", "Main Overlay", "/dashboard/overlay/overlay-1"],
		["Playlists", "Roadmap", "/dashboard/playlist/playlist-1"],
		["Galleries", "Public Gallery", "/dashboard/galleries/gallery-one"],
		["Runners", "Hardware Node", "/dashboard/runners/runner-one"],
	])("activating a %s row opens its correct resource editor", async (tab, name, path) => {
		getAllGalleries.mockResolvedValue([{ id: "gallery-one", ownerId: "owner-1", name: "Public Gallery", source: "playlist", published: true, layout: "grid" }]);
		getAllRunners.mockResolvedValue([{ id: "runner-one", ownerId: "owner-1", name: "Hardware Node", status: "offline", createdAt: new Date(), lastHeartbeatAt: null }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		if (tab !== "Overlays") fireEvent.click(screen.getByRole("button", { name: tab }));
		fireEvent.click(await screen.findByRole("button", { name: `Open ${name}` }));
		expect(push).toHaveBeenCalledTimes(1);
		expect(push).toHaveBeenCalledWith(path);
	});

	it.each(["Galleries", "Runners"])("single %s deletion waits for confirmation and adopts the successful result", async (tab) => {
		getAllGalleries.mockResolvedValue([{ id: "gallery-one", ownerId: "owner-1", name: "Deletion Resource", source: "playlist", published: false }]);
		getAllRunners.mockResolvedValue([{ id: "runner-one", ownerId: "owner-1", name: "Deletion Resource", status: "offline", createdAt: new Date(), lastHeartbeatAt: null }]);
		deleteGallery.mockResolvedValue(true);
		deleteRunner.mockResolvedValue({ success: true });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab }));
		});
		await screen.findByText("Deletion Resource");
		const row = screen.getAllByRole("row").find((item) => within(item).queryByText("Deletion Resource"))!;
		fireEvent.click(within(row).getByTestId("IconTrash"));
		const remove = tab === "Galleries" ? deleteGallery : deleteRunner;
		expect(remove).not.toHaveBeenCalled();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		if (tab === "Galleries") expect(remove).toHaveBeenCalledWith("gallery-one");
		else expect(remove).toHaveBeenCalledWith("runner-one", "owner-1");
		expect(screen.queryByText("Deletion Resource")).not.toBeInTheDocument();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: tab === "Galleries" ? "Gallery deleted" : "Runner deleted", color: "success" }));
	});

	it.each(["Galleries", "Runners"])("denied %s deletion retains the resource and confirmation", async (tab) => {
		getAllGalleries.mockResolvedValue([{ id: "gallery-one", ownerId: "owner-1", name: "Deletion Resource", source: "playlist", published: false }]);
		getAllRunners.mockResolvedValue([{ id: "runner-one", ownerId: "owner-1", name: "Deletion Resource", status: "offline", createdAt: new Date(), lastHeartbeatAt: null }]);
		deleteGallery.mockResolvedValue(false);
		deleteRunner.mockResolvedValue({ success: false });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: tab }));
		});
		await screen.findByText("Deletion Resource");
		const row = screen.getAllByRole("row").find((item) => within(item).queryByText("Deletion Resource"))!;
		fireEvent.click(within(row).getByTestId("IconTrash"));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		expect(screen.getByText("Deletion Resource")).toBeInTheDocument();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", description: tab === "Galleries" ? "Failed to delete gallery" : "Failed to delete runner", color: "danger" }));
	});

	it("cancelling overlay deletion closes confirmation without requesting deletion", async () => {
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		fireEvent.click(screen.getByRole("button", { name: "Delete Main Overlay" }));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("Delete overlay")).not.toBeInTheDocument();
		expect(deleteOverlay).not.toHaveBeenCalled();
		expect(screen.getByText("Main Overlay")).toBeInTheDocument();
	});

	it("cancelling runner unlink closes confirmation and preserves connected status", async () => {
		getAllRunners.mockResolvedValue([{ id: "connected", ownerId: "owner-1", name: "Connected Hardware", status: "online", createdAt: new Date(), lastHeartbeatAt: new Date() }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		await screen.findByText("Connected Hardware");
		fireEvent.click(screen.getByRole("button", { name: "Select fixture items" }));
		fireEvent.click(screen.getByRole("button", { name: /^Unlink$/ }));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("Unlink runners")).not.toBeInTheDocument();
		expect(unlinkRunner).not.toHaveBeenCalled();
		expect(screen.getByText("Online", { exact: true })).toBeInTheDocument();
	});

	it("changing name sort reverses displayed resources and can restore ascending order", async () => {
		getAllOverlays.mockResolvedValue([buildOverlay({ name: "Alpha" }), buildOverlay({ id: "other", name: "Zulu" })]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Alpha");
		const order = () => screen.getAllByRole("row").map((row) => within(row).getByRole("button", { name: /^Open / }).textContent);
		expect(order()).toEqual(["Open Alpha", "Open Zulu"]);
		fireEvent.click(screen.getAllByRole("button", { name: /^Name$/ })[0]);
		expect(order()).toEqual(["Open Zulu", "Open Alpha"]);
		fireEvent.click(screen.getAllByRole("button", { name: /^Name$/ })[0]);
		expect(order()).toEqual(["Open Alpha", "Open Zulu"]);
	});

	it("delegated overlays remain visible alongside owned overlays without changing owner identity", async () => {
		getEditorOverlays.mockResolvedValue([buildOverlay({ id: "delegated", name: "Delegated Overlay", ownerId: "another-owner" })]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Delegated Overlay");
		expect(screen.getByText("Main Overlay")).toBeInTheDocument();
		await waitFor(() => expect(getAvatar).toHaveBeenCalledWith("another-owner", "owner-1"));
	});

	it("unavailable resource lists resolve to empty views without revealing stale resources", async () => {
		for (const load of [getAllOverlays, getEditorOverlays, getAllPlaylists, getAllGalleries, getAllRunners, getAllStreamSessions]) load.mockResolvedValue(null);
		validateAuth.mockResolvedValue(null);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("No overlays found");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
		});
		expect(screen.getByText("No playlists found")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Galleries" }));
		});
		expect(screen.getByText("No galleries found")).toBeInTheDocument();
		expect(screen.queryByText("Main Overlay")).not.toBeInTheDocument();
		expect(screen.queryByText("Roadmap")).not.toBeInTheDocument();
	});

	it("legacy Free profile without entitlement projection still shows its resource ceiling", async () => {
		validateAuth.mockResolvedValue({ id: "owner-1", plan: "free" });
		featureAccess.mockReturnValue({ allowed: false });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("You're on the Free plan and have reached the overlay limit. Upgrade to add more overlays.");
		fireEvent.click(screen.getByRole("button", { name: "Add Overlay" }));
		expect(createOverlayWithFeedback).not.toHaveBeenCalled();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Upgrade Required", color: "warning" }));
	});
	it.each(["partial", "all"])("%s selection preserves selected overlays across pagination", async (mode) => {
		getAllOverlays.mockResolvedValue(Array.from({ length: 12 }, (_, index) => buildOverlay({ id: index === 0 ? "overlay-1" : index === 11 ? "last" : `item-${index}`, name: `Overlay ${String(index).padStart(2, "0")}` })));
		deleteOverlay.mockResolvedValue(true);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Overlay 00");
		fireEvent.click(screen.getByRole("button", { name: mode === "all" ? "Select fixture items" : "Select first fixture overlay" }));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
		});
		fireEvent.click(screen.getByRole("button", { name: "Select last fixture overlay" }));
		expect(screen.getByText(mode === "all" ? "11 Selected" : "2 Selected")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
		});
		expect(deleteOverlay).toHaveBeenCalledTimes(mode === "all" ? 11 : 2);
		expect(deleteOverlay).toHaveBeenCalledWith("overlay-1", 4);
		expect(deleteOverlay).toHaveBeenCalledWith("last", 4);
		expect(deleteOverlay).not.toHaveBeenCalledWith("item-10", expect.anything());
	});

	it("reload clears previously visible resources when current backend access returns no lists", async () => {
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		for (const load of [getAllOverlays, getEditorOverlays, getAllPlaylists, getAllGalleries, getAllRunners, getAllStreamSessions]) load.mockResolvedValue(null);
		await act(async () => {
			await act(async () => {
				fireEvent.click(screen.getByRole("button", { name: "Reload" }));
			});
		});
		expect(screen.getByText("No overlays found")).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
		});
		expect(screen.getByText("No playlists found")).toBeInTheDocument();
		expect(screen.queryByText("Roadmap")).not.toBeInTheDocument();
		expect(screen.queryByText("Main Overlay")).not.toBeInTheDocument();
	});

	it.each(["owner-1", "delegated"])("server quota feedback for %s in the creator menu preserves its exact usage", async (creatorId) => {
		getEditorAccess.mockResolvedValue([{ userId: "delegated" }]);
		getUsersDetailsBulk.mockResolvedValue([{ id: creatorId, display_name: "Chosen Creator", profile_image_url: "https://example.invalid/avatar.png" }]);
		createOverlayWithFeedback.mockResolvedValue({ overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 } });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(await screen.findByRole("button", { name: /Add new overlay for Chosen Creator$/ }));
		});
		expect(createOverlayWithFeedback).toHaveBeenCalledWith(creatorId);
		expect(push).not.toHaveBeenCalled();
		expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ description: "This creator is using 1 of 1 overlays. Upgrade to Pro to create more.", color: "danger" }));
	});

	it("own runner creation from the creator menu requires the Runner entitlement", async () => {
		getEditorAccess.mockResolvedValue([{ userId: "delegated" }]);
		getUsersDetailsBulk.mockResolvedValue([{ id: "owner-1", display_name: "Chosen Creator", profile_image_url: "https://example.invalid/avatar.png" }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		await act(async () => {
			fireEvent.click(await screen.findByRole("button", { name: /Add new runner for Chosen Creator$/ }));
		});
		expect(createRunner).not.toHaveBeenCalled();
		expect(push).not.toHaveBeenCalled();
	});
	it("reload adopts current runner stream states and keeps unknown sessions offline", async () => {
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		getAllRunners.mockResolvedValue([
			{ id: "connected", ownerId: "owner-1", name: "Connected Hardware", status: "online", createdAt: new Date(), lastHeartbeatAt: new Date() },
			{ id: "disconnected", ownerId: "owner-1", name: "Disconnected Hardware", status: "offline", createdAt: new Date(), lastHeartbeatAt: null },
		]);
		getAllStreamSessions.mockResolvedValue([{ runnerId: "connected", actualState: "running", lastError: null }]);
		await act(async () => {
			await act(async () => {
				fireEvent.click(screen.getByRole("button", { name: "Reload" }));
			});
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		expect(screen.getByText("Connected Hardware")).toBeInTheDocument();
		expect(screen.getByText("Disconnected Hardware")).toBeInTheDocument();
		expect(screen.getByText("Streaming", { exact: true })).toBeInTheDocument();
		expect(screen.getByText("Offline", { exact: true })).toBeInTheDocument();
	});
	it("authorized delegated galleries display the creator avatar rather than the acting user", async () => {
		getAllGalleries.mockResolvedValue([{ id: "shared-gallery", ownerId: "another-owner", name: "Shared Gallery", source: "playlist", published: true }]);
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await screen.findByText("Main Overlay");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Galleries" }));
		});
		expect(screen.getByText("Shared Gallery")).toBeInTheDocument();
		expect(getAvatar).toHaveBeenCalledWith("another-owner", "owner-1");
	});
	it("Free runner empty state explains the add-on requirement and does not create hardware", async () => {
		validateAuth.mockResolvedValue({ id: "owner-1", plan: "free", entitlements: { effectivePlan: "free", runnerAccess: false } });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		expect(screen.getByText("Runner add-on required")).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: "Upgrade with Runner" })).toHaveLength(2);
		expect(createRunner).not.toHaveBeenCalled();
	});

	it("entitled runner empty state opens enrollment without creating a runner implicitly", async () => {
		validateAuth.mockResolvedValue({ id: "owner-1", plan: "pro", entitlements: { effectivePlan: "pro", runnerAccess: true } });
		const Table = (await import("@/app/components/OverlayTable")).default;
		await act(async () => {
			render(<Table userId='owner-1' accessToken='token' />);
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Runners" }));
		});
		fireEvent.click(screen.getByRole("button", { name: "Create runner" }));
		expect(push).toHaveBeenCalledWith("/runner/enroll");
		expect(createRunner).not.toHaveBeenCalled();
	});
});
