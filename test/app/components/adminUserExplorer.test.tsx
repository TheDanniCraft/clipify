import React from "react";
import { render, screen } from "@testing-library/react";
import AdminUserExplorer from "@/app/components/adminUserExplorer";

jest.mock("next/navigation", () => ({
	useRouter: () => ({
		push: jest.fn(),
		refresh: jest.fn(),
	}),
}));

jest.mock("@actions/auth", () => ({
	startAdminView: jest.fn(async () => ({ ok: true })),
}));

describe("components/adminUserExplorer", () => {
	it("renders user explorer table and rows", () => {
		render(
			<AdminUserExplorer
				users={[
					{
						id: "u1",
						username: "alice",
						email: "alice@example.com",
						role: "user",
						plan: "free",
						lastLoginLabel: "3/9/2026, 10:00:00 AM",
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

		expect(screen.getByText("User Explorer")).toBeInTheDocument();
		expect(screen.getByText("@alice")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "View as User" })).toBeInTheDocument();
	});
});
