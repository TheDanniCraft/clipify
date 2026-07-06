import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const getOverlay = jest.fn();
const getOverlayOwnerPlan = jest.fn();
const getClipCacheStatus = jest.fn();
const getPlaylistsForOwner = jest.fn();
const saveOverlay = jest.fn();
const savePlaylist = jest.fn();
const validateAuth = jest.fn();
const getTwitchClips = jest.fn();

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: jest.fn() }),
	useParams: () => ({ overlayId: "overlay-1" }),
}));

jest.mock("next-navigation-guard", () => ({
	useNavigationGuard: () => ({
		active: false,
		reject: jest.fn(),
		accept: jest.fn(),
	}),
}));

jest.mock("@actions/database", () => ({
	getOverlay: (...args: unknown[]) => getOverlay(...args),
	getOverlayOwnerPlan: (...args: unknown[]) => getOverlayOwnerPlan(...args),
	getClipCacheStatus: (...args: unknown[]) => getClipCacheStatus(...args),
	getPlaylistsForOwner: (...args: unknown[]) => getPlaylistsForOwner(...args),
	createPlaylist: jest.fn(),
	importPlaylistClips: jest.fn(),
	reorderPlaylistClips: jest.fn(),
	upsertPlaylistClips: jest.fn(),
	savePlaylist: (...args: unknown[]) => savePlaylist(...args),
	saveOverlay: (...args: unknown[]) => saveOverlay(...args),
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/twitch", () => ({
	getTwitchClips: (...args: unknown[]) => getTwitchClips(...args),
	getReward: jest.fn(),
	createChannelReward: jest.fn(),
	removeChannelReward: jest.fn(),
	handleClip: jest.fn(),
}));

jest.mock("@lib/twitchErrors", () => ({
	REWARD_NOT_FOUND: "not-found",
}));

jest.mock("@/app/utils/regexFilter", () => ({
	isTitleBlocked: () => false,
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

jest.mock("@components/feedbackWidget", () => ({
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
	default: ({ label }: { label: string }) => <div>{label}</div>,
}));

jest.mock("@tabler/icons-react", () => new Proxy({}, { get: () => () => <span /> }));
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
jest.mock("@components/appDateRangePicker", () => ({ __esModule: true, default: ({ label }: { label: string }) => <div>{label}</div> }));

jest.mock("@heroui/react", () => {
	jest.requireActual<typeof import("react")>("react");
	return {
		addToast: jest.fn(),
		useOverlayState: () => ({ isOpen: false, open: jest.fn(), close: jest.fn(), setOpen: jest.fn(), toggle: jest.fn() }),
		Button: ({ children, onPress, onClick, ...props }: { children?: React.ReactNode; onPress?: () => void; onClick?: () => void }) => (
			<button {...props} onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>
				{children}
			</button>
		),
		Form: ({ children, onSubmit }: { children: React.ReactNode; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) => <form onSubmit={onSubmit}>{children}</form>,
		TextField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
		FieldError: () => null,
		Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
		InputGroup: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Prefix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Suffix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
		}),
		CloseButton: ({ onPress }: { onPress?: () => void }) => <button type='button' aria-label='Clear' onClick={onPress} />,
		Select: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Value: () => null,
			Indicator: () => null,
			Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		ComboBox: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
			InputGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Trigger: () => null,
			Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		ListBox: Object.assign(({ children, items = [] }: { children?: React.ReactNode | ((item: unknown) => React.ReactNode); items?: unknown[] }) => <div>{typeof children === "function" ? items.map((item, index) => <div key={index}>{children(item)}</div>) : children}</div>, {
			Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			ItemIndicator: () => null,
		}),
		Switch: Object.assign(({ children }: { children: React.ReactNode }) => <label>{children}</label>, {
			Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Control: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Thumb: () => <span />,
		}),
		Checkbox: Object.assign(({ children }: { children?: React.ReactNode }) => <label>{children}</label>, {
			Content: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
			Control: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
			Indicator: () => null,
		}),
		Slider: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
			Output: () => null,
			Track: ({ children }: { children?: React.ReactNode | ((value: { state: { values: number[] } }) => React.ReactNode) }) => <div>{typeof children === "function" ? children({ state: { values: [0, 60] } }) : children}</div>,
			Fill: () => null,
			Thumb: () => null,
		}),
		NumberField: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
			Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Input: () => <input type='number' />,
			IncrementButton: () => <button type='button'>+</button>,
			DecrementButton: () => <button type='button'>-</button>,
		}),
		DateRangePicker: ({ label }: { label?: string }) => <div>{label}</div>,
		Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		Separator: () => <div />,
		Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
		Modal: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
			Content: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Column: ({ children }: { children?: React.ReactNode | ((props: { sortDirection: null }) => React.ReactNode) }) => <div>{typeof children === "function" ? children({ sortDirection: null }) : children}</div>,
			SortableColumnHeader: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
			Body: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
			Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
	} as never;
}

describe("dashboard overlay settings playlist mode", () => {
	beforeEach(() => {
		jest.clearAllMocks();
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

	it("renders playlist controls and submits playlistId in save payload", async () => {
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(<Page />);

		expect(await screen.findByText("Playlist name")).toBeInTheDocument();

		fireEvent.submit(screen.getByRole("button", { name: "Save Overlay Settings" }).closest("form") as HTMLFormElement);

		await waitFor(() => {
			expect(saveOverlay).toHaveBeenCalledWith(
				"overlay-1",
				expect.objectContaining({
					type: "Playlist",
					playlistId: "playlist-1",
				}),
			);
		});
	});
});
