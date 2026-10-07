/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-SANITIZE-001 shared configuration semantics", () => {
	test.each([
		["font", { theme_font_family: "inherit" }],
		["color", { theme_text_color: "#FFFFFF" }],
		["type", { type: "Featured", playback_mode: "random", playlist_id: null }],
	])("%s normalized in actual locked mutation", (mode, expected) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-sanitize-" + mode]);
		expect(r.deleted).toMatchObject({ configurationRevision: 2 });
		expect(r.storedOverlay).toMatchObject(expected);
		expect(r.activity).toHaveLength(1);
	});
});
