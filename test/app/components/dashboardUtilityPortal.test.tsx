import { act, render, screen, waitFor } from "@testing-library/react";
import DashboardUtilityPortal from "@components/dashboardUtilityPortal";
jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
it("moves a utility into the shell when asynchronous content mounts, and survives its removal", async () => {
	const view = render(
		<DashboardUtilityPortal>
			<button>Support</button>
		</DashboardUtilityPortal>,
	);
	expect(view.container).toContainElement(screen.getByRole("button"));
	const target = document.createElement("div");
	target.id = "dashboard-utilities";
	await act(async () => {
		document.body.append(target);
	});
	expect(target).toBeEmptyDOMElement();
	expect(view.container).toContainElement(screen.getByRole("button"));
	await act(async () => {
		target.setAttribute("data-dashboard-utilities-ready", "true");
	});
	await waitFor(() => expect(target).toContainElement(screen.getByRole("button")));
	await act(async () => {
		target.remove();
	});
	await waitFor(() => expect(view.container).toContainElement(screen.getByRole("button")));
	view.unmount();
});
