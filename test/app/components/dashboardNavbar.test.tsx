import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardNavbar from "@/app/components/dashboardNavbar";

const setTheme = jest.fn();
const routerPush = jest.fn();
const routerRefresh = jest.fn();
const getAdminViewCandidates = jest.fn();
const switchAdminView = jest.fn();
const stopAdminView = jest.fn();

jest.mock("next-themes", () => ({
	useTheme: () => ({
		theme: "dark",
		setTheme,
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

jest.mock("@heroui/react", () => ({
	Avatar: ({ src }: { src?: string }) => <div data-avatar={src ?? ""} />,
	Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Button: ({ children, onPress, isDisabled }: { children: React.ReactNode; onPress?: () => void; isDisabled?: boolean }) => (
		<button onClick={onPress} disabled={isDisabled}>
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
	Autocomplete: ({
		inputValue,
		onInputChange,
		onSelectionChange,
		defaultItems,
	}: {
		inputValue?: string;
		onInputChange?: (value: string) => void;
		onSelectionChange?: (key: string) => void;
		defaultItems?: Array<{ id: string; username: string }>;
	}) => (
		<div>
			<input aria-label='admin-switch-search' value={inputValue} onChange={(event) => onInputChange?.(event.target.value)} />
			<select aria-label='admin-switch-select' onChange={(event) => onSelectionChange?.(event.target.value)}>
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
}));

describe("components/dashboardNavbar", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
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

	it("shows impersonation switch bar and allows switching + exit", async () => {
		render(
			<DashboardNavbar
				user={
					{
						id: "user-1",
						username: "alice",
						avatar: "",
						role: "user",
						plan: "free",
						email: "a@a.com",
						createdAt: new Date(),
						updatedAt: new Date(),
						adminView: { active: true, adminUserId: "admin-1", adminUsername: "root" },
					} as never
				}
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

		fireEvent.change(screen.getByLabelText("admin-switch-select"), { target: { value: "user-2" } });
		await waitFor(() => expect(switchAdminView).toHaveBeenCalledWith("user-2"));
		expect(routerPush).toHaveBeenCalledWith("/dashboard");

		fireEvent.click(screen.getByRole("button", { name: "Exit" }));
		await waitFor(() => expect(stopAdminView).toHaveBeenCalledTimes(1));
	});

	it("shows switch error when impersonation switch fails", async () => {
		switchAdminView.mockResolvedValue({ ok: false, error: "unauthorized" });

		render(
			<DashboardNavbar
				user={
					{
						id: "user-1",
						username: "alice",
						avatar: "",
						role: "user",
						plan: "free",
						email: "a@a.com",
						createdAt: new Date(),
						updatedAt: new Date(),
						adminView: { active: true, adminUserId: "admin-1", adminUsername: "root" },
					} as never
				}
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
});
