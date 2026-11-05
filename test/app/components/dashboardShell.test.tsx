import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardShell from "@components/dashboardShell";
import { DashboardNavigationControls, DashboardBreadcrumbs } from "@components/dashboardNavigation";
import { PERMISSIONS } from "@/auth/permissions";
let path = "/dashboard/clips";
let mobile = false;
const push = jest.fn();
const search = jest.fn();
const preview = jest.fn().mockResolvedValue({ playbackUrl: "https://example.com/clip.mp4" });
jest.mock("next/navigation", () => ({ usePathname: () => path, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }));
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
		<section>
			<button onClick={onClose}>Close clip preview</button>
			{children}
		</section>
	),
}));
jest.mock("@actions/creatorLibrary", () => ({ searchCreatorLibrary: (...args: unknown[]) => search(...args), getCreatorClipPreview: (...args: unknown[]) => preview(...args) }));
jest.mock(
	"@heroui-pro/react",
	() => {
		const React = jest.requireActual("react");
		const wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
		const SearchContext = React.createContext(null);
		const ActionContext = React.createContext(null);
		const Sidebar = Object.assign(wrapper, {
			Provider: wrapper,
			Header: wrapper,
			Content: wrapper,
			Footer: wrapper,
			Group: wrapper,
			Menu: wrapper,
			MenuIcon: wrapper,
			MenuLabel: wrapper,
			MenuTrigger: wrapper,
			MenuIndicator: wrapper,
			Submenu: wrapper,
			Main: wrapper,
			Mobile: () => null,
			MenuItem: ({ children, render, href }: { children: React.ReactNode; render?: (props: Record<string, unknown>) => React.ReactNode; href?: string }) => (render ? render({ "data-href": href, children }) : <div>{children}</div>),
		});
		const Input = ({ onKeyDownCapture, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
			const state = React.useContext(SearchContext);
			return <input {...props} value={state.value} onChange={(event) => state.change(event.target.value)} onKeyDownCapture={onKeyDownCapture} />;
		};
		const Command = Object.assign(wrapper, {
			Backdrop: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? <section role='dialog'>{children}</section> : null),
			Container: wrapper,
			Dialog: ({ inputValue, onInputChange, children }: { inputValue: string; onInputChange: (value: string) => void; children: React.ReactNode }) => <SearchContext.Provider value={{ value: inputValue, change: onInputChange }}>{children}</SearchContext.Provider>,
			InputGroup: Object.assign(wrapper, { Prefix: wrapper, Input, ClearButton: () => null }),
			List: ({ onAction, children, renderEmptyState }: { onAction: (key: string) => void; children: React.ReactNode; renderEmptyState: () => React.ReactNode }) => (
				<ActionContext.Provider value={onAction}>
					{children}
					{renderEmptyState()}
				</ActionContext.Provider>
			),
			Group: wrapper,
			Item: ({ id, children }: { id: string; children: React.ReactNode }) => {
				const action = React.useContext(ActionContext);
				return <button onClick={() => action(id)}>{children}</button>;
			},
			Footer: wrapper,
		});
		return {
			Sidebar,
			Command,
			useSidebar: function useSidebar() {
				const [isMobileOpen, setMobileOpen] = React.useState(false);
				return { isMobile: mobile, isMobileOpen, setMobileOpen };
			},
		};
	},
	{ virtual: true },
);
jest.mock("@components/adminNavigation", () => ({ __esModule: true, default: () => <nav aria-label='Admin sections'>Operations Agencies</nav> }));
const content = (
	<>
		<DashboardNavigationControls />
		<DashboardBreadcrumbs />
		<p>Resource editor</p>
	</>
);
beforeEach(() => {
	path = "/dashboard/clips";
	mobile = false;
	window.innerWidth = 1024;
	jest.clearAllMocks();
	search.mockResolvedValue({ ok: true, items: [] });
});
it("renders only authorized destinations and active breadcrumbs", () => {
	render(
		<DashboardShell creatorId='owner' permissions={["creator:read"]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.getAllByText("Clip Inventory")).toHaveLength(2);
	expect(screen.queryByText("Overlays")).not.toBeInTheDocument();
	expect(screen.getByText("Resource editor")).toBeInTheDocument();
});
it.each([
	["/dashboard/overlay/A", "Overlays"],
	["/dashboard/playlist/A", "Playlists"],
	["/dashboard/runner/A", "Runner"],
	["/dashboard/streams/123", "Streams"],
])("keeps the editor destination active for %s", (route, title) => {
	path = route;
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.getAllByText(title).length).toBeGreaterThan(0);
	expect(screen.getByText(route.startsWith("/dashboard/streams/") ? "Stream" : "Editor")).toBeInTheDocument();
});
it("leaves embedded gallery previews free of dashboard chrome", () => {
	path = "/dashboard/galleries/A/preview";
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			<p>Preview</p>
		</DashboardShell>,
	);
	expect(screen.getByText("Preview")).toBeInTheDocument();
	expect(screen.queryByText("Creator tools")).not.toBeInTheDocument();
});
it("toggles desktop navigation by button and shortcut without stealing input shortcuts", () => {
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	const toggle = screen.getByRole("button", { name: "Toggle navigation" });
	fireEvent.click(toggle);
	expect(toggle).toHaveAttribute("aria-expanded", "false");
	fireEvent.click(screen.getByRole("button", { name: "Show help and getting started" }));
	expect(toggle).toHaveAttribute("aria-expanded", "true");
	fireEvent.click(toggle);
	fireEvent.keyDown(document, { ctrlKey: true, key: "b" });
	expect(toggle).toHaveAttribute("aria-expanded", "true");
	fireEvent.keyDown(document, { key: "b" });
	expect(toggle).toHaveAttribute("aria-expanded", "true");
});
it("navigates to the exact searched clip detail", async () => {
	search.mockResolvedValue({ ok: true, items: [{ id: "A", title: "Clutch" }] });
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Search clips and tools" }));
	fireEvent.change(screen.getByPlaceholderText("Search clips and tools…"), { target: { value: "Clutch" } });
	await screen.findByRole("button", { name: "Clutch" });
	expect(search).toHaveBeenCalledWith({ creatorId: "owner", title: "Clutch" });
	fireEvent.click(screen.getByRole("button", { name: "Clutch" }));
	await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/clips/A"));
	expect(preview).not.toHaveBeenCalled();
});
it("navigates directly to a permitted tool", () => {
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
	fireEvent.change(screen.getByPlaceholderText("Search clips and tools…"), { target: { value: "Streams" } });
	fireEvent.click(screen.getByRole("button", { name: "Streams" }));
	expect(push).toHaveBeenCalledWith("/dashboard/streams");
});
it.each(["typed", "transport"])("retries %s clip search failures locally", async (mode) => {
	if (mode === "typed") search.mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" });
	else search.mockRejectedValueOnce(new Error("offline"));
	search.mockResolvedValue({ ok: true, items: [{ id: "A", title: "Recovered" }] });
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Search clips and tools" }));
	fireEvent.change(screen.getByPlaceholderText("Search clips and tools…"), { target: { value: "Clutch" } });
	fireEvent.click(await screen.findByRole("button", { name: "Retry clip search" }));
	await screen.findByRole("button", { name: "Recovered" });
});
it("closes search on Escape and restores the launcher focus", async () => {
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	const launcher = screen.getByRole("button", { name: "Search clips and tools" });
	fireEvent.click(launcher);
	fireEvent.change(screen.getByPlaceholderText("Search clips and tools…"), { target: { value: "Clutch" } });
	fireEvent.keyDown(screen.getByPlaceholderText("Search clips and tools…"), { key: "Escape" });
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	await waitFor(() => expect(launcher).toHaveFocus());
});
it("ignores a search response after its query is superseded", async () => {
	let finish: (value: unknown) => void = () => {};
	search.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve))).mockResolvedValue({ ok: true, items: [{ id: "B", title: "Current" }] });
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Search clips and tools" }));
	const input = screen.getByPlaceholderText("Search clips and tools…");
	fireEvent.change(input, { target: { value: "First" } });
	await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
	fireEvent.change(input, { target: { value: "Second" } });
	await screen.findByRole("button", { name: "Current" });
	finish({ ok: true, items: [{ id: "A", title: "Stale" }] });
	await waitFor(() => expect(screen.queryByRole("button", { name: "Stale" })).not.toBeInTheDocument());
	fireEvent.click(screen.getByRole("button", { name: "Close search" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("closes mobile navigation before opening command search", async () => {
	mobile = true;
	window.innerWidth = 390;
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	const toggle = screen.getByRole("button", { name: "Toggle navigation" });
	fireEvent.click(toggle);
	expect(toggle).toHaveAttribute("aria-expanded", "true");
	fireEvent.click(screen.getByRole("button", { name: "Search clips and tools" }));
	expect(toggle).toHaveAttribute("aria-expanded", "false");
	await screen.findByRole("dialog");
});
it("does not steal shortcuts from a field or an existing modal", () => {
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
			<input aria-label='Draft' />
			<section role='dialog' aria-modal='true'>
				Editor modal
			</section>
		</DashboardShell>,
	);
	fireEvent.keyDown(screen.getByRole("textbox", { name: "Draft" }), { ctrlKey: true, key: "k" });
	expect(screen.queryByPlaceholderText("Search clips and tools…")).not.toBeInTheDocument();
	fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
	expect(screen.queryByPlaceholderText("Search clips and tools…")).not.toBeInTheDocument();
});
it.each([
	["overlays", "Overlays"],
	["playlists", "Playlists"],
	["galleries", "Galleries"],
	["runners", "Runner"],
])("exposes the already-open mobile %s destination to the guide", (resource, _title) => {
	mobile = true;
	window.innerWidth = 390;
	path = `/dashboard/${resource}`;
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	expect(document.querySelector(`[data-tour="${resource}-tab"][aria-current="page"]`)).not.toBeNull();
	expect(screen.getByText("Resource editor")).toBeInTheDocument();
});

it("closes mobile navigation for a utility portaled from another React owner", () => {
	mobile = true;
	window.innerWidth = 390;
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	const toggle = screen.getByRole("button", { name: "Toggle navigation" });
	fireEvent.click(toggle);
	const utility = document.createElement("button");
	document.getElementById("dashboard-mobile-utilities")!.append(utility);
	fireEvent.click(utility);
	expect(toggle).toHaveAttribute("aria-expanded", "false");
});

it("waits for the mobile breakpoint before enabling the first menu press", () => {
	window.innerWidth = 390;
	const view = render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.getByRole("button", { name: "Toggle navigation" })).toBeDisabled();
	mobile = true;
	view.rerender(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	const toggle = screen.getByRole("button", { name: "Toggle navigation" });
	expect(toggle).toBeEnabled();
	fireEvent.click(toggle);
	expect(toggle).toHaveAttribute("aria-expanded", "true");
});

it.each([
	["/dashboard/clips/A", "Clip"],
	["/dashboard/clips/layout", "Portrait layout"],
])("labels the clip workspace breadcrumb for %s", (route, label) => {
	path = route;
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
});

it("orders identity, guide, admin and support consistently in the footer", () => {
	render(
		<DashboardShell creatorId='admin' permissions={[...PERMISSIONS]} isAdmin>
			{content}
		</DashboardShell>,
	);
	const slots = [...document.querySelectorAll("[data-dashboard-utility]")].map((node) => node.getAttribute("data-dashboard-utility"));
	expect(slots).toEqual(["exports", "account", "guide", "admin", "chat", "report"]);
	expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
});
it("does not expose admin navigation to a creator", () => {
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.queryByRole("navigation", { name: "Admin sections" })).not.toBeInTheDocument();
	expect(screen.getByText("Badges")).toBeInTheDocument();
});

it("recognizes Badges as a sidebar destination", () => {
	path = "/dashboard/member-card";
	render(
		<DashboardShell creatorId='owner' permissions={[...PERMISSIONS]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.getAllByText("Badges")).toHaveLength(2);
});

it("keeps agency-only home and search within granted navigation", () => {
	jest.useFakeTimers();
	path = "/dashboard/agency";
	const view = render(
		<DashboardShell creatorId='agency-member' permissions={[]}>
			{content}
		</DashboardShell>,
	);
	try {
		expect(screen.getByRole("link", { name: "Clipify Home" })).toHaveAttribute("href", "/dashboard/agency");
		expect(screen.queryByText("Tools")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Search pages" }));
		fireEvent.change(screen.getByPlaceholderText("Search pages…"), { target: { value: "agency" } });
		act(() => jest.advanceTimersByTime(250));
		expect(search).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Agency" })).toBeVisible();
	} finally {
		view.unmount();
		jest.useRealTimers();
	}
});

it("uses agency home in allocation breadcrumbs without a creator-dashboard detour", () => {
	path = "/dashboard/agency/allocations";
	render(
		<DashboardShell creatorId='agency-member' permissions={[]}>
			{content}
		</DashboardShell>,
	);
	expect(screen.queryByText("Home", { exact: true })).not.toBeInTheDocument();
	expect(screen.getAllByText("Agency")).toHaveLength(2);
	expect(screen.getByText("Allocations")).toBeVisible();
});
