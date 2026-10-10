import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminAccountAccessControl from "@/app/components/adminAccountAccessControl";
const change = jest.fn();
jest.mock("@/app/actions/admin-account-access", () => ({ setAdminAccountAccess: (...args: unknown[]) => change(...args) }));
beforeEach(() => jest.clearAllMocks());
it("requires a reason, submits disablement, and closes after a successful notification", async () => {
	const refresh = jest.fn(async () => {});
	change.mockResolvedValue({ changed: true, notificationQueued: true });
	const user = userEvent.setup();
	render(<AdminAccountAccessControl user={{ id: "u1", username: "Alex", disabled: false }} onChanged={refresh} />);
	await user.click(screen.getByRole("button", { name: "Disable" }));
	expect(screen.getByRole("button", { name: "Disable account" })).toBeDisabled();
	await user.type(screen.getByRole("textbox", { name: "Reason shown to the user" }), "Policy violation");
	await user.click(screen.getByRole("button", { name: "Disable account" }));
	await waitFor(() => expect(change).toHaveBeenCalledWith({ userId: "u1", disabled: true, reason: "Policy violation" }));
	await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
	expect(refresh).toHaveBeenCalled();
});
it("reports notification failure separately from a successful enablement", async () => {
	change.mockResolvedValue({ changed: true, notificationQueued: false });
	const user = userEvent.setup();
	render(<AdminAccountAccessControl user={{ id: "u1", username: "Alex", disabled: true }} onChanged={async () => {}} />);
	await user.click(screen.getByRole("button", { name: "Enable" }));
	await user.click(screen.getByRole("button", { name: "Enable account" }));
	await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("notification email could not be queued"));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
