import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardNavbar from "@/app/components/dashboardNavbar";

const setTheme = jest.fn();
const routerPush = jest.fn();
const routerRefresh = jest.fn();
const getAdminViewCandidates = jest.fn();
const switchAdminView = jest.fn();
const stopAdminView = jest.fn();
let currentTheme = "dark";

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

jest.mock("@components/logo", () => ({
	__esModule: true,
	default: () => <div>logo</div>,
}));

jest.mock("@heroui/react", () => {
	return {
		Avatar: ({ src }: { src?: string }) => <div data-avatar={src ?? ""} />,
		Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Button: ({ children, onPress, isDisabled, "aria-label": ariaLabel }: { children: React.ReactNode; onPress?: () => void; isDisabled?: boolean; "aria-label"?: string }) => (
			<button onClick={onPress} disabled={isDisabled} aria-label={ariaLabel}>
				{children}
			</button>
		),
		Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		DropdownItem: ({ children, onPress, isDisabled }: { children: React.ReactNode; onPress?: () => void; isDisabled?: boolean }) => (
			<button onClick={onPress} disabled={isDisabled}>
				{children}
			</button>
		),
		DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		DropdownTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Autocomplete: ({ inputValue, onInputChange, onSelectionChange, defaultItems }: { inputValue?: string; onInputChange?: (val: string) => void; onSelectionChange?: (key: string) => void; defaultItems?: Array<{ id: string; username: string }> }) => (
			<div>
				<input aria-label='admin-switch-search' value={inputValue} onChange={(event) => onInputChange?.(event.target.value)} />
				<select aria-label='admin-switch-select' onChange={(event) => onSelectionChange?.(event.target.value)}>
					<option value=''>Select user</option>
					{(defaultItems ?? []).map((item) => (
						<option key={item.id} value={item.id}>
							{item.username}
						</option>
					))}
				</select>
			</div>
		),
		AutocompleteItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Link: ({ children, href }: { children: React.ReactNode; href?: string }) => <a href={href}>{children}</a>,
		Navbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		NavbarBrand: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		NavbarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		NavbarItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		Spacer: () => <span />,
	};
});

describe("components/dashboardNavbar", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		currentTheme = "dark";
		getAdminViewCandidates.mockResolvedValue([
			{ id: "user-1", username: "alice", role: "user", plan: "free" },
			{ id: "user-2", username: "bob", role: "user", plan: "pro" },
		]);
		switchAdminView.mockResolvedValue({ ok: true });
		stopAdminView.mockResolvedValue(undefined);
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

		fireEvent.click(screen.getByText("Embed Overlay"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard/embed");

		fireEvent.click(screen.getByText("Help"));
		expect(routerPush).toHaveBeenCalledWith("https://help.clipify.us/");

		fireEvent.click(screen.getByText("Refer a Friend"));
		expect(routerPush).toHaveBeenCalledWith("/referral-program");

		fireEvent.click(screen.getByText("Log Out"));
		expect(routerPush).toHaveBeenCalledWith("/logout");
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
		await waitFor(() => expect(screen.getByText("Switch failed: unauthorized")).toBeInTheDocument());
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

	it("shows exit admin view in dropdown when impersonating", () => {
		render(
			<DashboardNavbar
				user={mockUser({
					adminView: { active: true, adminUserId: "admin-1", adminUsername: "root" },
				})}
				title='T'
				tagline='T'
			>
				C
			</DashboardNavbar>,
		);

		expect(screen.getByText("Exit Admin View")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Exit Admin View"));
		expect(stopAdminView).toHaveBeenCalled();
	});
});
