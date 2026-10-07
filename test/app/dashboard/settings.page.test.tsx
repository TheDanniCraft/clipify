import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
const validateAuth = jest.fn();
const getSettings = jest.fn();
const saveSettings = jest.fn();
const getClipCacheStatus = jest.fn();
const getOwnClipForceRefreshStatus = jest.fn();
const forceRefreshOwnClipCache = jest.fn();
const router = { push: jest.fn(), replace: jest.fn() };
const notify = jest.fn();
jest.mock("@heroui/react", () => {
	const React = require("react");
	const fixture = jest.requireActual("../../__mocks__/heroui-react.cjs");
	fixture.useOverlayState = function useOverlayState() {
		const [isOpen, setOpen] = React.useState(false);
		const open = React.useCallback(() => setOpen(true), []);
		const close = React.useCallback(() => setOpen(false), []);
		return { isOpen, setOpen, open, close };
	};
	const slot = ({ children }: any) => <span>{children}</span>;
	fixture.Switch = Object.assign(
		({ children, isSelected, isDisabled, onChange, "aria-label": label }: any) => (
			<label>
				<input type='checkbox' aria-label={label} checked={!!isSelected} disabled={isDisabled} onChange={(event) => onChange?.(event.target.checked)} />
				{children}
			</label>
		),
		{ Content: slot, Control: slot, Thumb: () => null },
	);
	fixture.TextField = function SettingsTextField({ children, value, onChange, isDisabled }: any) {
		return <div>{React.Children.map(children, (child: any) => (React.isValidElement(child) && (child.type === fixture.Input || child.type === fixture.TextArea) && value !== undefined ? React.cloneElement(child, { value, disabled: isDisabled, onChange: (event: any) => onChange?.(event.target.value) }) : child))}</div>;
	};
	return fixture;
});
jest.mock("next/navigation", () => ({ useRouter: () => router }));
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@actions/database", () => ({ getSettings: (...args: unknown[]) => getSettings(...args), saveSettings: (...args: unknown[]) => saveSettings(...args), getClipCacheStatus: (...args: unknown[]) => getClipCacheStatus(...args) }));
jest.mock("@actions/twitch", () => ({ getOwnClipForceRefreshStatus: (...args: unknown[]) => getOwnClipForceRefreshStatus(...args), forceRefreshOwnClipCache: (...args: unknown[]) => forceRefreshOwnClipCache(...args) }));
jest.mock("@actions/subscription", () => ({ requestAccountDataExport: jest.fn(), requestAccountDeletion: jest.fn() }));
jest.mock("@/auth/client", () => ({ authClient: { signIn: { social: jest.fn() } } }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@lib/featureAccess", () => ({ getFeatureAccess: () => ({ allowed: true }), getTrialDaysLeft: () => 0, isReverseTrialActive: () => false }));
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: () => ({ active: false, accept: jest.fn(), reject: jest.fn() }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/dashboardNavbar", () => ({ __esModule: true, default: ({ children }: any) => <main>{children}</main> }));
jest.mock("@components/fullscreenLoadingState", () => ({ __esModule: true, default: ({ message }: any) => <p>{message}</p> }));
jest.mock("@components/dashboardUserAvatar", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/codeSnippet", () => ({ __esModule: true, default: ({ children }: any) => <span>{children}</span> }));
jest.mock("@components/chatwootData", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/upgradeModal", () => ({
	__esModule: true,
	default: ({ isOpen, title, feature, initialBillingCycle, onOpenChange }: any) =>
		isOpen ? (
			<section>
				<p>{title}</p>
				<p>
					Upgrade {feature} {initialBillingCycle}
				</p>
				<button onClick={() => onOpenChange(false)}>Close upgrade</button>
			</section>
		) : null,
}));
jest.mock("@components/confirmModal", () => ({
	__esModule: true,
	default: ({ isOpen, content, onConfirm, confirmLabel }: any) =>
		isOpen ? (
			<section>
				{content}
				<button onClick={() => void onConfirm()}>{confirmLabel}</button>
			</section>
		) : null,
}));
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ isOpen, children, onClose }: any) =>
		isOpen ? (
			<section>
				{children}
				<button onClick={onClose}>Close modal</button>
			</section>
		) : null,
}));
jest.mock("@components/creator/CreatorAnalyticsCard", () => ({ __esModule: true, default: () => <p>Creator analytics panel</p> }));
jest.mock("@components/settingsNavigation", () => ({
	__esModule: true,
	default: ({ onCoreSectionChange }: any) => (
		<nav>
			{["settings", "creator", "billing"].map((section) => (
				<button key={section} onClick={() => onCoreSectionChange(section)}>
					{section} section
				</button>
			))}
		</nav>
	),
}));
jest.mock("@/app/dashboard/settings/billing-panel", () => ({ __esModule: true, default: () => <p>Billing panel</p> }));
jest.mock("@/app/dashboard/settings/security-panel", () => ({ __esModule: true, default: () => <p>Security panel</p> }));
jest.mock("@/app/dashboard/settings/connected-apps-panel", () => ({ __esModule: true, default: () => <p>Connected AI apps panel</p> }));
jest.mock("@/app/dashboard/settings/mcp-activity-panel", () => ({ __esModule: true, default: () => <p>AI app activity panel</p> }));
import SettingsPage from "@/app/dashboard/settings/page";
import { requestAccountDataExport, requestAccountDeletion } from "@actions/subscription";
import { authClient } from "@/auth/client";

beforeEach(() => {
	jest.clearAllMocks();
	window.history.replaceState({}, "", "/dashboard/settings");
	sessionStorage.clear();
	validateAuth.mockReset().mockResolvedValue({ id: "owner", username: "Owner", plan: "free", email: "owner@example.invalid" });
	getSettings.mockReset().mockResolvedValue({ userId: "owner", prefix: "!", marketingOptIn: false, showOnCommunityPage: false });
	saveSettings.mockReset().mockResolvedValue(true);
	getClipCacheStatus.mockReset().mockResolvedValue(null);
	getOwnClipForceRefreshStatus.mockReset().mockResolvedValue(null);
	forceRefreshOwnClipCache.mockReset();
	(requestAccountDataExport as jest.Mock).mockReset();
	(requestAccountDeletion as jest.Mock).mockReset();
	(authClient.signIn.social as jest.Mock).mockReset();
});
afterEach(async () => {
	await act(async () => {
		await Promise.resolve();
	});
});

test("anonymous settings route redirects without querying saved settings", async () => {
	validateAuth.mockResolvedValue(null);
	render(<SettingsPage />);
	await waitFor(() => expect(router.push).toHaveBeenCalledWith("/logout"));
	expect(getSettings).not.toHaveBeenCalled();
});
test("authenticated settings compose security connected apps and activity", async () => {
	render(<SettingsPage />);
	expect(await screen.findByText("Connected AI apps panel")).toBeVisible();
	expect(screen.getByText("AI app activity panel")).toBeVisible();
	expect(screen.getByText("Security panel")).toBeVisible();
	await waitFor(() => expect(getSettings).toHaveBeenCalledWith("owner", true));
	expect(await screen.findByRole("button", { name: "Save Settings" })).toBeDisabled();
});
test.each(["billing", "creator"])("requested %s section renders its own content", async (section) => {
	window.history.replaceState({}, "", `/dashboard/settings?tab=${section}`);
	render(<SettingsPage />);
	expect(await screen.findByText(section === "billing" ? "Billing panel" : "Creator analytics panel")).toBeVisible();
	expect(screen.queryByText("Connected AI apps panel")).not.toBeInTheDocument();
});
test("section navigation restores connected-app controls", async () => {
	render(<SettingsPage />);
	await screen.findByText("Connected AI apps panel");
	fireEvent.click(screen.getByRole("button", { name: "billing section" }));
	expect(screen.getByText("Billing panel")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "settings section" }));
	expect(screen.getByText("Connected AI apps panel")).toBeVisible();
});
test("settings load failure gives safe feedback", async () => {
	getSettings.mockRejectedValue(new Error("private database details"));
	render(<SettingsPage />);
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Settings could not be loaded", color: "danger" })));
	expect(JSON.stringify(notify.mock.calls)).not.toContain("private database details");
});
test("a load resolving after unmount does not request further private status", async () => {
	let resolve!: (value: unknown) => void;
	getSettings.mockReturnValue(
		new Promise((done) => {
			resolve = done;
		}),
	);
	const view = render(<SettingsPage />);
	await waitFor(() => expect(getSettings).toHaveBeenCalled());
	view.unmount();
	await act(async () => {
		resolve({ prefix: "!" });
	});
	expect(getClipCacheStatus).not.toHaveBeenCalled();
});

test("editing command prefix enables save and records trimmed settings", async () => {
	render(<SettingsPage />);
	const input = await screen.findByDisplayValue("!");
	fireEvent.change(input, { target: { value: " ?? " } });
	const save = screen.getByRole("button", { name: "Save Settings" });
	expect(save).toBeEnabled();
	fireEvent.submit(save.closest("form")!);
	await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", prefix: "??" })));
	await waitFor(() => expect(save).toBeDisabled());
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Settings saved", color: "success" }));
});
test("failed settings save preserves unsaved state and reports safe failure", async () => {
	saveSettings.mockRejectedValue(new Error("private storage detail"));
	render(<SettingsPage />);
	fireEvent.change(await screen.findByDisplayValue("!"), { target: { value: "?" } });
	const save = screen.getByRole("button", { name: "Save Settings" });
	fireEvent.submit(save.closest("form")!);
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", color: "danger" })));
	expect(save).toBeEnabled();
	expect(JSON.stringify(notify.mock.calls)).not.toContain("private storage detail");
});
test("overlong command prefix leaves saved settings unchanged", async () => {
	render(<SettingsPage />);
	const input = await screen.findByDisplayValue("!");
	fireEvent.change(input, { target: { value: "1234" } });
	expect(input).toHaveValue("!");
	expect(screen.getByRole("button", { name: "Save Settings" })).toBeDisabled();
});
test.each(["badges", "achievements"])("legacy %s tab redirects to member card", async (tab) => {
	window.history.replaceState({}, "", `/dashboard/settings?tab=${tab}`);
	render(<SettingsPage />);
	await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/member-card"));
});

test.each(["success", "cooldown", "failure"])("manual clip refresh handles %s safely", async (mode) => {
	getOwnClipForceRefreshStatus.mockResolvedValue({ canRefresh: true, remainingMs: 0 });
	if (mode === "failure") forceRefreshOwnClipCache.mockRejectedValue(new Error("private provider failure"));
	else forceRefreshOwnClipCache.mockResolvedValue({ ok: mode === "success", remainingMs: 61000 });
	render(<SettingsPage />);
	const refresh = await screen.findByRole("button", { name: "Force Refresh Cache" });
	await waitFor(() => expect(refresh).toBeEnabled());
	fireEvent.click(refresh);
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: mode === "success" ? "Cache refresh started" : mode === "cooldown" ? "Refresh cooldown active" : "Error" })));
	expect(JSON.stringify(notify.mock.calls)).not.toContain("private provider failure");
});
test.each(["success", "failure"])("statistics refresh handles %s", async (mode) => {
	render(<SettingsPage />);
	await waitFor(() => expect(getOwnClipForceRefreshStatus).toHaveBeenCalled());
	if (mode === "failure") getClipCacheStatus.mockRejectedValue(new Error("private provider failure"));
	else getClipCacheStatus.mockResolvedValue({ backfillComplete: true, cachedClipCount: 123, estimatedCoveragePercent: 100 });
	fireEvent.click(screen.getByRole("button", { name: "Refresh statistics" }));
	if (mode === "success") expect(await screen.findByText("Complete")).toBeVisible();
	else await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ description: "Failed to refresh clip cache statistics." })));
});
test.each(["success", "rate-limited", "failure", "recent-auth"])("account export handles %s without exposing internal errors", async (mode) => {
	if (mode === "success") (requestAccountDataExport as jest.Mock).mockResolvedValue({ email: "owner@example.invalid", expiresAt: "2026-10-09T00:00:00Z" });
	else (requestAccountDataExport as jest.Mock).mockRejectedValue(new Error(mode === "rate-limited" ? "EXPORT_RATE_LIMITED" : mode === "recent-auth" ? "RECENT_AUTH_REQUIRED" : "private export failure"));
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Export Account Data" }));
	fireEvent.click(screen.getByRole("button", { name: "Email download link" }));
	if (mode === "recent-auth") expect(await screen.findByText("Sign in again to continue")).toBeVisible();
	else await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: mode === "success" ? "Data export requested" : "Export request failed" })));
	expect(JSON.stringify(notify.mock.calls)).not.toContain("private export failure");
});
test.each(["success", "failure", "recent-auth"])("scheduled deletion handles %s", async (mode) => {
	if (mode === "success") (requestAccountDeletion as jest.Mock).mockResolvedValue({ status: "scheduled", suspensionAt: "2026-10-09T00:00:00Z" });
	else (requestAccountDeletion as jest.Mock).mockRejectedValue(new Error(mode === "recent-auth" ? "RECENT_AUTH_REQUIRED" : "private deletion failure"));
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Schedule Account Deletion" }));
	fireEvent.click(screen.getByRole("button", { name: "Schedule deletion" }));
	if (mode === "recent-auth") expect(await screen.findByText("Sign in again to continue")).toBeVisible();
	else await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: mode === "success" ? "Deletion scheduled" : "Deletion was not scheduled" })));
	expect(JSON.stringify(notify.mock.calls)).not.toContain("private deletion failure");
});

test("email preference toggles save explicit opt-in and opt-out provenance", async () => {
	render(<SettingsPage />);
	await screen.findByDisplayValue("!");
	const toggle = screen.getByRole("checkbox", { name: "Receive emails" });
	for (const selected of [true, false]) {
		fireEvent.click(toggle);
		const save = screen.getByRole("button", { name: "Save Settings" });
		fireEvent.submit(save.closest("form")!);
		await waitFor(() => expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ marketingOptIn: selected, marketingOptInSource: selected ? "settings_page_explicit_optin" : "settings_page_optout" })));
		await waitFor(() => expect(save).toBeDisabled());
	}
});
test("discovery toggle preserves explicit unlisted and discoverable choices", async () => {
	render(<SettingsPage />);
	await screen.findByDisplayValue("!");
	const toggle = screen.getByRole("checkbox", { name: "Appear in search engines and Clipify Discovery" });
	for (const selected of [true, false]) {
		fireEvent.click(toggle);
		const save = screen.getByRole("button", { name: "Save Settings" });
		fireEvent.submit(save.closest("form")!);
		await waitFor(() => expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ showOnCommunityPage: selected, creatorPageVisibility: selected ? "discoverable" : "unlisted" })));
		await waitFor(() => expect(save).toBeDisabled());
	}
});
test("creator profile controls save current title description and visibility choices", async () => {
	window.history.replaceState({}, "", "/dashboard/settings?tab=creator");
	render(<SettingsPage />);
	await screen.findByText("Creator analytics panel");
	await waitFor(() => expect(getOwnClipForceRefreshStatus).toHaveBeenCalled());
	fireEvent.click(screen.getByRole("checkbox", { name: "Show Twitch bio" }));
	fireEvent.change(screen.getByPlaceholderText("Owner's Twitch clips"), { target: { value: "New preview title" } });
	fireEvent.change(screen.getByPlaceholderText("Watch clips from Owner on Clipify."), { target: { value: "New preview description" } });
	const save = screen.getByRole("button", { name: "Save Creator Page Settings" });
	fireEvent.submit(save.closest("form")!);
	await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ creatorPageShowBio: false, creatorPageSocialTitle: "New preview title", creatorPageSocialDescription: "New preview description" })));
	await waitFor(() => expect(save).toBeDisabled());
	fireEvent.click(screen.getByRole("checkbox", { name: "Enable creator page" }));
	expect(screen.getByRole("checkbox", { name: "Show Twitch bio" })).toBeDisabled();
	expect(screen.queryByText("Open Creator Page")).not.toBeInTheDocument();
});
test("team action navigates to creator team settings", async () => {
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Manage team" }));
	expect(router.push).toHaveBeenCalledWith("/dashboard/settings/team");
});

test("upgrade request preserves chosen billing cycle and feature", async () => {
	window.history.replaceState({}, "", "/dashboard/settings?upgrade=1&cycle=monthly&source=pricing_page&feature=mcp");
	render(<SettingsPage />);
	expect(await screen.findByText("Upgrade Account")).toBeVisible();
	expect(screen.getByText("Upgrade mcp monthly")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Close upgrade" }));
	expect(screen.queryByText("Upgrade Account")).not.toBeInTheDocument();
});
test.each(["free", "pro"])("Runner add-on request chooses the %s account presentation", async (plan) => {
	validateAuth.mockResolvedValue({ id: "owner", username: "Owner", plan, entitlements: { effectivePlan: plan, runnerAccess: false } });
	window.history.replaceState({}, "", "/dashboard/settings?addon=runner");
	render(<SettingsPage />);
	expect(await screen.findByText(plan === "pro" ? "Add the Runner add-on" : "Upgrade with Runner")).toBeVisible();
	expect(screen.getByText("Upgrade runner_access yearly")).toBeVisible();
	expect(screen.getByText("Billing panel")).toBeVisible();
});
test("return from recent export sign-in stores a bounded window and removes return marker", async () => {
	window.history.replaceState({}, "", "/dashboard/settings?reauthenticated=export&tab=settings");
	render(<SettingsPage />);
	expect(await screen.findByText("Request your Clipify data")).toBeVisible();
	expect(router.replace).toHaveBeenCalledWith("/dashboard/settings?tab=settings");
	const remaining = Number(sessionStorage.getItem("clipify:recent-auth-expires-at")) - Date.now();
	expect(remaining).toBeGreaterThan(290000);
	expect(remaining).toBeLessThanOrEqual(300000);
	fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
	expect(screen.queryByText("Request your Clipify data")).not.toBeInTheDocument();
	expect(requestAccountDataExport).not.toHaveBeenCalled();
});
test.each(["success", "failure"])("export recent-auth verification handles %s", async (mode) => {
	(requestAccountDataExport as jest.Mock).mockRejectedValue(new Error("RECENT_AUTH_REQUIRED"));
	(authClient.signIn.social as jest.Mock).mockResolvedValue({ error: mode === "failure" ? { message: "private auth failure" } : null });
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Export Account Data" }));
	fireEvent.click(screen.getByRole("button", { name: "Email download link" }));
	fireEvent.click(await screen.findByRole("button", { name: "Continue with Twitch" }));
	await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "twitch", callbackURL: "/dashboard/settings?reauthenticated=export", errorCallbackURL: "/dashboard/settings?reauthentication=failed" }));
	if (mode === "failure") await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Identity check could not start" })));
	expect(JSON.stringify(notify.mock.calls)).not.toContain("private auth failure");
});
test.each([
	[0, "now"],
	[59000, "59s"],
	[61000, "1m 1s"],
	[3661000, "1h 1m"],
])("manual refresh cooldown %s is formatted for a user", async (remainingMs, display) => {
	getOwnClipForceRefreshStatus.mockResolvedValue({ canRefresh: false, remainingMs });
	render(<SettingsPage />);
	expect(await screen.findByText(`Manual refresh: available in ${display}`)).toBeVisible();
});

test("inline settings and creator links preserve navigation between sections", async () => {
	render(<SettingsPage />);
	fireEvent.click(await screen.findByText("Creator Page tab"));
	expect(screen.getByText("Creator analytics panel")).toBeVisible();
	fireEvent.click(screen.getByText("Settings", { selector: "a" }));
	expect(screen.getByText("Connected AI apps panel")).toBeVisible();
});
test("deletion timing choices are explicit and only confirmation reaches the action", async () => {
	(requestAccountDeletion as jest.Mock).mockResolvedValue({ status: "scheduled", suspensionAt: "2026-10-09T00:00:00Z" });
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Schedule Account Deletion" }));
	fireEvent.click(screen.getByRole("button", { name: "Suspend now" }));
	fireEvent.click(screen.getByRole("button", { name: "After paid access ends (recommended)" }));
	expect(requestAccountDeletion).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Schedule deletion" }));
	await waitFor(() => expect(requestAccountDeletion).toHaveBeenCalledWith("paid_through"));
});
test("export cancel closes the dialog without requesting data", async () => {
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Export Account Data" }));
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(screen.queryByText("Request your Clipify data")).not.toBeInTheDocument();
	expect(requestAccountDataExport).not.toHaveBeenCalled();
});
test.each(["button", "dialog"])("recent-auth %s cancellation performs no social sign-in", async (mode) => {
	(requestAccountDataExport as jest.Mock).mockRejectedValue(new Error("RECENT_AUTH_REQUIRED"));
	render(<SettingsPage />);
	fireEvent.click(await screen.findByRole("button", { name: "Export Account Data" }));
	fireEvent.click(screen.getByRole("button", { name: "Email download link" }));
	await screen.findByText("Sign in again to continue");
	fireEvent.click(screen.getByRole("button", { name: mode === "button" ? "Cancel" : "Close modal" }));
	expect(screen.queryByText("Sign in again to continue")).not.toBeInTheDocument();
	expect(authClient.signIn.social).not.toHaveBeenCalled();
});
test("cooldown countdown enables refresh at zero and cleans its interval", async () => {
	jest.useFakeTimers();
	try {
		getOwnClipForceRefreshStatus.mockResolvedValue({ canRefresh: false, remainingMs: 1000 });
		const view = render(<SettingsPage />);
		await waitFor(() => expect(getOwnClipForceRefreshStatus).toHaveBeenCalled());
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1000);
		});
		expect(screen.getByRole("button", { name: "Force Refresh Cache" })).toBeEnabled();
		expect(screen.getByText("Manual refresh: available now")).toBeVisible();
		view.unmount();
		expect(jest.getTimerCount()).toBe(0);
	} finally {
		jest.useRealTimers();
	}
});
test("malformed saved dates show unknown rather than an invalid date string", async () => {
	getClipCacheStatus.mockResolvedValue({ oldestClipDate: "invalid-date", lastIncrementalSyncAt: "2026-10-06T00:00:00Z" });
	render(<SettingsPage />);
	expect(await screen.findByText(/Unknown/)).toBeVisible();
	expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
});
