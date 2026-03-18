import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const getOverlay = jest.fn();
const getOverlayOwnerPlan = jest.fn();
const getClipCacheStatus = jest.fn();
const getPlaylistsForOwner = jest.fn();
const saveOverlay = jest.fn();
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

jest.mock("@heroui/react", () => {
	const React = require("react");
	return {
		addToast: jest.fn(),
		useDisclosure: () => ({ isOpen: false, onOpen: jest.fn(), onOpenChange: jest.fn() }),
		Button: ({ children, onPress, onClick, ...props }: { children?: React.ReactNode; onPress?: () => void; onClick?: () => void }) => (
			<button {...props} onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>
				{children}
			</button>
		),
		Form: ({ children, onSubmit }: { children: React.ReactNode; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) => <form onSubmit={onSubmit}>{children}</form>,
		Input: ({ label, value, onValueChange, ...props }: { label?: string; value?: string; onValueChange?: (value: string) => void }) => (
			<label>
				{label}
				<input {...props} value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)} />
			</label>
		),
		Select: ({ label, children }: { label?: string; children: React.ReactNode }) => (
			<label>
				{label}
				<select>{children}</select>
			</label>
		),
		SelectItem: ({ children, ...props }: { children: React.ReactNode }) => <option {...props}>{children}</option>,
		Switch: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
		Slider: () => <div />,
		NumberInput: () => <div />,
		Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Divider: () => <div />,
		Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
		Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		ModalContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		ModalHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Image: () => <div />,
		Snippet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
		Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
	});

	it("renders playlist controls and submits playlistId in save payload", async () => {
		const Page = (await import("@/app/dashboard/overlay/[overlayId]/page")).default;
		render(<Page />);

		expect(await screen.findByText("New Playlist Name")).toBeInTheDocument();

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

