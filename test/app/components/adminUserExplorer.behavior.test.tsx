import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminUserExplorer from "@/app/components/adminUserExplorer";

const routerPush = jest.fn();
const routerRefresh = jest.fn();
const startAdminView = jest.fn();

jest.mock("next/navigation", () => ({
	useRouter: () => ({
		push: routerPush,
		refresh: routerRefresh,
	}),
}));

jest.mock("@actions/auth", () => ({
	startAdminView: (...args: unknown[]) => startAdminView(...args),
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
	Input: ({ defaultValue }: { defaultValue?: string }) => <input defaultValue={defaultValue} />,
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
				query=''
				page={1}
				totalPages={1}
				totalRows={1}
				firstRowNumber={1}
				lastRowNumber={1}
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
				query=''
				page={1}
				totalPages={1}
				totalRows={1}
				firstRowNumber={1}
				lastRowNumber={1}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "View as User" }));

		await waitFor(() => expect(startAdminView).toHaveBeenCalledWith("u1"));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin?error=unauthorized"));
		expect(routerRefresh).not.toHaveBeenCalled();
	});
});
