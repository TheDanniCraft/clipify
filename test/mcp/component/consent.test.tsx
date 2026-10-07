jest.mock("@heroui-pro/react", () => require("../../support/mcp/heroui-fixture").proComponents, { virtual: true });
jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
let ConsentForm: any;
try {
	ConsentForm = require("@/app/auth/mcp/consent/ConsentForm").ConsentForm;
} catch {}
const requested = ["creator:read", "overlay:read", "playlist:read", "overlay:create", "overlay:update", "playlist:create", "playlist:update", "playlist-items:manage", "overlay:delete", "playlist:delete"];
const props = {
	clientName: "Custom AI client",
	requestedScopes: requested,
	creators: [
		{ creatorId: "creator-1", agencyOrganizationId: null, name: "Creator one" },
		{ creatorId: "creator-2", agencyOrganizationId: "agency", name: "Creator two" },
	],
	oauthQuery: "fixture-signed-query",
	action: jest.fn(),
};
describe("TDD-US1-027 consent UI", () => {
	test("shows client, explicit creators, presets and separate unchecked deletions", () => {
		expect(ConsentForm).toEqual(expect.any(Function));
		render(<ConsentForm {...props} />);
		expect(screen.getByRole("heading", { name: "Connect Custom AI client" })).toBeVisible();
		expect(screen.getByRole("radio", { name: "Read" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Creator one" })).not.toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Delete overlays" })).not.toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Delete playlists" })).not.toBeChecked();
	});
	test("edit preset is customizable and never automatically opts into deletion", () => {
		expect(ConsentForm).toEqual(expect.any(Function));
		render(<ConsentForm {...props} />);
		fireEvent.click(screen.getByRole("radio", { name: "Read & edit" }));
		expect(screen.getByRole("checkbox", { name: "Create overlays" })).toBeChecked();
		fireEvent.click(screen.getByRole("checkbox", { name: "Create overlays" }));
		expect(screen.getByRole("checkbox", { name: "Create overlays" })).not.toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Delete overlays" })).not.toBeChecked();
		fireEvent.click(screen.getByRole("checkbox", { name: "Delete playlists" }));
		expect(screen.getByRole("checkbox", { name: "Delete playlists" })).toBeChecked();
	});
	test("only renders permissions actually requested by this client", () => {
		expect(ConsentForm).toEqual(expect.any(Function));
		render(<ConsentForm {...props} requestedScopes={["creator:read"]} />);
		expect(screen.queryByRole("checkbox", { name: "Delete playlists" })).not.toBeInTheDocument();
	});
	test("submission failure leaves a safe retry message instead of exposing internal errors", async () => {
		expect(ConsentForm).toEqual(expect.any(Function));
		const action = jest.fn().mockRejectedValue(new Error("private-database-host"));
		const { container } = render(<ConsentForm {...props} action={action} />);
		fireEvent.click(screen.getByRole("checkbox", { name: "Creator one" }));
		fireEvent.submit(container.querySelector("form")!);
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again"));
		expect(screen.queryByText(/private-database-host/)).not.toBeInTheDocument();
	});
});

test("workflow permissions use readable labels and keep sensitive operations unchecked", () => {
	render(<ConsentForm {...props} requestedScopes={["gallery:read", "runner:read", "overlay:control", "overlay-secret:read", "runner-credential:rotate"]} />);
	expect(screen.getByRole("checkbox", { name: "Read galleries" })).toBeChecked();
	expect(screen.getByRole("checkbox", { name: "Read runners and stream sessions" })).toBeChecked();
	expect(screen.getByRole("checkbox", { name: "Control live overlays (Pro)" })).not.toBeChecked();
	expect(screen.getByRole("checkbox", { name: "Read private OBS overlay URLs" })).not.toBeChecked();
	expect(screen.getByRole("checkbox", { name: "Disconnect enrolled runner devices" })).not.toBeChecked();
});
