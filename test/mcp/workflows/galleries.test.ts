/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US3-001 gallery listing", () => {
	test("lists creator-owned gallery configuration without credentials", () => {
		const row = flowProbe("catalogue:workflow:list_galleries:success");
		expect(row.result?.structuredContent).toMatchObject({ items: [{ id: row.ids.galleryId, creatorId: "fixture-creator", name: "Workflow gallery", configurationRevision: 1 }], nextCursor: null });
		expect(row.safe).toBe(true);
	});
});
describe("TDD-US3-002 safe gallery details", () => {
	test("reads saved content/layout/theme and current capabilities", () => {
		const row = flowProbe("catalogue:workflow:get_gallery:success");
		expect(row.result?.structuredContent).toMatchObject({ gallery: { id: row.ids.galleryId, creatorId: "fixture-creator", configurationRevision: 1, layout: "grid", theme: "system" }, capabilities: { advanced: true } });
		expect(row.safe).toBe(true);
	});
});
describe("TDD-US3-003 gallery creation and limits", () => {
	test("creates a draft gallery with a revision and safe retained retry identity", () => {
		const row = flowProbe("catalogue:workflow:create_gallery:success");
		expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", name: "New gallery", published: false, configurationRevision: 1 });
		expect(row.safe).toBe(true);
	});
	test("cannot create a second Free gallery", () => {
		const row = flowProbe("catalogue:workflow:create_gallery:free");
		expect(row.result?.structuredContent?.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
		expect(row.writes).toBe(0);
	});
});
describe("TDD-US3-004 revision-aware gallery editing", () => {
	test("changes the requested configuration and advances the revision", () => {
		const row = flowProbe("catalogue:workflow:update_gallery_settings:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.galleryId, name: "Edited gallery", configurationRevision: 2 });
		expect(row.safe).toBe(true);
	});
	test("rejects stale revisions", () => {
		const row = flowProbe("catalogue:workflow:update_gallery_settings:stale_revision");
		expect(row.result?.structuredContent?.error?.code).toBe("CONFLICT");
		expect(row.writes).toBe(0);
	});
});
describe("TDD-US3-PAID preserved paid configuration", () => {
	test("Free name edits preserve saved custom dates", () => {
		const row = flowProbe("catalogue:workflow:update_gallery_settings:free_preserve");
		expect(row.result?.structuredContent).toMatchObject({ name: "Edited gallery", liveCustomStart: "2026-10-01T00:00:00.000Z", liveCustomEnd: "2026-10-06T00:00:00.000Z" });
	});
	test("Free agents cannot change paid gallery themes", () => {
		const row = flowProbe("catalogue:workflow:update_gallery_settings:paid_theme");
		expect(row.result?.structuredContent?.error?.code).toBe("FEATURE_RESTRICTED");
		expect(row.writes).toBe(0);
	});
});
describe("TDD-US3-005 gallery deletion", () => {
	test("deletes the current owned gallery with explicit permission", () => {
		const row = flowProbe("catalogue:workflow:delete_gallery:success");
		expect(row.result?.structuredContent).toMatchObject({ galleryId: row.ids.galleryId, deleted: true });
		expect(row.safe).toBe(true);
	});
});
describe("TDD-US3-006 explicit publication", () => {
	test("unpublishes through the dedicated publish permission and advances revision", () => {
		const row = flowProbe("catalogue:workflow:publish_gallery:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.galleryId, published: false, configurationRevision: 2 });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US3-007 supported gallery Elements", () => {
	test("returns a module loader and gallery element without an unsupported public URL", () => {
		const row = flowProbe("catalogue:workflow:get_gallery_embed:success");
		expect(row.result?.structuredContent).toMatchObject({ element: `<clipify-gallery gallery-id="${row.ids.galleryId}"></clipify-gallery>`, published: true });
		expect(row.result?.structuredContent.scriptTag).toContain('type="module"');
		expect(row.result?.structuredContent.html).toContain("/elements/v1/clipify.js");
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US3-008 effective gallery preview", () => {
	test("returns a safe preview of curated clips and current branding policy", () => {
		const row = flowProbe("catalogue:workflow:get_gallery_preview:success");
		expect(row.result?.structuredContent).toMatchObject({ galleryId: row.ids.galleryId, items: [], showAttribution: false, nextCursor: null });
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US3-009 explicit private OBS source", () => {
	test("returns the private browser-source URL only through the secret-read tool", () => {
		const row = flowProbe("catalogue:workflow:get_overlay_link:success");
		expect(row.result?.structuredContent).toMatchObject({ overlayId: row.ids.overlayId, purpose: "obs_browser_source", containsCredential: true, public: false });
		expect(row.result?.structuredContent.url).toContain("secret=private-workflow-overlay");
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US3-010 public player Elements", () => {
	test("returns public website snippets without the OBS secret", () => {
		const row = flowProbe("catalogue:workflow:get_player_embed:success");
		expect(row.result?.structuredContent).toMatchObject({ overlayId: row.ids.overlayId, format: "elements", public: true });
		expect(row.result?.structuredContent.html).toContain(`<clipify-player player-id="${row.ids.overlayId}" muted autoplay`);
		expect(row.result?.structuredContent.html).not.toContain("private-workflow-overlay");
		expect(row.safe).toBe(true);
	});
});

test.each(["iframe", "elements_options"])("public player %s includes supported options without OBS credentials", (variant) => {
	const row = flowProbe(`catalogue:workflow:get_player_embed:${variant}`);
	const value = row.result?.structuredContent;
	expect(value.public).toBe(true);
	expect(value.url).toContain("/embed/");
	expect(value.url).toContain("showBanner=true");
	expect(value.url).toContain("showOverlay=true");
	expect(value.html).toContain(variant === "iframe" ? "<iframe" : "<clipify-player");
	expect(value.html).not.toContain("secret");
	expect(row.safe).toBe(true);
});
