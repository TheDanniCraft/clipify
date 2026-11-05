import { render, screen } from "@testing-library/react";
const auth = jest.fn();
jest.mock("@actions/auth", () => ({ validateAdminAuth: (...args: unknown[]) => auth(...args) }));
jest.mock("next/navigation", () => ({
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
}));
jest.mock("@components/dashboardShell", () => ({ __esModule: true, default: ({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) => <section aria-label={isAdmin ? "Admin sidebar" : "Creator sidebar"}>{children}</section> }));
jest.mock("@components/SentryFeedbackWidget", () => ({ __esModule: true, default: () => <p>Feedback</p> }));
import Layout from "@/app/admin/layout";
it("keeps operations and agencies in the shared sidebar layout", async () => {
	auth.mockResolvedValue({ id: "admin" });
	render(await Layout({ children: <p>Operations</p> }));
	expect(auth).toHaveBeenCalledWith(true);
	expect(screen.getByRole("region", { name: "Admin sidebar" })).toBeVisible();
	expect(screen.getByText("Feedback")).toBeVisible();
});
it("rejects a non-admin before rendering administration", async () => {
	auth.mockResolvedValue(false);
	await expect(Layout({ children: <p>Restricted</p> })).rejects.toThrow("NEXT_NOT_FOUND");
});
