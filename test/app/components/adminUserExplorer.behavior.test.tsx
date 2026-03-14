import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminUserExplorer from "@/app/components/adminUserExplorer";

const routerPush = jest.fn();
const routerRefresh = jest.fn();
const startAdminView = jest.fn();
const getAdminExplorerPage = jest.fn();

jest.mock("next/navigation", () => ({
	useRouter: () => ({
		push: routerPush,
		refresh: routerRefresh,
	}),
}));

jest.mock("@actions/auth", () => ({
	startAdminView: (...args: unknown[]) => startAdminView(...args),
}));

jest.mock("@actions/adminView", () => ({
	getAdminExplorerPage: (...args: unknown[]) => getAdminExplorerPage(...args),
}));

jest.mock("@heroui/react", () => ({
	Button: ({ children, onPress, isDisabled }: { children: React.ReactNode; onPress?: () => void; isDisabled?: boolean }) => (
		<button onClick={onPress} disabled={isDisabled}>
			{children}
		</button>
	),
	Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
	CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
	Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
	Input: ({ value, onValueChange, endContent }: { value?: string; onValueChange?: (v: string) => void; endContent?: React.ReactNode }) => (
		<div>
			<input
				value={value}
				onChange={(e) => {
					if (onValueChange) onValueChange(e.target.value);
				}}
			/>
			{endContent}
		</div>
	),
	Spinner: () => <div>Loading...</div>,
	Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
	TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
	TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
	TableColumn: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
	TableHeader: ({ children }: { children: React.ReactNode }) => (
		<thead>
			<tr>{children}</tr>
		</thead>
	),
	TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

describe("components/adminUserExplorer behavior", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		startAdminView.mockResolvedValue({ ok: true });
		getAdminExplorerPage.mockResolvedValue({
			users: [],
			page: 1,
			totalPages: 1,
			totalRows: 0,
		});
	});

	it("switches immediately to selected user dashboard when action succeeds", async () => {
		render(
			<AdminUserExplorer
				users={[
					{
						id: "u1",
						username: "alice",
						email: "alice@example.com",
						role: "user",
						plan: "free",
						lastLoginLabel: "now",
					},
				]}
				initialPage={1}
				initialTotalPages={1}
				initialTotalRows={1}
				initialQuery=''
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "View as User" }));

		await waitFor(() => expect(startAdminView).toHaveBeenCalledWith("u1"));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/dashboard"));
		expect(routerRefresh).toHaveBeenCalled();
	});

	it("navigates back to admin with error when switching fails", async () => {
		startAdminView.mockResolvedValue({ ok: false, error: "unauthorized" });
		render(
			<AdminUserExplorer
				users={[
					{
						id: "u1",
						username: "alice",
						email: "alice@example.com",
						role: "user",
						plan: "free",
						lastLoginLabel: "now",
					},
				]}
				initialPage={1}
				initialTotalPages={1}
				initialTotalRows={1}
				initialQuery=''
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "View as User" }));

		await waitFor(() => expect(startAdminView).toHaveBeenCalledWith("u1"));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin?error=unauthorized"));
		expect(routerRefresh).not.toHaveBeenCalled();
	});

	it("requests server-side search updates without writing URL params", async () => {
		jest.useFakeTimers();
		getAdminExplorerPage.mockResolvedValue({
			users: [{ id: "u2", username: "bob", email: "bob@example.com", role: "user", plan: "free", lastLogin: null }],
			page: 1,
			totalPages: 1,
			totalRows: 1,
		});
		render(
			<AdminUserExplorer
				users={[
					{ id: "u1", username: "alice", email: "alice@example.com", role: "user", plan: "free", lastLoginLabel: "now" },
					{ id: "u2", username: "bob", email: "bob@example.com", role: "user", plan: "free", lastLoginLabel: "now" },
				]}
				initialPage={1}
				initialTotalPages={1}
				initialTotalRows={2}
				initialQuery=''
			/>,
		);

		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "bob" } });

		act(() => {
			jest.advanceTimersByTime(400);
		});

		await waitFor(() => expect(getAdminExplorerPage).toHaveBeenCalledWith("bob", 1, 25));
		await waitFor(() => expect(screen.getByText("@bob")).toBeInTheDocument());
		expect(routerPush).not.toHaveBeenCalled();
		jest.useRealTimers();
	});

	it("requests server-side pagination when clicking next/previous", async () => {
		const users = Array.from({ length: 25 }, (_, idx) => ({
			id: `u${idx + 1}`,
			username: `user${idx + 1}`,
			email: `user${idx + 1}@example.com`,
			role: "user",
			plan: "free",
			lastLoginLabel: "now",
		}));
		getAdminExplorerPage
			.mockResolvedValueOnce({
				users: [{ id: "u26", username: "user26", email: "user26@example.com", role: "user", plan: "free", lastLogin: null }],
				page: 2,
				totalPages: 2,
				totalRows: 26,
			})
			.mockResolvedValueOnce({
				users,
				page: 1,
				totalPages: 2,
				totalRows: 26,
			});
		render(<AdminUserExplorer users={users} initialPage={1} initialTotalPages={2} initialTotalRows={26} initialQuery='' />);

		expect(screen.getByText("Page 1 / 2")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		await waitFor(() => expect(getAdminExplorerPage).toHaveBeenCalledWith("", 2, 25));
		await waitFor(() => expect(screen.getByText("Page 2 / 2")).toBeInTheDocument());
		await waitFor(() => expect(screen.getByText("@user26")).toBeInTheDocument());

		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		await waitFor(() => expect(getAdminExplorerPage).toHaveBeenCalledWith("", 1, 25));
		await waitFor(() => expect(screen.getByText("Page 1 / 2")).toBeInTheDocument());
		expect(routerPush).not.toHaveBeenCalled();
	});

	it("ignores stale overlapping explorer responses", async () => {
		jest.useFakeTimers();
		let resolveSlow!: (value: unknown) => void;
		let resolveFast!: (value: unknown) => void;
		const slow = new Promise((resolve) => {
			resolveSlow = resolve;
		});
		const fast = new Promise((resolve) => {
			resolveFast = resolve;
		});

		getAdminExplorerPage.mockReturnValueOnce(slow).mockReturnValueOnce(fast);

		render(
			<AdminUserExplorer
				users={[{ id: "u0", username: "base", email: "base@example.com", role: "user", plan: "free", lastLoginLabel: "now" }]}
				initialPage={1}
				initialTotalPages={1}
				initialTotalRows={1}
				initialQuery=''
			/>,
		);

		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "a" } });
		act(() => {
			jest.advanceTimersByTime(400);
		});
		fireEvent.change(input, { target: { value: "alice" } });
		act(() => {
			jest.advanceTimersByTime(400);
		});

		expect(getAdminExplorerPage).toHaveBeenNthCalledWith(1, "a", 1, 25);
		expect(getAdminExplorerPage).toHaveBeenNthCalledWith(2, "alice", 1, 25);

		resolveFast({
			users: [{ id: "u-alice", username: "alice", email: "alice@example.com", role: "user", plan: "free", lastLogin: null }],
			page: 1,
			totalPages: 1,
			totalRows: 1,
		});
		await waitFor(() => expect(screen.getByText("@alice")).toBeInTheDocument());

		resolveSlow({
			users: [{ id: "u-a", username: "a-user", email: "a@example.com", role: "user", plan: "free", lastLogin: null }],
			page: 1,
			totalPages: 1,
			totalRows: 1,
		});
		await act(async () => Promise.resolve());

		expect(screen.queryByText("@a-user")).not.toBeInTheDocument();
		expect(screen.getByText("@alice")).toBeInTheDocument();
		jest.useRealTimers();
	});

	it("uses current input text for pagination even before debounce commits", async () => {
		jest.useFakeTimers();
		const users = Array.from({ length: 25 }, (_, idx) => ({
			id: `u${idx + 1}`,
			username: `user${idx + 1}`,
			email: `user${idx + 1}@example.com`,
			role: "user",
			plan: "free",
			lastLoginLabel: "now",
		}));
		getAdminExplorerPage.mockResolvedValue({
			users: [{ id: "u-alice", username: "alice", email: "alice@example.com", role: "user", plan: "free", lastLogin: null }],
			page: 2,
			totalPages: 2,
			totalRows: 26,
		});

		render(<AdminUserExplorer users={users} initialPage={1} initialTotalPages={2} initialTotalRows={26} initialQuery='' />);

		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "alice" } });
		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		await waitFor(() => expect(getAdminExplorerPage).toHaveBeenCalledWith("alice", 2, 25));
		jest.useRealTimers();
	});

	it("keeps loading state active while explorer request is in flight", async () => {
		let resolveRequest!: (value: unknown) => void;
		const pendingRequest = new Promise((resolve) => {
			resolveRequest = resolve;
		});
		getAdminExplorerPage.mockReturnValueOnce(pendingRequest);

		const users = Array.from({ length: 25 }, (_, idx) => ({
			id: `u${idx + 1}`,
			username: `user${idx + 1}`,
			email: `user${idx + 1}@example.com`,
			role: "user",
			plan: "free",
			lastLoginLabel: "now",
		}));
		render(<AdminUserExplorer users={users} initialPage={1} initialTotalPages={2} initialTotalRows={26} initialQuery='' />);

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(screen.getByText("Loading...")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

		resolveRequest({
			users: [{ id: "u26", username: "user26", email: "user26@example.com", role: "user", plan: "free", lastLogin: null }],
			page: 2,
			totalPages: 2,
			totalRows: 26,
		});
		await waitFor(() => expect(screen.queryByText("Loading...")).not.toBeInTheDocument());
	});
});
