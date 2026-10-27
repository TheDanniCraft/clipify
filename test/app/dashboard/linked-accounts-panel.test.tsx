import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const listAccounts = jest.fn();
const signInSocial = jest.fn();
const disconnectLinkedAccount = jest.fn();
const notify = jest.fn();

jest.mock("@heroui/react", () => {
	const React = require("react");
	const fixture = jest.requireActual("../../__mocks__/heroui-react.cjs");
	function CardDescription({ children }: any) {
		return <p>{children}</p>;
	}
	fixture.Card.Description = CardDescription;
	return fixture;
});
jest.mock("@/auth/client", () => ({ authClient: { listAccounts: (...args: unknown[]) => listAccounts(...args), signIn: { social: (...args: unknown[]) => signInSocial(...args) } } }));
jest.mock("@/app/actions/account-security", () => ({ disconnectLinkedAccount: (...args: unknown[]) => disconnectLinkedAccount(...args), listLinkedAccounts: (...args: unknown[]) => listAccounts(...args) }));
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@components/confirmModal", () => ({
	__esModule: true,
	default: ({ isOpen, title, description, confirmLabel, onConfirm }: any) =>
		isOpen ? (
			<section>
				<h2>{title}</h2>
				<p>{description}</p>
				<button onClick={() => void onConfirm()}>{confirmLabel}</button>
			</section>
		) : null,
}));

import LinkedAccountsPanel from "@/app/dashboard/settings/linked-accounts-panel";

const accounts = [
	{ id: "google-account", providerId: "google", accountId: "google-channel" },
	{ id: "twitch-account", providerId: "twitch", accountId: "twitch-channel" },
];

beforeEach(() => {
	jest.clearAllMocks();
	window.history.replaceState(null, "", "/dashboard/settings?tab=connections");
	window.sessionStorage.clear();
	listAccounts.mockResolvedValue({ data: accounts, error: null });
	signInSocial.mockResolvedValue({ data: null, error: null });
});

test("keeps the primary Twitch identity connected", async () => {
	listAccounts.mockResolvedValue({ data: [{ ...accounts[1], isPrimary: true }], error: null });
	render(<LinkedAccountsPanel />);
	expect(await screen.findByRole("button", { name: "Primary account" })).toBeDisabled();
	expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
	expect(disconnectLinkedAccount).not.toHaveBeenCalled();
});

test("disconnects through the coordinated account action and refreshes the list", async () => {
	disconnectLinkedAccount.mockResolvedValue({ success: true, providerId: "google" });
	render(<LinkedAccountsPanel />);
	await screen.findByText("Google");
	fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" })[0]);
	fireEvent.click(within(screen.getByRole("heading", { name: "Disconnect Google?" }).closest("section")!).getByRole("button", { name: "Disconnect" }));
	await waitFor(() => expect(disconnectLinkedAccount).toHaveBeenCalledWith("google-account"));
	await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2));
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Google disconnected", color: "success" }));
});

test("submits only one disconnect request while the first request is pending", async () => {
	let resolveDisconnect!: (value: { success: true; providerId: string }) => void;
	disconnectLinkedAccount.mockReturnValue(new Promise((resolve) => (resolveDisconnect = resolve)));
	render(<LinkedAccountsPanel />);
	await screen.findByText("Google");
	fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" })[0]);
	const confirm = within(screen.getByRole("heading", { name: "Disconnect Google?" }).closest("section")!).getByRole("button", { name: "Disconnect" });
	fireEvent.click(confirm);
	fireEvent.click(confirm);
	expect(disconnectLinkedAccount).toHaveBeenCalledTimes(1);
	resolveDisconnect({ success: true, providerId: "google" });
	await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2));
});

test("offers provider reauthentication when the session is no longer fresh", async () => {
	disconnectLinkedAccount.mockResolvedValue({ success: false, code: "REAUTHENTICATION_REQUIRED", error: "Sign in again.", reauthProvider: "google" });
	render(<LinkedAccountsPanel />);
	await screen.findByText("Google");
	fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" })[0]);
	fireEvent.click(within(screen.getByRole("heading", { name: "Disconnect Google?" }).closest("section")!).getByRole("button", { name: "Disconnect" }));
	await screen.findByText("Sign in again to continue");
	expect(screen.getByText("To verify it's you, please sign in again. Then you can return and finish this action.")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
	await waitFor(() => expect(signInSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "/dashboard/settings?tab=connections&reauthentication=complete", errorCallbackURL: "/dashboard/settings?tab=connections&reauthentication=failed" }));
	expect(window.sessionStorage.getItem("clipify.pending-linked-account-disconnect")).toBe("google-account");
});

test("finishes the confirmed disconnect after successful reauthentication", async () => {
	window.history.replaceState(null, "", "/dashboard/settings?tab=connections&reauthentication=complete");
	window.sessionStorage.setItem("clipify.pending-linked-account-disconnect", "google-account");
	disconnectLinkedAccount.mockResolvedValue({ success: true, providerId: "google" });
	render(<LinkedAccountsPanel />);
	await waitFor(() => expect(disconnectLinkedAccount).toHaveBeenCalledWith("google-account"));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Google disconnected", color: "success" })));
	expect(window.sessionStorage.getItem("clipify.pending-linked-account-disconnect")).toBeNull();
	expect(window.location.search).toBe("?tab=connections");
});

test("does not disconnect after failed reauthentication", async () => {
	window.history.replaceState(null, "", "/dashboard/settings?tab=connections&reauthentication=failed");
	window.sessionStorage.setItem("clipify.pending-linked-account-disconnect", "google-account");
	render(<LinkedAccountsPanel />);
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Sign-in could not be completed", color: "danger" })));
	expect(disconnectLinkedAccount).not.toHaveBeenCalled();
	expect(window.sessionStorage.getItem("clipify.pending-linked-account-disconnect")).toBeNull();
});

test("recovers from an unexpected disconnect failure without leaving the action pending", async () => {
	disconnectLinkedAccount.mockRejectedValue(new Error("private failure"));
	render(<LinkedAccountsPanel />);
	await screen.findByText("Google");
	fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" })[0]);
	fireEvent.click(within(screen.getByRole("heading", { name: "Disconnect Google?" }).closest("section")!).getByRole("button", { name: "Disconnect" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Account could not be disconnected", color: "danger" })));
	expect(within(screen.getByRole("heading", { name: "Disconnect Google?" }).closest("section")!).getByRole("button", { name: "Disconnect" })).toBeEnabled();
});

test("shows an explicit empty state when no streaming accounts are linked", async () => {
	listAccounts.mockResolvedValue({ data: [{ id: "credential", providerId: "credential", accountId: "email" }], error: null });
	render(<LinkedAccountsPanel />);
	expect(await screen.findByText("No Twitch or YouTube accounts are linked.")).toBeVisible();
	expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
});

test("offers a retry when linked accounts cannot be loaded", async () => {
	listAccounts.mockResolvedValueOnce({ data: null, error: { message: "offline" } }).mockResolvedValueOnce({ data: accounts, error: null });
	render(<LinkedAccountsPanel />);
	const retry = await screen.findByRole("button", { name: "Try again" });
	fireEvent.click(retry);
	expect(await screen.findByText("Google")).toBeVisible();
	expect(listAccounts).toHaveBeenCalledTimes(2);
});
