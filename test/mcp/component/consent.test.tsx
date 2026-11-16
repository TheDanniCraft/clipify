jest.mock("@lib/analytics", () => ({ trackProductEvent: jest.fn() }));
import { trackProductEvent } from "@lib/analytics";
jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
jest.mock("@/app/auth/mcp/consent/CallbackHandoff", () => ({ CallbackHandoff: ({ authorized }: { authorized: boolean }) => <h1>{authorized ? "Authorization successful" : "Authorization declined"}</h1> }));
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { ConsentForm } from "@/app/auth/mcp/consent/ConsentForm";
const requested = ["creator:read", "overlay:read", "overlay:create", "overlay:update", "overlay:delete", "playlist:read", "playlist:update", "offline_access"];
const props = {
	clientName: "Custom AI",
	requestedScopes: requested,
	creators: [
		{ creatorId: "one", agencyOrganizationId: null, name: "Creator one" },
		{ creatorId: "two", agencyOrganizationId: "agency", name: "Creator two" },
	],
	oauthQuery: "signed-query",
	action: jest.fn(),
};
function choose(name: string) {
	fireEvent.click(screen.getByRole("button", { name }));
}
function review() {
	fireEvent.click(screen.getByRole("button", { name: "Review" }));
	expect(screen.queryByRole("button", { name: /Deny|Cancel connection/ })).not.toBeInTheDocument();
}
test("starts with creator selection and preserves independent write/read choices", () => {
	const { container } = render(<ConsentForm {...props} />);
	expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Cancel connection" })).not.toBeInTheDocument();
	choose("Creator one");
	fireEvent.click(within(screen.getByRole("radiogroup", { name: "General permissions" })).getByRole("radio", { name: "Write" }));
	review();
	fireEvent.click(screen.getByRole("button", { name: "Add another creator" }));
	choose("Creator two");
	review();
	const entries = [...container.querySelectorAll<HTMLInputElement>('input[name="creators"]')].map((input) => JSON.parse(input.value));
	expect(entries[0].scopes).toContain("overlay:delete");
	expect(entries[1].scopes).not.toContain("overlay:update");
	expect(entries[1].agencyOrganizationId).toBe("agency");
	expect(screen.getByRole("button", { name: "Authorize" })).toBeEnabled();
});
test("custom preserves the preset, allows narrowing, and disables unsupported levels", () => {
	const { container } = render(<ConsentForm {...props} />);
	choose("Creator one");
	fireEvent.click(within(screen.getByRole("radiogroup", { name: "General permissions" })).getByRole("radio", { name: "Custom" }));
	expect(within(screen.getByRole("radiogroup", { name: "Creator information access" })).getByRole("radio", { name: "Write" })).toBeDisabled();
	fireEvent.click(within(screen.getByRole("radiogroup", { name: "Overlays access" })).getByRole("radio", { name: "None" }));
	review();
	expect(JSON.parse(container.querySelector<HTMLInputElement>('input[name="creators"]')!.value).scopes).not.toContain("overlay:read");
});
test("edit and back retain settings; removal does not affect another creator", () => {
	render(<ConsentForm {...props} />);
	choose("Creator one");
	review();
	fireEvent.click(screen.getByRole("button", { name: "Add another creator" }));
	choose("Creator two");
	review();
	fireEvent.click(screen.getByRole("button", { name: "Edit Creator one" }));
	expect(screen.getByRole("button", { name: "Creator one" })).toBeEnabled();
	choose("Creator one");
	fireEvent.click(screen.getByRole("button", { name: "Back" }));
	expect(screen.getByRole("button", { name: "Creator one" })).toBeEnabled();
	choose("Creator one");
	review();
	fireEvent.click(screen.getByRole("button", { name: "Remove Creator one from connection" }));
	expect(screen.getByText("Creator two")).toBeVisible();
	expect(screen.getByRole("button", { name: "Authorize" })).toBeEnabled();
});
test("read-only requests disable Write and cannot gain unrequested permissions", () => {
	render(<ConsentForm {...props} requestedScopes={["creator:read"]} />);
	choose("Creator one");
	expect(within(screen.getByRole("radiogroup", { name: "General permissions" })).getByRole("radio", { name: "Write" })).toBeDisabled();
	expect(screen.getByText("This app requested read-only access.")).toBeVisible();
});
test("submission failures retain review and hide internal details", async () => {
	const { container } = render(<ConsentForm {...props} action={jest.fn().mockRejectedValue(new Error("private-host"))} />);
	choose("Creator one");
	review();
	fireEvent.submit(container.querySelector("form")!);
	await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again"));
	expect(screen.queryByText(/private-host/)).not.toBeInTheDocument();
});

test("removing creator information also removes explicit feedback access", () => {
	const { container } = render(<ConsentForm {...props} requestedScopes={["creator:read", "feedback:create"]} />);
	choose("Creator one");
	fireEvent.click(within(screen.getByRole("radiogroup", { name: "General permissions" })).getByRole("radio", { name: "Write" }));
	fireEvent.click(within(screen.getByRole("radiogroup", { name: "General permissions" })).getByRole("radio", { name: "Custom" }));
	fireEvent.click(within(screen.getByRole("radiogroup", { name: "Creator information access" })).getByRole("radio", { name: "None" }));
	expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
	expect(container.querySelector('input[name="creators"]')).toBeNull();
});

test.each([
	{ mode: "Read", authorized: true, expected: true, write: false },
	{ mode: "Write", authorized: true, expected: true, write: true },
	{ mode: "Read", authorized: false, expected: false, write: false },
	{ mode: "Read", authorized: undefined, expected: true, write: false },
])("measures $mode authorization with the provider decision $authorized", async ({ mode, authorized, expected, write }) => {
	jest.mocked(trackProductEvent).mockClear();
	const action = jest.fn().mockResolvedValue({ callbackUrl: "https://client.example/callback?code=private-code&state=private-state", ...(authorized === undefined ? {} : { authorized }) });
	render(<ConsentForm {...props} action={action} />);
	choose("Creator one");
	if (mode === "Write") fireEvent.click(within(screen.getByRole("radiogroup", { name: "General permissions" })).getByRole("radio", { name: "Write" }));
	review();
	fireEvent.click(screen.getByRole("button", { name: "Authorize", exact: true }));
	await screen.findByRole("heading", { name: expected ? "Authorization successful" : "Authorization declined" });
	expect(action).toHaveBeenCalledTimes(1);
	expect(action.mock.calls[0][0].get("accept")).toBe("true");
	expect(trackProductEvent).toHaveBeenCalledTimes(1);
	expect(trackProductEvent).toHaveBeenCalledWith(expected ? "connected_app_authorized" : "connected_app_declined", { creator_count: 1, stage: expected ? "code_issued" : "declined", write_access: write });
	expect(JSON.stringify(jest.mocked(trackProductEvent).mock.calls)).not.toMatch(/private-code|private-state|signed-query|Creator one/);
});

test("a provider validation failure preserves review and permits a measured successful retry", async () => {
	jest.mocked(trackProductEvent).mockClear();
	const action = jest.fn().mockResolvedValueOnce({ error: "Restart the connection from your app." }).mockResolvedValueOnce({ callbackUrl: "https://client.example/callback?code=private-code", authorized: true });
	const { container } = render(<ConsentForm {...props} action={action} />);
	choose("Creator one");
	review();
	const choices = container.querySelector<HTMLInputElement>('input[name="creators"]')!.value;
	fireEvent.click(screen.getByRole("button", { name: "Authorize", exact: true }));
	await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Restart the connection"));
	expect(trackProductEvent).not.toHaveBeenCalled();
	expect(container.querySelector<HTMLInputElement>('input[name="creators"]')!.value).toBe(choices);
	expect(screen.getByRole("button", { name: "Authorize", exact: true })).toBeEnabled();
	fireEvent.click(screen.getByRole("button", { name: "Authorize", exact: true }));
	await screen.findByRole("heading", { name: "Authorization successful" });
	expect(action).toHaveBeenCalledTimes(2);
	expect(trackProductEvent).toHaveBeenCalledTimes(1);
});

test("an empty provider response does not fabricate authorization or leave submission disabled", async () => {
	jest.mocked(trackProductEvent).mockClear();
	const action = jest.fn().mockResolvedValue(undefined);
	render(<ConsentForm {...props} action={action} />);
	choose("Creator one");
	review();
	fireEvent.click(screen.getByRole("button", { name: "Authorize", exact: true }));
	await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
	await waitFor(() => expect(screen.getByRole("button", { name: "Authorize", exact: true })).toBeEnabled());
	expect(trackProductEvent).not.toHaveBeenCalled();
	expect(screen.getByRole("heading", { name: "Review and authorize" })).toBeVisible();
});
