import { CACHE_MAX, clamp, getSlotOpacity, parseThemeFontSetting, sanitizeFontCssUrl, trimCache } from "@/app/components/overlayPlayer.utils";

describe("components/overlayPlayer helpers", () => {
	it("trimCache keeps map size under cache max by evicting oldest key", () => {
		const map = new Map<string, unknown>();
		for (let idx = 0; idx < CACHE_MAX + 1; idx += 1) {
			map.set(`k-${idx}`, idx);
		}

		trimCache(map);

		expect(map.size).toBe(CACHE_MAX);
		expect(map.has("k-0")).toBe(false);
		expect(map.has(`k-${CACHE_MAX}`)).toBe(true);
	});

	it("clamp enforces lower and upper bounds", () => {
		expect(clamp(-5, 0, 10)).toBe(0);
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(50, 0, 10)).toBe(10);
	});

	it("parses theme font family and optional font URL delimiter format", () => {
		expect(parseThemeFontSetting(undefined)).toEqual({ fontFamily: "inherit", fontUrl: "" });
		expect(parseThemeFontSetting("Rubik")).toEqual({ fontFamily: "Rubik", fontUrl: "" });
		expect(parseThemeFontSetting("Inter||url||https://fonts.googleapis.com/css2?family=Inter")).toEqual({
			fontFamily: "Inter",
			fontUrl: "https://fonts.googleapis.com/css2?family=Inter",
		});
		expect(parseThemeFontSetting("||url||https://fonts.googleapis.com/css2?family=Inter")).toEqual({
			fontFamily: "inherit",
			fontUrl: "https://fonts.googleapis.com/css2?family=Inter",
		});
	});

	it("accepts only https fonts.googleapis.com CSS URLs for custom fonts", () => {
		expect(sanitizeFontCssUrl("https://fonts.googleapis.com/css2?family=Inter")).toBe("https://fonts.googleapis.com/css2?family=Inter");
		expect(sanitizeFontCssUrl("http://fonts.googleapis.com/css2?family=Inter")).toBe("");
		expect(sanitizeFontCssUrl("https://evil.example.com/font.css")).toBe("");
		expect(sanitizeFontCssUrl("not-a-url")).toBe("");
	});

	it("computes slot opacity for active/inactive slots and crossfade visibility", () => {
		expect(getSlotOpacity("a", "a", false, true)).toBe(1);
		expect(getSlotOpacity("a", "a", true, true)).toBe(0);
		expect(getSlotOpacity("b", "a", true, true)).toBe(1);
		expect(getSlotOpacity("b", "a", false, true)).toBe(0);
		expect(getSlotOpacity("a", "a", false, false)).toBe(0);
	});
});
