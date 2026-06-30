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
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
jest.mock("@components/appDateRangePicker", () => ({ __esModule: true, default: ({ label }: { label: string }) => <div>{label}</div> }));
jest.mock("@components/appPagination", () => ({ __esModule: true, default: () => <div>Pagination</div> }));

jest.mock("@heroui/react", () => ({
	addToast: jest.fn(),
	useDisclosure: () => ({ isOpen: false, onOpen: jest.fn(), onClose: jest.fn(), onOpenChange: jest.fn() }),
	Button: ({ children, onPress, onClick, ...props }: { children?: React.ReactNode; onPress?: () => void; onClick?: () => void }) => (
		<button {...props} onClick={() => (onPress ? onPress() : onClick ? onClick() : undefined)}>
			{children}
		</button>
	),
	Form: ({ children, onSubmit }: { children?: React.ReactNode; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) => <form onSubmit={onSubmit}>{children}</form>,
	TextField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
	InputGroup: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
		Prefix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		Suffix: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
	}),
	CloseButton: ({ onPress }: { onPress?: () => void }) => <button type='button' aria-label='Clear' onClick={onPress} />,
	Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
	ComboBox: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		InputGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Trigger: () => null,
		Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	ListBox: Object.assign(({ children, items = [] }: { children?: React.ReactNode | ((item: unknown) => React.ReactNode); items?: unknown[] }) => <div>{typeof children === "function" ? items.map((item, index) => <div key={index}>{children(item)}</div>) : children}</div>, {
		Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		ItemIndicator: () => null,
	}),
	Card: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		Content: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	Checkbox: Object.assign(({ children }: { children?: React.ReactNode }) => <label>{children}</label>, {
		Content: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
		Control: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
		Indicator: () => null,
	}),
	DateRangePicker: () => <div />,
	Separator: () => <div />,
	Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
	Modal: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		Backdrop: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Container: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		CloseTrigger: () => null,
		Header: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Heading: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Body: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Footer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	}),
	NumberField: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
		Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
		Input: () => <input type='number' />,
		IncrementButton: () => <button type='button'>+</button>,
		DecrementButton: () => <button type='button'>-</button>,
	}),
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
