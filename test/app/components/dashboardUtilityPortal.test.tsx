import { act, render, screen, waitFor } from "@testing-library/react";
import { createPortal } from "react-dom";
import DashboardUtilityPortal from "@components/dashboardUtilityPortal";
let pathname = "/dashboard";
beforeEach(() => {
	pathname = "/dashboard";
});
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
it("moves a utility into the shell when asynchronous content mounts, and survives its removal", async () => {
	const view = render(
		<DashboardUtilityPortal>
			<button>Support</button>
		</DashboardUtilityPortal>,
	);
	expect(screen.queryByRole("button")).not.toBeInTheDocument();
	const target = document.createElement("div");
	target.id = "dashboard-utilities";
	await act(async () => {
		document.body.append(target);
	});
	expect(target).toBeEmptyDOMElement();
	expect(screen.queryByRole("button")).not.toBeInTheDocument();
	await act(async () => {
		target.setAttribute("data-dashboard-utilities-ready", "true");
	});
	await waitFor(() => expect(target).toContainElement(screen.getByRole("button")));
	await act(async () => {
		target.remove();
	});
	await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
	view.unmount();
});

it("does not move admin profile controls into the header before the sidebar mounts", () => {
	pathname = "/admin";
	render(
		<DashboardUtilityPortal slot='account'>
			<button>Profile</button>
		</DashboardUtilityPortal>,
	);
	expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("retains the public floating utility outside dashboard routes", () => {
	pathname = "/";
	render(
		<DashboardUtilityPortal>
			<button>Support</button>
		</DashboardUtilityPortal>,
	);
	expect(screen.getByRole("button", { name: "Support" })).toBeVisible();
});

it("keeps a body-portaled guide panel open after the mobile sidebar host closes", async () => {
	const host = document.createElement("div");
	host.id = "dashboard-utilities";
	host.setAttribute("data-dashboard-utilities-ready", "true");
	document.body.append(host);
	const view = render(
		<DashboardUtilityPortal slot='guide'>
			<button>Guide</button>
			{createPortal(<section aria-label='Guide panel'>Guide content</section>, document.body)}
		</DashboardUtilityPortal>,
	);
	await waitFor(() => expect(host).toContainElement(screen.getByRole("button", { name: "Guide" })));
	await act(async () => {
		host.remove();
	});
	await waitFor(() => expect(screen.queryByRole("button", { name: "Guide" })).not.toBeInTheDocument());
	expect(screen.getByRole("region", { name: "Guide panel" })).toBeVisible();
	view.unmount();
});
