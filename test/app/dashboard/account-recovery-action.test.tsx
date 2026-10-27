import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecoveryAction from "@/app/dashboard/settings/account/recovery/recovery-action";

const recover = jest.fn();
const signIn = jest.fn();
jest.mock("@heroui/react", () => {
	const fixture = jest.requireActual("../../__mocks__/heroui-react.cjs");
	return { ...fixture, Modal: { Container: fixture.Modal.Container, Dialog: fixture.Modal.Dialog, Header: fixture.Modal.Header, Heading: fixture.Modal.Heading, Body: fixture.Modal.Body, Footer: fixture.Modal.Footer, CloseTrigger: fixture.Modal.CloseTrigger, Backdrop: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? <section>{children}</section> : null) } };
});
jest.mock("@actions/subscription", () => ({ recoverAccountDeletion: (...args: unknown[]) => recover(...args) }));
jest.mock("@/auth/client", () => ({ authClient: { signIn: { social: (...args: unknown[]) => signIn(...args) } } }));

beforeEach(() => jest.clearAllMocks());

test("recovery offers verification and can be cancelled without changing the account", async () => {
	recover.mockResolvedValue({ success: false, code: "REAUTHENTICATION_REQUIRED" });
	render(<RecoveryAction requestId='request' />);
	fireEvent.click(screen.getByRole("button", { name: "Recover my account" }));
	await screen.findByText("Sign in again to continue");
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	await waitFor(() => expect(screen.queryByText("Sign in again to continue")).not.toBeInTheDocument());
	expect(recover).toHaveBeenCalledTimes(1);
	expect(signIn).not.toHaveBeenCalled();
});

test("verification failure stays actionable and preserves the recovery request", async () => {
	recover.mockResolvedValue({ success: false, code: "REAUTHENTICATION_REQUIRED" });
	signIn.mockRejectedValueOnce(new Error("provider unavailable"));
	render(<RecoveryAction requestId='request' />);
	fireEvent.click(screen.getByRole("button", { name: "Recover my account" }));
	fireEvent.click(await screen.findByRole("button", { name: "Continue with Twitch" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in could not start");
	expect(signIn).toHaveBeenCalledWith({ provider: "twitch", callbackURL: "/dashboard/settings/account/recovery", errorCallbackURL: "/dashboard/settings/account/recovery?verification=failed" });
	expect(screen.getByRole("button", { name: "Continue with Twitch" })).not.toBeDisabled();
	expect(recover).toHaveBeenCalledTimes(1);
});

test("an unexpected recovery failure offers retry without starting verification", async () => {
	recover.mockRejectedValue(new Error("storage unavailable"));
	render(<RecoveryAction requestId='request' />);
	fireEvent.click(screen.getByRole("button", { name: "Recover my account" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Your account could not be recovered");
	expect(screen.getByRole("button", { name: "Recover my account" })).not.toBeDisabled();
	expect(signIn).not.toHaveBeenCalled();
});
