import React from "react";
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
jest.mock("@components/appPagination", () => ({ __esModule: true, default: () => <div>Pagination</div> }));
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const getAllOverlays = jest.fn();
const getEditorOverlays = jest.fn();
const getAllPlaylists = jest.fn();
const getEditorAccess = jest.fn();
const createOverlay = jest.fn();
const createPlaylist = jest.fn();
const deleteOverlay = jest.fn();
const deletePlaylist = jest.fn();
const saveOverlay = jest.fn();
const validateAuth = jest.fn();
const getAvatar = jest.fn();
const getUsersDetailsBulk = jest.fn();
const addToast = jest.fn();
const push = jest.fn();

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
	useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next-plausible", () => ({
	usePlausible: () => jest.fn(),
}));

jest.mock("@lib/paywallTracking", () => ({
	trackPaywallEvent: jest.fn(),
}));

jest.mock("@actions/database", () => ({
	getAllOverlays: (...args: unknown[]) => getAllOverlays(...args),
	getEditorOverlays: (...args: unknown[]) => getEditorOverlays(...args),
	getAllPlaylists: (...args: unknown[]) => getAllPlaylists(...args),
	getEditorAccess: (...args: unknown[]) => getEditorAccess(...args),
	createOverlay: (...args: unknown[]) => createOverlay(...args),
	createPlaylist: (...args: unknown[]) => createPlaylist(...args),
	deleteOverlay: (...args: unknown[]) => deleteOverlay(...args),
	deletePlaylist: (...args: unknown[]) => deletePlaylist(...args),
	saveOverlay: (...args: unknown[]) => saveOverlay(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/runner", () => ({
	createRunner: jest.fn(),
	deleteRunner: jest.fn(),
	getAllRunners: jest.fn().mockResolvedValue([]),
	getStreamSessionsForRunner: jest.fn().mockResolvedValue([]),
	setStreamDesiredState: jest.fn(),
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
	getFeatureAccess: () => ({ allowed: true }),
	getTrialDaysLeft: () => 0,
	isReverseTrialActive: () => false,
}));

jest.mock(
	"@tabler/icons-react",
	() =>
		new Proxy(
			{},
			{
				get: () => {
					const MockIcon = () => <span />;
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
	return {
		cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
		addToast: (...args: unknown[]) => addToast(...args),
		useOverlayState: () => ({ isOpen: false, open: jest.fn(), close: jest.fn(), setOpen: jest.fn(), toggle: jest.fn() }),
		Dropdown: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Menu: ({ children, items = [] }: { children: React.ReactNode | ((item: unknown) => React.ReactNode); items?: unknown[] }) => <div>{typeof children === "function" ? items.map((item, index) => <div key={index}>{children(item)}</div>) : children}</div>,
			Item: ({ children, onAction }: { children: React.ReactNode; onAction?: () => void }) => <button onClick={onAction}>{children}</button>,
			ItemIndicator: () => null,
		}),
		Table: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			ScrollContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Column: ({ children }: { children: React.ReactNode | ((props: { sortDirection: null }) => React.ReactNode) }) => <div>{typeof children === "function" ? children({ sortDirection: null }) : children}</div>,
			SortableColumnHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
			Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Row: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
		InputGroup: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Prefix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Suffix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
		}),
		Button: ({ children, onPress, onClick }: { children: React.ReactNode; onPress?: () => void; onClick?: () => void }) => <button onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>{children}</button>,
		Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		RadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Radio: Object.assign(({ children }: { children: React.ReactNode }) => <label>{children}</label>, {
			Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Control: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Indicator: () => null,
		}),
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
		validateAuth.mockResolvedValue({
			id: "owner-1",
			plan: "pro",
			entitlements: { effectivePlan: "pro" },
		});
		getAllOverlays.mockResolvedValue([buildOverlay()]);
		getEditorOverlays.mockResolvedValue([]);
		getAllPlaylists.mockResolvedValue([{ id: "playlist-1", ownerId: "owner-1", name: "Roadmap", clipCount: 2, accessType: "owner" }]);
		getEditorAccess.mockResolvedValue([]);
		getUsersDetailsBulk.mockResolvedValue([]);
		getAvatar.mockResolvedValue(null);
		deletePlaylist.mockResolvedValue(true);
	});

	it("shows playlists tab content", async () => {
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		render(<OverlayTable userId='owner-1' accessToken='token' />);

		await waitFor(() => {
			expect(getAllPlaylists).toHaveBeenCalledWith("owner-1");
		});

		fireEvent.click(screen.getByText("Playlists"));
		expect(screen.getByText("Add Playlist")).toBeInTheDocument();
	});

	it("renders overlay tab by default", async () => {
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		render(<OverlayTable userId='owner-1' accessToken='token' />);

		await waitFor(() => {
			expect(getAllOverlays).toHaveBeenCalledWith("owner-1");
		});
		expect(screen.getAllByText("Overlays").length).toBeGreaterThan(0);
	});
});
