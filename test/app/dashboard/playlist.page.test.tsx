import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const getAllPlaylists = jest.fn();
const getPlaylistClips = jest.fn();
const previewImportPlaylistClips = jest.fn();
const savePlaylist = jest.fn();
const upsertPlaylistClips = jest.fn();
const validateAuth = jest.fn();
const getCachedClipsByOwner = jest.fn();
const getGamesDetailsBulk = jest.fn();
const getTwitchGames = jest.fn();

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: jest.fn() }),
	useParams: () => ({ playlistId: "playlist-1" }),
}));

jest.mock("next-navigation-guard", () => ({
	useNavigationGuard: () => ({
		active: false,
		reject: jest.fn(),
		accept: jest.fn(),
	}),
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
	getFeatureAccess: () => ({ allowed: true }),
}));

jest.mock("@components/dashboardNavbar", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@components/tagsInput", () => ({
	__esModule: true,
	default: ({ label }: { label: string }) => <div>{label}</div>,
}));

jest.mock("@tabler/icons-react", () => new Proxy({}, { get: () => () => <span /> }));

jest.mock("@heroui/react", () => ({
	addToast: jest.fn(),
	useDisclosure: () => ({ isOpen: false, onOpen: jest.fn(), onClose: jest.fn(), onOpenChange: jest.fn() }),
	Button: ({ children, onPress, onClick, ...props }: { children?: React.ReactNode; onPress?: () => void; onClick?: () => void }) => (
		<button {...props} onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>
			{children}
		</button>
	),
	Form: ({ children, onSubmit }: { children?: React.ReactNode; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) => <form onSubmit={onSubmit}>{children}</form>,
	Input: ({ value, onValueChange, placeholder, ...props }: { value?: string; onValueChange?: (value: string) => void; placeholder?: string }) => (
		<input {...props} placeholder={placeholder} value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)} />
	),
	Select: ({ children }: { children?: React.ReactNode }) => <select>{children}</select>,
	SelectItem: ({ children }: { children?: React.ReactNode }) => <option>{children}</option>,
	Autocomplete: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	AutocompleteItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	CardBody: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	Checkbox: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
	DateRangePicker: () => <div />,
	Divider: () => <div />,
	Image: () => <div />,
	Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
	Modal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	ModalBody: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	ModalContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	ModalFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	ModalHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	NumberInput: () => <div />,
	Pagination: () => <div />,
	Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
	Table: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableBody: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableCell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableColumn: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TableRow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe("dashboard playlist page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		validateAuth.mockResolvedValue({ id: "editor-1", plan: "pro" });
		getAllPlaylists.mockResolvedValue([{ id: "playlist-1", ownerId: "owner-1", name: "Shared", clipCount: 0, accessType: "editor" }]);
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
});
