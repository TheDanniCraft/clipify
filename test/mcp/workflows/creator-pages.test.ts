/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US4-001 narrow Creator Page reads", () => {
	test("reads page settings, revision and real public route without account fields", () => {
		const row = flowProbe("catalogue:workflow:get_creator_page:success");
		expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", configurationRevision: 1, settings: { creatorPageEnabled: true, creatorPageVisibility: "unlisted", creatorPageShowBio: true }, capabilities: { socialPreview: true } });
		expect(row.result?.structuredContent.publicUrl).toContain("/creators/");
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US4-002 Creator Page editing", () => {
	test("updates only the narrow page settings and returns the next revision", () => {
		const row = flowProbe("catalogue:workflow:update_creator_page:success");
		expect(row.result?.structuredContent).toMatchObject({ configurationRevision: 2, settings: { creatorPageVisibility: "unlisted" } });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US4-003 Creator Page publication", () => {
	test("disables the public page without disabling the account", () => {
		const row = flowProbe("catalogue:workflow:publish_creator_page:success");
		expect(row.result?.structuredContent).toMatchObject({ configurationRevision: 2, published: false, settings: { creatorPageEnabled: false } });
		expect(row.safe).toBe(true);
	});
});
