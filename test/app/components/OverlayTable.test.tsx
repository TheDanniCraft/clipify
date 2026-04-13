import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import OverlayTable from "@/app/components/OverlayTable";
import { StatusOptions, Plan } from "@types";

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
	useRouter: () => ({
		push: routerPush,
	}),
}));

const trackPaywallEvent = jest.fn();
const getActiveCampaignOfferAction = jest.fn();
jest.mock("@lib/paywallTracking", () => ({
	trackPaywallEvent: (...args: any[]) => trackPaywallEvent(...args),
}));

jest.mock("@actions/campaignOffers", () => ({
	getActiveCampaignOfferAction: (...args: any[]) => getActiveCampaignOfferAction(...args),
}));

jest.mock("@components/upgradeModal", () => ({
	__esModule: true,
	default: () => <div>upgrade-modal</div>,
}));

jest.mock("next-plausible", () => ({
	usePlausible: () => jest.fn(),
}));

const getAllOverlays = jest.fn();
const getAllPlaylists = jest.fn();
const getEditorOverlays = jest.fn();
const getEditorAccess = jest.fn();
const createOverlay = jest.fn();
const createPlaylist = jest.fn();
const deleteOverlay = jest.fn();
const deletePlaylist = jest.fn();
const saveOverlay = jest.fn();

jest.mock("@actions/database", () => ({
	getAllOverlays: (...args: any[]) => getAllOverlays(...args),
	getAllPlaylists: (...args: any[]) => getAllPlaylists(...args),
	getEditorOverlays: (...args: any[]) => getEditorOverlays(...args),
	getEditorAccess: (...args: any[]) => getEditorAccess(...args),
	createOverlay: (...args: any[]) => createOverlay(...args),
	createPlaylist: (...args: any[]) => createPlaylist(...args),
	deleteOverlay: (...args: any[]) => deleteOverlay(...args),
	deletePlaylist: (...args: any[]) => deletePlaylist(...args),
	saveOverlay: (...args: any[]) => saveOverlay(...args),
}));

const validateAuth = jest.fn();
jest.mock("@actions/auth", () => ({
	validateAuth: () => validateAuth(),
}));

const getUsersDetailsBulk = jest.fn();
const getAvatar = jest.fn();
jest.mock("@actions/twitch", () => ({
	getUsersDetailsBulk: (...args: any[]) => getUsersDetailsBulk(...args),
	getAvatar: (...args: any[]) => getAvatar(...args),
}));

jest.mock("@heroui/react", () => {
	const React = require("react");
	return {
		cn: (...args: any[]) => args.filter(Boolean).join(" "),
		Button: ({ children, onPress, isDisabled, isLoading, "aria-label": ariaLabel }: any) => (
			<button onClick={onPress} disabled={isDisabled || isLoading} aria-label={ariaLabel}>
				{isLoading ? "Loading..." : children}
			</button>
		),
		Input: ({ value, onValueChange, placeholder }: any) => <input value={value} onChange={(e) => onValueChange(e.target.value)} placeholder={placeholder} />,
		Chip: ({ children }: any) => <div>{children}</div>,
		Divider: () => <hr />,
		Tooltip: ({ children, content }: any) => <div title={typeof content === "string" ? content : ""}>{children}</div>,
		Popover: ({ children }: any) => <div>{children}</div>,
		PopoverTrigger: ({ children }: any) => <div>{children}</div>,
		PopoverContent: ({ children }: any) => <div>{children}</div>,
		Dropdown: ({ children }: any) => <div>{children}</div>,
		DropdownTrigger: ({ children }: any) => <div>{children}</div>,
		DropdownMenu: ({ children, items }: any) => <div>{items && typeof children === "function" ? items.map((item: any) => <div key={item.id || item.uid || item.key}>{children(item)}</div>) : children}</div>,
		DropdownItem: ({ children, onPress, onClick, textValue }: any) => <button onClick={onPress || onClick}>{children || textValue}</button>,
		Table: ({ children, topContent, bottomContent }: any) => (
			<div>
				{topContent}
				<table>{children}</table>
				{bottomContent}
			</div>
		),
		TableHeader: ({ children, columns }: any) => (
			<thead>
				<tr>{columns ? columns.map((col: any) => <th key={col.uid}>{typeof children === "function" ? children(col) : col.name}</th>) : children}</tr>
			</thead>
		),
		TableColumn: ({ children }: any) => children,
		TableBody: ({ children, items, emptyContent }: any) => {
			const content =
				items && items.length > 0 ? (
					items.map((item: any) => {
						return typeof children === "function" ? children(item) : children;
					})
				) : (
					<tr>
						<td>{emptyContent}</td>
					</tr>
				);
			return <tbody>{content}</tbody>;
		},
		TableRow: ({ children, item }: any) => {
			const columns = ["accessType", "id", "name", "status", "actions"];
			return (
				<tr key={item?.id}>
					{columns.map((col) => (
						<td key={col}>{typeof children === "function" ? children(col) : children}</td>
					))}
				</tr>
			);
		},
		TableCell: ({ children }: any) => children,
		Pagination: () => <div>Pagination</div>,
		Spinner: ({ label }: any) => <div>{label}</div>,
		addToast: jest.fn(),
		Link: ({ children, href }: any) => <a href={href}>{children}</a>,
		// eslint-disable-next-line @next/next/no-img-element
		Avatar: ({ src }: any) => <img src={src} alt='avatar' />,
		Skeleton: ({ children, isLoaded }: any) => <div>{isLoaded ? children : "Loading..."}</div>,
		Tabs: ({ children, onSelectionChange, selectedKey }: any) => (
			<div>
				{React.Children.map(children, (child: any) => {
					return React.cloneElement(child, {
						onPress: () => onSelectionChange(child.key),
						isActive: child.key === selectedKey,
					});
				})}
			</div>
		),
		Tab: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>,
		useDisclosure: () => ({ isOpen: false, onOpen: jest.fn(), onOpenChange: jest.fn() }),
		RadioGroup: ({ children, _value, onValueChange }: any) => <div onChange={(e: any) => onValueChange(e.target.value)}>{children}</div>,
		Radio: ({ children, value }: any) => (
			<label>
				<input type='radio' value={value} />
				{children}
			</label>
		),
	};
});

jest.mock("@tabler/icons-react", () => ({
	IconPencil: () => <button aria-label='Edit'>Pencil</button>,
	IconTrash: ({ onClick }: any) => (
		<button aria-label='Delete' onClick={onClick}>
			Trash
		</button>
	),
	IconSearch: () => <span>Search</span>,
	IconAdjustmentsHorizontal: () => <span>Filter</span>,
	IconMenuDeep: () => <span>Sort</span>,
	IconArrowsLeftRight: () => <span>Columns</span>,
	IconChevronDown: () => <span>Down</span>,
	IconChevronUp: () => <span>Up</span>,
	IconCirclePlus: () => <span>Plus</span>,
	IconCircuitChangeover: () => <span>Toggle</span>,
	IconCrown: () => <span>Crown</span>,
	IconInfoCircle: () => <span>Info</span>,
	IconReload: () => <span>Reload</span>,
	IconChecks: () => <span>Checks</span>,
	IconClipboard: () => <span>Clipboard</span>,
	IconCircleFilled: () => <span>CircleFilled</span>,
}));

// Mock dynamic import
jest.mock("next/dynamic", () => () => {
	return function DynamicComponent(props: any) {
		const { Table } = require("@heroui/react");
		return <Table {...props} />;
	};
});

jest.mock("@/app/components/OverlayTable/copy-text", () => ({
	CopyText: ({ children }: any) => <span>{children}</span>,
}));

describe("OverlayTable", () => {
	const userId = "user-123";
	const accessToken = "token-123";

	beforeEach(() => {
		jest.clearAllMocks();
		getActiveCampaignOfferAction.mockResolvedValue(null);
		getAllOverlays.mockResolvedValue([{ id: "ov-1", name: "Overlay 1", status: StatusOptions.Active, ownerId: userId }]);
		getAllPlaylists.mockResolvedValue([{ id: "pl-1", name: "Playlist 1", ownerId: userId, clipCount: 5 }]);
		getEditorOverlays.mockResolvedValue([]);
		getEditorAccess.mockResolvedValue([]);
		validateAuth.mockResolvedValue({ id: userId, plan: Plan.Pro });
	});

	it("renders overlays by default and can switch to playlists", async () => {
		render(<OverlayTable userId={userId} accessToken={accessToken} />);

		expect(screen.getByText("Loading overlays")).toBeInTheDocument();

		await waitFor(() => expect(screen.getByText("Overlay 1")).toBeInTheDocument());
		expect(screen.queryByText("Playlist 1")).not.toBeInTheDocument();

		const playlistTab = screen.getByText("Playlists");
		fireEvent.click(playlistTab);

		await waitFor(() => expect(screen.getByText("Playlist 1")).toBeInTheDocument());
		expect(screen.queryByText("Overlay 1")).not.toBeInTheDocument();
	});

	it("filters overlays by name", async () => {
		getAllOverlays.mockResolvedValue([
			{ id: "ov-1", name: "Apple", status: StatusOptions.Active, ownerId: userId },
			{ id: "ov-2", name: "Banana", status: StatusOptions.Active, ownerId: userId },
		]);

		render(<OverlayTable userId={userId} accessToken={accessToken} />);

		await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());
		expect(screen.getByText("Banana")).toBeInTheDocument();

		const searchInput = screen.getByPlaceholderText("Search");
		fireEvent.change(searchInput, { target: { value: "app" } });

		expect(screen.getByText("Apple")).toBeInTheDocument();
		expect(screen.queryByText("Banana")).not.toBeInTheDocument();
	});

	it("handles overlay deletion", async () => {
		deleteOverlay.mockResolvedValue(true);
		render(<OverlayTable userId={userId} accessToken={accessToken} />);

		await waitFor(() => expect(screen.getByText("Overlay 1")).toBeInTheDocument());

		const deleteBtn = screen.getByRole("button", { name: "Delete" });
		fireEvent.click(deleteBtn);

		await waitFor(() => expect(deleteOverlay).toHaveBeenCalledWith("ov-1"));
		expect(screen.queryByText("Overlay 1")).not.toBeInTheDocument();
	});
});
