jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
jest.mock("@/app/auth/mcp/consent/CallbackHandoff", () => ({ CallbackHandoff: () => <h1>Authorization successful</h1> }));
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
	fireEvent.click(screen.getByRole("radio", { name }));
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}
function review() {
	fireEvent.click(screen.getByRole("button", { name: "Review" }));
}
test("starts with creator selection and preserves independent write/read choices", () => {
	const { container } = render(<ConsentForm {...props} />);
	expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
	choose("Creator one");
	fireEvent.click(within(screen.getByRole("group", { name: "General permissions" })).getByRole("button", { name: "Write" }));
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
	fireEvent.click(within(screen.getByRole("group", { name: "General permissions" })).getByRole("button", { name: "Custom" }));
	expect(within(screen.getByRole("group", { name: "Creator information access" })).getByRole("button", { name: "Write" })).toBeDisabled();
	fireEvent.click(within(screen.getByRole("group", { name: "Overlays access" })).getByRole("button", { name: "None" }));
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
	expect(screen.getByRole("radio", { name: "Creator one" })).toBeChecked();
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	fireEvent.click(screen.getByRole("button", { name: "Back" }));
	expect(screen.getByRole("radio", { name: "Creator one" })).toBeChecked();
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	review();
	fireEvent.click(screen.getByRole("button", { name: "Remove Creator one from connection" }));
	expect(screen.getByText("Creator two")).toBeVisible();
	expect(screen.getByRole("button", { name: "Authorize" })).toBeEnabled();
});
test("read-only requests disable Write and cannot gain unrequested permissions", () => {
	render(<ConsentForm {...props} requestedScopes={["creator:read"]} />);
	choose("Creator one");
	expect(within(screen.getByRole("group", { name: "General permissions" })).getByRole("button", { name: "Write" })).toBeDisabled();
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
