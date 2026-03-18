import React from "react";
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

jest.mock("@actions/twitch", () => ({
	getAvatar: (...args: unknown[]) => getAvatar(...args),
	getUsersDetailsBulk: (...args: unknown[]) => getUsersDetailsBulk(...args),
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

jest.mock("@tabler/icons-react", () => new Proxy({}, { get: () => () => <span /> }));

jest.mock("next/dynamic", () => () => () => <div data-testid='dynamic-table' />);

jest.mock("@heroui/react", () => {
	const React = require("react");
	return {
		cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
		addToast: (...args: unknown[]) => addToast(...args),
		useDisclosure: () => ({ isOpen: false, onOpen: jest.fn(), onOpenChange: jest.fn() }),
		Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		DropdownTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		DropdownMenu: ({ children, items = [] }: { children: React.ReactNode | ((item: unknown) => React.ReactNode); items?: unknown[] }) => (
			<div>{typeof children === "function" ? (items as unknown[]).map((item, index) => <div key={index}>{children(item)}</div>) : children}</div>
		),
		DropdownItem: ({ children, onClick, onPress }: { children: React.ReactNode; onClick?: () => void; onPress?: () => void }) => (
			<button onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>{children}</button>
		),
		Table: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableColumn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		TableCell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Input: ({ value, onValueChange, placeholder }: { value?: string; onValueChange?: (value: string) => void; placeholder?: string }) => <input value={value ?? ""} placeholder={placeholder} onChange={(event) => onValueChange?.(event.target.value)} />,
		Button: ({ children, onPress, onClick }: { children: React.ReactNode; onPress?: () => void; onClick?: () => void }) => <button onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>{children}</button>,
		RadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Radio: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
		Chip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Pagination: () => <div />,
		Divider: () => <div />,
		Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Spinner: () => <div>loading</div>,
		Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
		Avatar: () => <div />,
		Skeleton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Tab: () => null,
		Tabs: ({ children, onSelectionChange }: { children: React.ReactNode; onSelectionChange?: (key: string) => void }) => (
			<div>
				{React.Children.map(children, (child: React.ReactElement<{ title?: React.ReactNode }>) => (
					<button onClick={() => onSelectionChange?.(String(child.key))}>{child.props.title}</button>
				))}
			</div>
		),
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

	it("shows playlists tab content and allows deleting a playlist", async () => {
		const OverlayTable = (await import("@/app/components/OverlayTable")).default;
		render(<OverlayTable userId='owner-1' accessToken='token' />);

		await waitFor(() => {
			expect(getAllPlaylists).toHaveBeenCalledWith("owner-1");
		});

		fireEvent.click(screen.getByText("Playlists"));

		expect(await screen.findByText("Roadmap")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Delete"));

		await waitFor(() => {
			expect(deletePlaylist).toHaveBeenCalledWith("playlist-1");
		});
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
