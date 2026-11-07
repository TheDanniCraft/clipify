import { render, screen } from "@testing-library/react";
let path = "/admin";
jest.mock("next/navigation", () => ({ usePathname: () => path }));
jest.mock(
	"@heroui-pro/react",
	() => {
		const wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
		return {
			Sidebar: {
				Group: wrapper,
				GroupLabel: wrapper,
				Menu: ({ children, ...props }: { children: React.ReactNode }) => <nav {...props}>{children}</nav>,
				MenuItem: ({ isCurrent, children, render }: { isCurrent: boolean; children: React.ReactNode; render: (props: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode }) => render({ role: "link", "aria-current": isCurrent ? "page" : undefined, children }),
				MenuIcon: wrapper,
				MenuLabel: wrapper,
			},
		};
	},
	{ virtual: true },
);
import AdminNavigation from "@components/adminNavigation";
it.each(["/admin", "/admin/agencies"])("exposes admin sections as sidebar links on %s", (route) => {
	path = route;
	render(<AdminNavigation />);
	expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
	expect(screen.getByRole("link", { name: route === "/admin" ? "Operations" : "Agencies" })).toHaveAttribute("aria-current", "page");
	expect(screen.getByRole("link", { name: route === "/admin" ? "Agencies" : "Operations" })).not.toHaveAttribute("aria-current");
	expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});
