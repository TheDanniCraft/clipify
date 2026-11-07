const notify = jest.fn();
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { DashboardNavigationContext, DashboardNavigationControls } from "@/app/components/dashboardNavigation";

const setTheme = jest.fn();
const routerPush = jest.fn();
const routerRefresh = jest.fn();
const getAdminViewCandidates = jest.fn();
const switchAdminView = jest.fn();
const stopAdminView = jest.fn();
const getActiveCampaignOfferAction = jest.fn();
const setActiveOrganization = jest.fn();
let currentTheme = "dark";
let identitySession: { data: { session: { activeOrganizationId: string | null } } | null; isPending: boolean } = { data: { session: { activeOrganizationId: "creator-org" } }, isPending: false };
let organizationList: { data: Array<{ id: string; name: string; metadata?: unknown }> | undefined; isPending: boolean } = { data: [], isPending: false };

jest.mock("@/auth/client", () => ({
	authClient: {
		useSession: () => identitySession,
		useListOrganizations: () => organizationList,
		organization: { setActive: (...args: unknown[]) => setActiveOrganization(...args) },
	},
}));

jest.mock("next-themes", () => ({
	useTheme: () => ({
		theme: currentTheme,
		setTheme: (t: string) => {
			currentTheme = t;
			setTheme(t);
		},
	}),
}));

jest.mock("next/navigation", () => ({
	usePathname: () => "/dashboard/overlays",
	useRouter: () => ({
		push: routerPush,
		refresh: routerRefresh,
	}),
}));

jest.mock("@actions/adminView", () => ({
	getAdminViewCandidates: (...args: unknown[]) => getAdminViewCandidates(...args),
	switchAdminView: (...args: unknown[]) => switchAdminView(...args),
	stopAdminView: (...args: unknown[]) => stopAdminView(...args),
}));

jest.mock("@actions/campaignOffers", () => ({
	getActiveCampaignOfferAction: (...args: unknown[]) => getActiveCampaignOfferAction(...args),
}));

jest.mock("@components/logo", () => ({
	__esModule: true,
	default: () => <div>logo</div>,
}));

jest.mock("@heroui/react", () => {
	const ReactLib = jest.requireActual<typeof import("react")>("react");
	const ComboContext = ReactLib.createContext<{ inputValue?: string; onInputChange?: (value: string) => void; onSelectionChange?: (key: string) => void }>({});
	const AutocompleteContext = ReactLib.createContext<{ onChange?: (key: string) => void }>({});
	return {
		Tooltip: Object.assign(({ children }: { children: React.ReactNode }) => <>{children}</>, { Content: () => null }),
		Breadcrumbs: jest.requireActual("../../__mocks__/heroui-react.cjs").Breadcrumbs,
		Spinner: () => <span role='status' aria-label='Loading' />,
		Autocomplete: Object.assign(({ children, onChange }: { children: React.ReactNode; onChange?: (key: string) => void }) => <AutocompleteContext.Provider value={{ onChange }}>{children}</AutocompleteContext.Provider>, {
			Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Value: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
			Indicator: () => null,
			Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Filter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		}),
		Avatar: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
			Image: ({ src }: { src?: string }) => <span data-avatar={src ?? ""} />,
			Fallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
		}),
		Button: ({ children, onPress, isDisabled, "aria-label": ariaLabel }: { children: React.ReactNode; onPress?: () => void; isDisabled?: boolean; "aria-label"?: string }) => (
			<button onClick={onPress} disabled={isDisabled} aria-label={ariaLabel}>
				{children}
			</button>
		),
		Dropdown: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Trigger: ({ children, ...props }: { children: React.ReactNode; "aria-label"?: string }) => <button {...props}>{children}</button>,
			Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Menu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			Item: ({ children, onAction }: { children: React.ReactNode; onAction?: () => void }) => <button onClick={onAction}>{children}</button>,
		}),
		ComboBox: Object.assign(
			({ children, inputValue, onInputChange, onSelectionChange }: { children: React.ReactNode; inputValue?: string; onInputChange?: (value: string) => void; onSelectionChange?: (key: string) => void }) => (
				<ComboContext.Provider value={{ inputValue, onInputChange, onSelectionChange }}>
					<div>{children}</div>
				</ComboContext.Provider>
			),
			{
				InputGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
				Trigger: () => null,
				Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			},
		),
		Input: () => {
			const context = ReactLib.useContext(ComboContext);
			return <input aria-label='admin-switch-search' value={context.inputValue} onChange={(event) => context.onInputChange?.(event.target.value)} />;
		},
		EmptyState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
		ListBox: Object.assign(
			({ children, items = [], renderEmptyState }: { children: React.ReactNode | ((item: { id: string; username: string }) => React.ReactNode); items?: Array<{ id: string; username: string }>; renderEmptyState?: () => React.ReactNode }) => {
				const context = ReactLib.useContext(ComboContext);
				const autocomplete = ReactLib.useContext(AutocompleteContext);
				if (autocomplete.onChange) return <div>{children as React.ReactNode}</div>;
				return (
					<>
						<select aria-label='admin-switch-select' onChange={(event) => context.onSelectionChange?.(event.target.value)}>
							<option value=''>Select user</option>
							{items.map((item) => (
								<option key={item.id} value={item.id}>
									{item.username}
								</option>
							))}
						</select>
						{items.length === 0 ? renderEmptyState?.() : typeof children === "function" ? items.map((item) => <ReactLib.Fragment key={item.id}>{children(item)}</ReactLib.Fragment>) : null}
					</>
				);
			},
			{
				Item: ({ children, id }: { children: React.ReactNode; id?: string }) => {
					const autocomplete = ReactLib.useContext(AutocompleteContext);
					return autocomplete.onChange ? <button onClick={() => autocomplete.onChange?.(id ?? "")}>{children}</button> : <>{children}</>;
				},
				ItemIndicator: () => null,
			},
		),
		Link: ({ children, href }: { children: React.ReactNode; href?: string }) => <a href={href}>{children}</a>,
		SearchField: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
			Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
			SearchIcon: () => null,
			Input: () => <input aria-label='Search accounts' />,
			ClearButton: () => null,
		}),
		Spacer: () => <span />,
		useFilter: () => ({ contains: () => true }),
	};
});

describe("components/dashboardNavbar", () => {
	it("keeps the profile last in visual and keyboard order without losing account choices", async () => {
		organizationList = {
			data: [
				{ id: "creator-org", name: "Creator", metadata: { accountType: "creator" } },
				{ id: "agency-org", name: "Agency", metadata: { accountType: "agency" } },
			],
			isPending: false,
		};
		const host = document.createElement("div");
		host.id = "dashboard-utilities";
		host.setAttribute("data-dashboard-utilities-ready", "true");
		const slot = document.createElement("div");
		slot.setAttribute("data-dashboard-utility", "account");
		host.append(slot);
		document.body.append(host);
		const view = render(
			<DashboardNavigationContext.Provider value={{ toggle: jest.fn(), search: jest.fn(), expanded: true, mobile: false, registerSearch: jest.fn() }}>
				<DashboardNavbar user={mockUser()} title='Home' tagline='Overview' />
			</DashboardNavigationContext.Provider>,
		);
		try {
			const profile = await screen.findByRole("button", { name: "Log out" });
			expect(screen.queryByRole("button", { name: "Open profile menu" })).not.toBeInTheDocument();
			fireEvent.click(profile);
			expect(routerPush).toHaveBeenCalledWith("/logout");
			const children = slot.querySelectorAll("[data-dashboard-account-controls] > li");
			expect(children[children.length - 1]).toContainElement(profile);
		} finally {
			view.unmount();
			host.remove();
		}
	});

	it("hides a redundant creator selector even when the session has no explicit organization", () => {
		identitySession = { data: { session: { activeOrganizationId: null } }, isPending: false };
		organizationList = { data: [{ id: "own", name: "My creator", metadata: { accountType: "creator" } }], isPending: false };
		render(<DashboardNavbar user={mockUser()} title='Home' tagline='Overview' />);
		expect(screen.queryByText("Select account")).not.toBeInTheDocument();
	});
	beforeEach(() => {
		jest.clearAllMocks();
		window.innerWidth = 1024;
		jest.useFakeTimers();
		currentTheme = "dark";
		getActiveCampaignOfferAction.mockResolvedValue(null);
		getAdminViewCandidates.mockResolvedValue([
			{ id: "user-1", username: "alice", role: "user", plan: "free" },
			{ id: "user-2", username: "bob", role: "user", plan: "pro" },
		]);
		switchAdminView.mockResolvedValue({ ok: true });
		stopAdminView.mockResolvedValue(undefined);
		setActiveOrganization.mockResolvedValue({ data: {}, error: null });
		identitySession = { data: { session: { activeOrganizationId: "creator-org" } }, isPending: false };
		organizationList = { data: [], isPending: false };
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const mockUser = (overrides = {}) =>
		({
			id: "user-1",
			username: "alice",
			avatar: "avatar.png",
			role: "user",
			plan: "free",
			email: "a@a.com",
			createdAt: new Date(),
			updatedAt: new Date(),
			...overrides,
		}) as unknown as Parameters<typeof DashboardNavbar>[0]["user"];

	it("renders correctly and toggles theme", () => {
		const { rerender } = render(
			<DashboardNavbar user={mockUser()} title='Title' tagline='Tagline'>
				Content
			</DashboardNavbar>,
		);

		expect(screen.getByText("Title")).toBeInTheDocument();
		expect(screen.getByText("Tagline")).toBeInTheDocument();

		const themeBtn = screen.getByLabelText("Toggle Theme");
		fireEvent.click(themeBtn);
		expect(setTheme).toHaveBeenCalledWith("light");

		currentTheme = "light";
		rerender(
			<DashboardNavbar user={mockUser()} title='Title' tagline='Tagline'>
				Content
			</DashboardNavbar>,
		);
		fireEvent.click(themeBtn);
		expect(setTheme).toHaveBeenCalledWith("dark");
	});

	it("shows upgrade link for free users", () => {
		render(
			<DashboardNavbar user={mockUser({ plan: "free" })} title='T' tagline='T'>
				C
			</DashboardNavbar>,
		);
		expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Upgrade to Pro"));
		expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("upgrade"));
	});

	it("shows the active account in a compact context selector and switches organizations", async () => {
		organizationList = {
			data: [
				{ id: "creator-org", name: "alice", metadata: JSON.stringify({ accountType: "creator" }) },
				{ id: "agency-org", name: "Example Agency", metadata: JSON.stringify({ accountType: "agency" }) },
			],
			isPending: false,
		};

		render(<DashboardNavbar user={mockUser()} title='Dashboard' tagline='Test' />);

		expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
		fireEvent.click(screen.getByRole("button", { name: /Example Agency/i }));

		await waitFor(() => expect(setActiveOrganization).toHaveBeenCalledWith({ organizationId: "agency-org" }));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/agency");
		expect(routerRefresh).toHaveBeenCalled();
	});

	it("reports a failed context transport and permits a retry", async () => {
		organizationList = {
			data: [
				{ id: "creator-org", name: "Creator", metadata: { accountType: "creator" } },
				{ id: "agency-org", name: "Agency", metadata: { accountType: "agency" } },
			],
			isPending: false,
		};
		setActiveOrganization.mockRejectedValueOnce(new Error("offline"));
		render(<DashboardNavbar user={mockUser()} title='Home' tagline='Test' />);
		fireEvent.click(screen.getByRole("button", { name: /Agency/ }));
		await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Account could not be switched", color: "danger" })));
		expect(routerPush).not.toHaveBeenCalled();
		setActiveOrganization.mockResolvedValueOnce({ data: null, error: null });
		fireEvent.click(screen.getByRole("button", { name: /Agency/ }));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/dashboard/agency"));
	});

	it("puts Return to Admin in the footer section while impersonating", async () => {
		const host = document.createElement("div");
		host.id = "dashboard-utilities";
		host.setAttribute("data-dashboard-utilities-ready", "true");
		const admin = document.createElement("div");
		admin.setAttribute("data-dashboard-utility", "admin");
		host.append(admin);
		document.body.append(host);
		const view = render(
			<DashboardNavigationContext.Provider value={{ toggle: jest.fn(), search: jest.fn(), expanded: true, mobile: false, registerSearch: jest.fn() }}>
				<DashboardNavbar user={mockUser({ adminView: { active: true, adminUserId: "root", adminUsername: "root" } })} title='Home' tagline='Test' />
			</DashboardNavigationContext.Provider>,
		);
		try {
			const button = await screen.findByRole("button", { name: "Return to Admin" });
			expect(admin).toContainElement(button);
			expect(screen.getAllByText("Return to Admin")).toHaveLength(1);
			fireEvent.click(button);
			await waitFor(() => expect(stopAdminView).toHaveBeenCalledTimes(1));
		} finally {
			view.unmount();
			host.remove();
		}
	});

	it("lets an agency-only member select their one valid account from a stale context", async () => {
		identitySession = { data: { session: { activeOrganizationId: "creator-org" } }, isPending: false };
		organizationList = { data: [{ id: "agency-org", name: "Agency workspace", metadata: { accountType: "agency" } }], isPending: false };
		render(<DashboardNavbar user={mockUser({ plan: undefined })} title='Agency unavailable' tagline='Recover' />);
		expect(screen.getByText("Select account")).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: /^Agency workspace/ }));
		await waitFor(() => expect(setActiveOrganization).toHaveBeenCalledWith({ organizationId: "agency-org" }));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/agency");
	});

	it("identifies agency home without a creator breadcrumb", () => {
		render(
			<DashboardNavigationContext.Provider value={{ toggle: jest.fn(), search: jest.fn(), expanded: true, homeHref: "/dashboard/agency", registerSearch: jest.fn(), current: { href: "/dashboard/agency", title: "Agency", detail: false } }}>
				<DashboardNavbar user={mockUser()} title='Agency dashboard' tagline='Manage workspace' />
			</DashboardNavigationContext.Provider>,
		);
		expect(screen.getByText("Agency")).toBeVisible();
		expect(screen.queryByLabelText("Dashboard breadcrumb")).not.toBeInTheDocument();
	});
	it("hides upgrade link for pro users", () => {
		render(
			<DashboardNavbar user={mockUser({ plan: "pro" })} title='T' tagline='T'>
				C
			</DashboardNavbar>,
		);
		expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
	});

	it("navigates to various pages from dropdown", () => {
		render(
			<DashboardNavbar user={mockUser()} title='T' tagline='T'>
				C
			</DashboardNavbar>,
		);

		fireEvent.click(screen.getByText("My Settings"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/settings");

		fireEvent.click(screen.getByText("Tools"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/tools");

		fireEvent.click(screen.getByText("Help"));
		expect(routerPush).toHaveBeenCalledWith("https://help.clipify.us/hc/clipify/articles/1769328012-getting-started-with-clipify");

		fireEvent.click(screen.getByText("Log Out"));
		expect(routerPush).toHaveBeenCalledWith("/logout");
	});

	it("opens the card and badge collection from the Badges menu entry", () => {
		render(
			<DashboardNavbar user={mockUser({})} title='Dashboard' tagline='Test'>
				Content
			</DashboardNavbar>,
		);
		fireEvent.click(screen.getByText("Badges"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/member-card");
	});

	it("shows admin view for admins", () => {
		render(
			<DashboardNavbar user={mockUser({ role: "admin" })} title='T' tagline='T'>
				C
			</DashboardNavbar>,
		);
		expect(screen.getByText("Open Admin View")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Open Admin View"));
		expect(routerPush).toHaveBeenCalledWith("/admin");
	});

	it("shows impersonation switch bar and allows switching + exit", async () => {
		render(
			<DashboardNavbar
				user={mockUser({
					adminView: { active: true, adminUserId: "admin-1", adminUsername: "root" },
				})}
				title='Dashboard'
				tagline='Test'
			>
				<div>content</div>
			</DashboardNavbar>,
		);

		expect(screen.getByText("You are viewing as")).toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		await waitFor(() => expect(getAdminViewCandidates).toHaveBeenCalled());

		// Test search input
		fireEvent.change(screen.getByLabelText("admin-switch-search"), { target: { value: "bob" } });
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		await waitFor(() => expect(getAdminViewCandidates).toHaveBeenCalledWith("bob"));

		// Test selection
		fireEvent.change(screen.getByLabelText("admin-switch-select"), { target: { value: "user-2" } });
		await waitFor(() => expect(switchAdminView).toHaveBeenCalledWith("user-2"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard");

		// Test exit
		fireEvent.click(screen.getByRole("button", { name: "Exit" }));
		await waitFor(() => expect(stopAdminView).toHaveBeenCalledTimes(1));
		expect(routerPush).toHaveBeenCalledWith("/dashboard");
	});

	it("shows switch error when impersonation switch fails", async () => {
		switchAdminView.mockResolvedValue({ ok: false, error: "unauthorized" });

		render(
			<DashboardNavbar
				user={mockUser({
					adminView: { active: true, adminUserId: "admin-1", adminUsername: "root" },
				})}
				title='Dashboard'
				tagline='Test'
			>
				<div>content</div>
			</DashboardNavbar>,
		);

		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		await waitFor(() => expect(getAdminViewCandidates).toHaveBeenCalled());

		fireEvent.change(screen.getByLabelText("admin-switch-select"), { target: { value: "user-2" } });
		await waitFor(() => expect(switchAdminView).toHaveBeenCalledWith("user-2"));
		expect(routerPush).not.toHaveBeenCalledWith("/dashboard");
		await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Account could not be switched", description: "unauthorized", color: "danger" })));
	});

	it("handles selection of empty/null target in admin switch", async () => {
		render(
			<DashboardNavbar
				user={mockUser({
					adminView: { active: true, adminUserId: "admin-1", adminUsername: "root" },
				})}
				title='Dashboard'
				tagline='Test'
			>
				<div>content</div>
			</DashboardNavbar>,
		);

		fireEvent.change(screen.getByLabelText("admin-switch-select"), { target: { value: "" } });
		expect(switchAdminView).not.toHaveBeenCalled();
	});

	it("shows exit admin view in dropdown when impersonating", async () => {
		render(
			<DashboardNavbar
				user={mockUser({
					adminView: { active: true, adminUserId: "admin-1", adminUsername: "root", adminAvatar: "root.png" },
				})}
				title='T'
				tagline='T'
			>
				C
			</DashboardNavbar>,
		);

		expect(screen.getByText("Signed in as")).toBeInTheDocument();
		expect(screen.getByText("root")).toBeInTheDocument();
		expect(screen.getByText("Viewing as alice")).toBeInTheDocument();
		expect(screen.queryByText("Open Admin View")).not.toBeInTheDocument();
		expect(screen.getByText("Return to Admin")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Return to Admin"));
		await waitFor(() => expect(stopAdminView).toHaveBeenCalled());
	});
	it("uses shell controls and breadcrumbs without nesting another main landmark", () => {
		window.innerWidth = 390;
		const toggle = jest.fn();
		const search = jest.fn();
		const view = render(
			<DashboardNavigationContext.Provider value={{ toggle, search, expanded: false, mobile: true, registerSearch: jest.fn(), current: { href: "/dashboard/overlays", title: "Overlays", detail: false } }}>
				<DashboardNavbar user={mockUser()} title='Overlays' tagline='Your overlays'>
					Workspace
				</DashboardNavbar>
			</DashboardNavigationContext.Provider>,
		);
		expect(view.container.querySelector("main")).toBeNull();
		expect(screen.getByText("Workspace")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Toggle navigation" }));
		expect(screen.queryByRole("button", { name: "Search clips and tools" })).not.toBeInTheDocument();
		expect(toggle).toHaveBeenCalledTimes(1);
		expect(search).not.toHaveBeenCalled();
	});

	it.each([false, true])("synchronizes a requested account and refreshes only when accepted, error=%s", async (denied) => {
		organizationList.data = [
			{ id: "creator-org", name: "Creator", metadata: "{invalid" },
			{ id: "agency-org", name: "Agency", metadata: { accountType: "agency" } },
		];
		setActiveOrganization.mockResolvedValue({ data: null, error: denied ? { message: "denied" } : null });
		render(<DashboardNavbar user={mockUser()} organizationId='agency-org' title='Agency' tagline='Account' />);
		await waitFor(() => expect(setActiveOrganization).toHaveBeenCalledWith({ organizationId: "agency-org" }));
		await act(async () => {});
		expect(routerRefresh).toHaveBeenCalledTimes(denied ? 0 : 1);
		expect(routerPush).not.toHaveBeenCalled();
	});

	it("does not restore the old route account after the user switches workspaces", async () => {
		identitySession = { data: { session: { activeOrganizationId: "agency-org" } }, isPending: false };
		organizationList.data = [
			{ id: "creator-org", name: "Creator" },
			{ id: "agency-org", name: "Agency", metadata: { accountType: "agency" } },
		];
		const view = render(<DashboardNavbar user={mockUser()} organizationId='agency-org' title='Agency' tagline='Account' />);
		fireEvent.click(screen.getByRole("button", { name: /^Creator/ }));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/dashboard"));
		identitySession = { data: { session: { activeOrganizationId: "creator-org" } }, isPending: false };
		view.rerender(<DashboardNavbar user={mockUser()} organizationId='agency-org' title='Agency' tagline='Account' />);
		await act(async () => {});
		expect(setActiveOrganization).toHaveBeenCalledTimes(1);
		expect(setActiveOrganization).toHaveBeenCalledWith({ organizationId: "creator-org" });
		view.rerender(<DashboardNavbar user={mockUser()} organizationId='creator-org' title='Home' tagline='Account' />);
		view.rerender(<DashboardNavbar user={mockUser()} organizationId='agency-org' title='Agency' tagline='Account' />);
		await waitFor(() => expect(setActiveOrganization).toHaveBeenCalledWith({ organizationId: "agency-org" }));
	});

	it("ignores duplicate account switches, preserves a denied account and can retry", async () => {
		organizationList.data = [
			{ id: "creator-org", name: "Creator", metadata: "" },
			{ id: "agency-org", name: "Agency", metadata: { accountType: "agency" } },
		];
		let resolve: (value: unknown) => void = () => {};
		setActiveOrganization.mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		render(<DashboardNavbar user={mockUser()} title='Home' tagline='Account' />);
		fireEvent.click(screen.getByRole("button", { name: /^Creator/ }));
		expect(setActiveOrganization).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: /^Agency/ }));
		fireEvent.click(screen.getByRole("button", { name: /^Agency/ }));
		expect(setActiveOrganization).toHaveBeenCalledTimes(1);
		await act(async () => resolve({ data: null, error: { message: "denied" } }));
		expect(routerPush).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: /^Agency/ }));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/dashboard/agency"));
	});

	it("returns from an agency account to its creator workspace", async () => {
		identitySession = { data: { session: { activeOrganizationId: "agency-org" } }, isPending: false };
		organizationList.data = [
			{ id: "creator-org", name: "Creator", metadata: null },
			{ id: "agency-org", name: "Agency", metadata: JSON.stringify({ accountType: "agency" }) },
		];
		render(<DashboardNavbar user={mockUser({ plan: undefined, avatar: undefined })} title='Agency' tagline='Account' />);
		fireEvent.click(screen.getByText("Agency dashboard"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/agency");
		routerPush.mockClear();
		fireEvent.click(screen.getByRole("button", { name: /^Creator/ }));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/dashboard"));
	});

	it.each([
		{ badgeText: "Campaign", floatingSubtitle: "Annual discount", endAt: new Date(Date.now() + 3600000).toISOString() },
		{ badgeText: null, floatingSubtitle: null, endAt: null },
	])("keeps campaign copy and its upgrade destination available: $badgeText", async (offer) => {
		getActiveCampaignOfferAction.mockResolvedValue({ ...offer, title: "Founders", showDashboardBanner: true });
		render(<DashboardNavbar user={mockUser()} title='Home' tagline='Overview' />);
		await screen.findByText(offer.badgeText ?? "Founders");
		expect(screen.getByText(offer.floatingSubtitle ?? "Upgrade today with the active campaign price.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Upgrade Today" }));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=active_campaign");
	});

	it.each([false, true])("keeps reverse-trial upgrades consistent with entitlements, active=%s", (active) => {
		render(<DashboardNavbar user={mockUser({ entitlements: { effectivePlan: "pro", reverseTrialActive: active } })} title='Home' tagline='Overview' />);
		expect(screen.queryAllByText("Upgrade to Pro")).toHaveLength(active ? 1 : 0);
	});

	it("keeps the agency menu usable before identity and organization data arrive", () => {
		identitySession = { data: null, isPending: true };
		organizationList = { data: undefined, isPending: true };
		render(<DashboardNavbar user={mockUser({ plan: undefined, avatar: undefined })} title='Agency' tagline='Account' />);
		expect(screen.getByText("Agency dashboard")).toBeInTheDocument();
		expect(screen.getByText("Loading accounts…")).toBeInTheDocument();
		expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
	});

	it("shows empty/loading search guidance and ignores obsolete admin candidates", async () => {
		let resolveOld: (value: unknown) => void = () => {};
		getAdminViewCandidates
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveOld = resolve;
					}),
			)
			.mockResolvedValue([]);
		render(<DashboardNavbar user={mockUser({ adminView: { active: true, adminUserId: "admin" } })} title='Home' tagline='Admin view' />);
		expect(screen.getByText("admin")).toBeInTheDocument();
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("admin-switch-search"), { target: { value: "" } });
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		expect(screen.getByText("Type to search...")).toBeInTheDocument();
		await act(async () => resolveOld([{ id: "obsolete", username: "Old result" }]));
		expect(screen.queryByRole("option", { name: "Old result" })).not.toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("admin-switch-search"), { target: { value: "bo" } });
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		expect(screen.getByText("Keep typing...")).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("admin-switch-search"), { target: { value: "none" } });
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		expect(screen.getByText("No users found.")).toBeInTheDocument();
	});
});

it("keeps the server-rendered menu trigger disabled until hydration", () => {
	const { renderToString } = jest.requireActual("react-dom/server.node");
	const html = renderToString(
		<DashboardNavigationContext.Provider value={{ toggle: jest.fn(), search: jest.fn(), expanded: false, mobile: true, registerSearch: jest.fn() }}>
			<DashboardNavigationControls />
		</DashboardNavigationContext.Provider>,
	);
	const server = document.createElement("div");
	server.innerHTML = html;
	expect(server.querySelector('button[aria-label="Toggle navigation"]')).toBeDisabled();
});
