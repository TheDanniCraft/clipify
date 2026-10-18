/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RunnerGeneratedPresentation from "@/app/components/runnerGeneratedPresentation";
import * as branding from "@/server/runner/branding";
import { deriveRunnerCapabilities } from "@/server/runner/capabilities";

test("TDD-US4-OPT056: generated Free standby requires attribution without mutating the owner's authority", () => {
	const resolvePolicy = Reflect.get(branding, "resolveRunnerPresentationPolicy");
	expect(resolvePolicy).toEqual(expect.any(Function));
	if (typeof resolvePolicy !== "function") return;
	const authority = deriveRunnerCapabilities({ proAccess: false, runnerAccess: false }, new Date("2027-01-04T12:00:00Z"));
	const original = structuredClone(authority);
	expect(resolvePolicy(authority, "generated_standby")).toMatchObject({ attributionRequired: true });
	expect(authority).toEqual(original);
});

test("TDD-US4-OPT058: ordinary overlay authority does not acquire Runner attribution", () => {
	const authority = deriveRunnerCapabilities({ proAccess: false, runnerAccess: false }, new Date("2027-01-04T12:00:00Z"));
	expect(branding.resolveRunnerPresentationPolicy(authority, "ordinary_overlay")).toEqual({ attributionRequired: false });
});

test("TDD-US4-OPT054: Free generated clip playback requires Clipify attribution", () => {
	const authority = deriveRunnerCapabilities({ proAccess: false, runnerAccess: false }, new Date("2027-01-04T12:00:00Z"));
	expect(branding.resolveRunnerPresentationPolicy(authority, "generated_playback")).toEqual({ attributionRequired: true });
});

test("TDD-US4-FR016 / TDD-US4-OPT055 / TDD-US4-OPT057: disconnect and return brand only generated fallback", () => {
	const authority = deriveRunnerCapabilities({ proAccess: false, runnerAccess: false }, new Date("2027-01-04T12:00:00Z"));
	const surfaces = ["live", "generated_fallback", "live"] as const;
	expect(surfaces.map((surface) => branding.resolveRunnerPresentationPolicy(authority, surface).attributionRequired)).toEqual([false, true, false]);
});

test("TDD-US4-FR017: a top-left preference preserves the reference edge margin and input geometry", () => {
	const resolvePlacement = Reflect.get(branding, "resolveRunnerBrandingPlacement");
	expect(resolvePlacement).toEqual(expect.any(Function));
	if (typeof resolvePlacement !== "function") return;
	const input = { preferredCorner: "top_left" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [] };
	const original = structuredClone(input);
	expect(resolvePlacement(input)).toEqual({ status: "placed", left: 24, top: 24, position: "top_left" });
	expect(input).toEqual(original);
});

test("TDD-US4-FR017: 720p top-left output scales the reference edge margin", () => {
	const placement = branding.resolveRunnerBrandingPlacement({ preferredCorner: "top_left", viewport: { width: 1280, height: 720 }, badge: { width: 452, height: 94 }, occupied: [] });
	expect(placement).toEqual({ status: "placed", left: 16, top: 16, position: "top_left" });
});

test("TDD-US4-OPT050 U90: the actual top-left surface retains both readable lines and fixed translucent logo and text", () => {
	const props = { attributionRequired: true, executionGeneration: "top-left-render", watermarkCorner: "top_left" } satisfies Omit<Parameters<typeof RunnerGeneratedPresentation>[0], "children">;
	// React's factory supplies the required child from its third argument.
	const html = renderToStaticMarkup(createElement(RunnerGeneratedPresentation, props as Parameters<typeof RunnerGeneratedPresentation>[0], "Generated content"));
	expect(html).toContain("left:calc(100vh * 24 / 1080)");
	expect(html).toContain("top:calc(100vh * 24 / 1080)");
	expect(html).toContain("font-size:calc(100vh * 56 / 1080)");
	expect(html).toContain("width:calc(100vh * 112 / 1080)");
	expect(html.match(/opacity:0\.85/g)).toHaveLength(2);
	expect(html).toContain(">Livestream powered</span>");
	expect(html).toContain(">by Clipify.us</span>");
	expect(html).toContain('id="ClipifyLogo"');
	expect(html).toContain("Generated content");
});

test("TDD-US4-OPT051 U91: top-right placement respects the actual badge width and reference edge margin", () => {
	const input = { preferredCorner: "top_right" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [] };
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 1216, top: 24, position: "top_right" });
	expect(input).toEqual(original);
});

test("TDD-US4-OPT052 U92: bottom-left placement respects the actual badge height and reference edge margin", () => {
	const input = { preferredCorner: "bottom_left" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [] };
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 24, top: 916, position: "bottom_left" });
	expect(input).toEqual(original);
});

test("TDD-US4-OPT053 U93: bottom-right placement respects both actual badge dimensions and reference margins", () => {
	const input = { preferredCorner: "bottom_right" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [] };
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 1216, top: 916, position: "bottom_right" });
	expect(input).toEqual(original);
});

test("TDD-US4-DEC011 U221: contrast just below 4.5 fails the fixed attribution readability gate", () => {
	const readable = Reflect.get(branding, "isRunnerAttributionContrastReadable");
	expect(readable).toEqual(expect.any(Function));
	if (typeof readable !== "function") return;
	expect(readable(4.5 - Number.EPSILON * 4)).toBe(false);
});

test("TDD-US4-DEC011 U222: contrast exactly 4.5 passes the fixed attribution readability gate", () => {
	const readable = Reflect.get(branding, "isRunnerAttributionContrastReadable");
	expect(readable).toEqual(expect.any(Function));
	if (typeof readable !== "function") return;
	expect(readable(4.5)).toBe(true);
});

test("TDD-US4-DEC011 U193: the fixed translucent style preserves reference dimensions and passes worst-frame contrast", () => {
	const resolveStyle = Reflect.get(branding, "resolveRunnerAttributionStyle");
	expect(resolveStyle).toEqual(expect.any(Function));
	if (typeof resolveStyle !== "function") return;
	const style = resolveStyle();
	expect(style).toMatchObject({ fontSize: 56, lineHeight: 64, minTextHeight: 128, logoSize: 112, gap: 12, edgeInset: 24, foregroundOpacity: 0.85, readable: true });
	expect(style.backingOpacity).toBeGreaterThan(0);
	expect(style.backingOpacity).toBeLessThan(1);
	const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
	const backingOnWhite = 1 - style.backingOpacity;
	const inkOnWhite = style.foregroundOpacity + backingOnWhite * (1 - style.foregroundOpacity);
	const measured = (linear(inkOnWhite) + 0.05) / (linear(backingOnWhite) + 0.05);
	expect(measured).toBeGreaterThanOrEqual(4.5);
	expect(style.minimumContrast).toBeCloseTo(measured, 10);
});

test("TDD-US4-DEC012 U223: eleven reference pixels from a visible panel rejects the preferred position", () => {
	const input = { preferredCorner: "top_left" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [{ left: 715, top: 24, width: 200, height: 140 }] };
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 1216, top: 24, position: "top_right" });
	expect(input).toEqual(original);
});

test("TDD-US4-DEC012 U224: exactly twelve reference pixels preserves a clear preferred position", () => {
	const input = { preferredCorner: "top_left" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [{ left: 716, top: 24, width: 200, height: 140 }] };
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 24, top: 24, position: "top_left" });
	expect(input).toEqual(original);
});

test("TDD-US4-DEC012 U194: occupied corners retain the fixed badge at the first clear edge position", () => {
	const input = {
		preferredCorner: "top_left" as const,
		viewport: { width: 1920, height: 1080 },
		badge: { width: 680, height: 140 },
		occupied: [
			{ left: 24, top: 24, width: 100, height: 100 },
			{ left: 1796, top: 24, width: 100, height: 100 },
			{ left: 24, top: 956, width: 100, height: 100 },
			{ left: 1796, top: 956, width: 100, height: 100 },
		],
	};
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 24, top: 136, position: "left_edge" });
	expect(input).toEqual(original);
});

test("TDD-US4-DEC012 U194: a blocked left edge leaves the first clear right edge position", () => {
	const input = {
		preferredCorner: "top_right" as const,
		viewport: { width: 1920, height: 1080 },
		badge: { width: 680, height: 140 },
		occupied: [
			{ left: 0, top: 0, width: 800, height: 1080 },
			{ left: 1796, top: 24, width: 100, height: 100 },
			{ left: 1796, top: 956, width: 100, height: 100 },
		],
	};
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 1216, top: 136, position: "right_edge" });
});

test("TDD-US4-DEC012 U194: blocked side edges leave a clear top edge position", () => {
	const input = {
		preferredCorner: "top_left" as const,
		viewport: { width: 1920, height: 1080 },
		badge: { width: 680, height: 140 },
		occupied: [
			{ left: 24, top: 0, width: 100, height: 1080 },
			{ left: 1796, top: 0, width: 100, height: 1080 },
		],
	};
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 136, top: 24, position: "top_edge" });
});

test("TDD-US4-DEC012 U194: blocked sides and top leave the clear bottom edge position", () => {
	const input = {
		preferredCorner: "top_left" as const,
		viewport: { width: 1920, height: 1080 },
		badge: { width: 680, height: 140 },
		occupied: [
			{ left: 24, top: 0, width: 100, height: 1080 },
			{ left: 1796, top: 0, width: 100, height: 1080 },
			{ left: 0, top: 0, width: 1920, height: 200 },
		],
	};
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "placed", left: 136, top: 916, position: "bottom_edge" });
});

test("TDD-US4-DEC012 U194: a fully occupied frame is explicitly blocked without a hidden or smaller badge", () => {
	const input = { preferredCorner: "bottom_right" as const, viewport: { width: 1920, height: 1080 }, badge: { width: 680, height: 140 }, occupied: [{ left: 0, top: 0, width: 1920, height: 1080 }] };
	const original = structuredClone(input);
	expect(branding.resolveRunnerBrandingPlacement(input)).toEqual({ status: "blocked" });
	expect(input).toEqual(original);
});

test("TDD-US4-DEC012 U194: occupied decoration bounds include scaled outset shadows and preserve the input box", () => {
	const expand = Reflect.get(branding, "expandRunnerOccupiedRect");
	expect(expand).toEqual(expect.any(Function));
	if (typeof expand !== "function") return;
	const box = { left: 100, top: 200, width: 200, height: 52 };
	const original = structuredClone(box);
	const shadow = "rgba(0,0,0,0.15) 0px 10px 15px -3px, rgba(0,0,0,0.1) 0px 4px 6px -4px, inset rgba(0,0,0,0.5) 100px 100px 80px 20px";
	expect(expand(box, shadow, 2)).toEqual({ left: 61, top: 181, width: 278, height: 130 });
	expect(expand(box, "none")).toEqual(box);
	expect(box).toEqual(original);
});

test("TDD-US4-FR018 U18: a Pro owner saves attribution off without replacing profile identity or corner", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_pro_hide");
	expect(result.result).toMatchObject({ success: true, profile: { id: result.original.profile.id, watermarkCorner: "top_left", revision: 2, proShowAttribution: false } });
	expect(result.storedProAttribution).toBe(false);
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 2 }]);
});

test("TDD-US4-OPT093 U133: optional Runner Pro attribution brands generated surfaces while preserving live and ordinary output", () => {
	const authority = deriveRunnerCapabilities({ proAccess: false, runnerAccess: true });
	const saved = { proShowAttribution: true, watermarkCorner: "top_left" };
	const original = structuredClone({ authority, saved });
	const resolvePolicy = Reflect.get(branding, "resolveRunnerPresentationPolicy");
	const surfaces = ["generated_playback", "generated_fallback", "generated_standby", "live", "ordinary_overlay"] as const;
	expect(surfaces.map((surface) => resolvePolicy(authority, surface, saved).attributionRequired)).toEqual([true, true, true, false, false]);
	expect({ authority, saved }).toEqual(original);
	expect(authority.source).toBe("legacy");
});

test.each([
	{ boundary: "one millisecond before", now: 1999999, validUntil: new Date(2000000).toISOString(), required: false },
	{ boundary: "exact deadline", now: 2000000, validUntil: new Date(2000000).toISOString(), required: true },
	{ boundary: "one millisecond after", now: 2000001, validUntil: new Date(2000000).toISOString(), required: true },
	{ boundary: "unknown deadline", now: 2000000, validUntil: null, required: false },
	{ boundary: "absent legacy deadline", now: 2000000, validUntil: undefined, required: false },
	{ boundary: "malformed deadline", now: 2000000, validUntil: "not-a-date", required: true },
	{ boundary: "non-string deadline", now: 2000000, validUntil: 2000000, required: true },
])("TDD-US4-EXP001 U288: captured appearance at $boundary requires attribution=$required", ({ now, validUntil, required }) => {
	const authority = { runnerPro: true, validUntil };
	const original = structuredClone(authority);
	const clock = jest.spyOn(Date, "now").mockReturnValue(now);
	try {
		expect(branding.resolveRunnerPresentationPolicy(authority, "generated_playback", { proShowAttribution: false })).toEqual({ attributionRequired: required });
		expect(branding.resolveRunnerPresentationPolicy(authority, "live", { proShowAttribution: true })).toEqual({ attributionRequired: false });
		expect(branding.resolveRunnerPresentationPolicy(authority, "ordinary_overlay", { proShowAttribution: true })).toEqual({ attributionRequired: false });
		expect(authority).toEqual(original);
	} finally {
		clock.mockRestore();
	}
});

test("TDD-US4-EXP001 U288: the authorized owner read carries known paid validity without changing saved appearance", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_read_known_expiry");
	expect(result.result).toMatchObject({ success: true, runnerPro: true, validUntil: result.knownAppearanceEnd, profile: { id: result.original.profile.id, watermarkCorner: "top_left", proShowAttribution: false, revision: 1 } });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
	expect(JSON.stringify(result.result)).not.toContain(result.privateRunnerToken);
});

test.each(["true", "false"])("TDD-US4-FR018 U18 baseline: a Free owner cannot write the hidden paid attribution choice=%s", (choice) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:branding_free_choice_${choice}`);
	expect(result.result).toMatchObject({ success: false, code: "FEATURE_RESTRICTED", error: expect.any(String) });
	expect(result.storedProAttribution).toBe(false);
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US1-OPT086 U126: revoked editing authority retains the owned standby profile and revision", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_permission");
	expect(result.original).toMatchObject({ success: true });
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-OPT059 U99: Pro standby color persists atomically with the profile revision", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_color");
	expect(result.result).toMatchObject({ success: true, profile: { standbyBackgroundColor: "#16324f", revision: 2 } });
	expect(result.standbyColor).toBe("#16324f");
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 2 }]);
});

test.each([
	["free", "FEATURE_RESTRICTED"],
	["invalid", "INVALID_INPUT"],
])("TDD-US4-OPT059 U99 baseline: %s standby color refusal retains the entire previous profile", (variant, code) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:branding_standby_color_${variant}`);
	expect(result.result).toMatchObject({ success: false, code });
	expect(result.standbyColor).toBe("#000000");
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});
test("TDD-US4-OPT059 U99 baseline: an unrelated corner save preserves the paid standby color", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_color_omit");
	expect(result.result).toMatchObject({ success: true, profile: { standbyBackgroundColor: "#16324f", watermarkCorner: "bottom_right", revision: 3 } });
	expect(result.standbyColor).toBe("#16324f");
	expect(result.rows).toHaveLength(1);
});

test("TDD-US4-OPT060 U100: a normalized owned background asset saves atomically by opaque reference", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_background");
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: true, profile: { backgroundAssetId: expect.any(String), revision: 2 } });
	expect(result.storedBackground).toBe(result.result.profile.backgroundAssetId);
	expect(result.rows).toHaveLength(1);
});

test("TDD-US4-OPT061 U101: a normalized owned logo saves by its separate opaque profile reference", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_logo");
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: true, profile: { logoAssetId: expect.any(String), backgroundAssetId: null, revision: 2 } });
	expect(result.storedLogo).toBe(result.result.profile.logoAssetId);
	expect(result.storedBackground).toBeNull();
	expect(result.rows).toHaveLength(1);
});

test("TDD-US4-OPT062 U102: the owned plain-text standby message persists without interpreting markup", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_message");
	expect(result.result).toMatchObject({ success: true, profile: { message: "Back soon <3 — thanks for watching!", revision: 2 } });
	expect(result.storedMessage).toBe("Back soon <3 — thanks for watching!");
	expect(result.rows).toHaveLength(1);
});

test("TDD-US4-OPT063 U103: saved optional next-time resolves the owned future event beyond seven days in its own timezone", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_next_time");
	expect(result.result).toMatchObject({ success: true, profile: { showNextBroadcastTime: true, revision: 2 } });
	expect(result.stored).toBe(true);
	expect(result.available).toBe(true);
	expect(result.next).toEqual({ startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" });
});

test("TDD-US4-SC004 U39 baseline: all custom appearance fields round-trip atomically without changing source isolation or broadcast configuration", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_standby_compound");
	expect(result.initialized).toBe(true);
	expect(result.saved).toMatchObject({ success: true, profile: { revision: 2, watermarkCorner: "top_right", proShowAttribution: true, standbyBackgroundColor: "#16324f", logoAssetId: result.appearance.logoAssetId, backgroundAssetId: result.appearance.backgroundAssetId, message: "Back soon <3", showNextBroadcastTime: true } });
	expect(result.read).toMatchObject({ success: true, runnerPro: true, profile: result.saved.profile });
	expect(result.inputUnchanged).toBe(true);
	expect(result.configurationRevision).toBe(1);
	expect(result.admissions).toBe(0);
	expect(result.ordinary).toEqual({ attributionRequired: false });
	expect(result.live).toEqual({ attributionRequired: false });
	expect(result.generated).toEqual({ attributionRequired: true });
});

test("TDD-US4-BND012 U163 baseline: 159 plain-text characters persist without altering other appearance fields", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_message_boundary_159");
	expect(result.saved).toMatchObject({ success: true, profile: { message: "x".repeat(159), revision: 2 } });
	expect(result.after).toMatchObject({ ...result.before, message: "x".repeat(159), revision: 2, updated_at: expect.any(String) });
});

test("TDD-US4-BND013 U164 baseline: exactly 160 plain-text characters are accepted", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_message_boundary_160");
	expect(result.saved).toMatchObject({ success: true, profile: { message: "x".repeat(160), revision: 2 } });
	expect(result.after).toMatchObject({ ...result.before, message: "x".repeat(160), revision: 2, updated_at: expect.any(String) });
});

test("TDD-US4-BND014 U165 baseline: exactly 161 plain-text characters are rejected", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_message_boundary_161");
	expect(result.saved).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.unchanged).toBe(true);
	expect(result.after).toEqual(result.before);
});
