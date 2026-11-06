/** @jest-environment node */
import { overlayMetadataHeight, overlayMetadataContent, overlayMetadataSvg, wrapOverlayText, widgetThemeSchema, DEFAULT_WIDGET_THEME } from "@lib/overlayMetadata";
import sharp from "sharp";
it("groups title and credit and identifies channel metadata with context", () => {
	expect(overlayMetadataContent("title", { title: "An excellent play", clipCreatorName: "Viewer" })).toEqual({ primary: "An excellent play", secondary: "clipped by Viewer" });
	expect(overlayMetadataContent("channel", { title: "", broadcasterName: "Streamer", categoryName: "Just Chatting" }).secondary).toBe("Playing Just Chatting");
	expect(overlayMetadataContent("channel", { title: "" }).secondary).toBe("Twitch channel");
	expect(overlayMetadataContent("clipper", { title: "" }).primary).toBe("Twitch clip");
	expect(overlayMetadataContent("title", { title: "" }).primary).toBe("Untitled clip");
});
it("uses words across the available width rather than short fixed character chunks", () => {
	expect(wrapOverlayText("An excellent ranked comeback", 680, 32)).toEqual(["An excellent ranked comeback"]);
	expect(wrapOverlayText("One two three four five six seven eight nine ten", 150, 24, 2)).toHaveLength(2);
	expect(wrapOverlayText("W".repeat(200), 100, 24, 2)[1]).toMatch(/…$/);
	expect(wrapOverlayText("", 100, 24)).toEqual([]);
});
it("validates the same appearance fields used by overlay theme controls", () => {
	for (const color of ["#fff", "#abcd", "#123456", "#12345678", "rgba(10,20,30,0.5)", "rgb(0,255,20)"]) expect(widgetThemeSchema.safeParse({ themeTextColor: color }).success).toBe(true);
	for (const color of ["url(https://evil.invalid)", 'red"/><script/>', "rgba(300,0,0,1)", "rgba(0,0,0,2)", "rgba(1.2.3,0,0,1)"]) expect(widgetThemeSchema.safeParse({ themeBackgroundColor: color }).success).toBe(false);
	expect(widgetThemeSchema.safeParse({ borderRadius: -1 }).success).toBe(false);
	expect(widgetThemeSchema.parse({})).toEqual(DEFAULT_WIDGET_THEME);
});
it("produces bounded native SVG pixels with literal hostile-looking text and themed rounded panels", async () => {
	const clip = { title: 'A <script> & "ranked" play', broadcasterName: "Streamer", clipCreatorName: "Viewer" };
	for (const kind of ["title", "channel", "clipper"] as const) {
		const svg = overlayMetadataSvg(kind, clip, 720, 200, 32, { ...DEFAULT_WIDGET_THEME, themeBackgroundColor: "#ffffff", themeTextColor: "#000000", borderSize: 2 });
		expect(svg).not.toContain("<script>");
		const image = await sharp(Buffer.from(svg)).png().toBuffer();
		expect(await sharp(image).metadata()).toMatchObject({ width: 720, height: 200 });
	}
	const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: "white" } })
		.png()
		.toBuffer();
	expect(overlayMetadataSvg("channel", clip, 720, 120, 32, undefined, `data:image/png;base64,${png.toString("base64")}`)).toContain("<image");
	expect(overlayMetadataSvg("channel", clip, 720, 120, 32, undefined, "https://evil.invalid/image")).not.toContain("<image");
});

it("sizes grouped widgets to their content rather than leaving permanent empty panels", () => {
	const short = overlayMetadataHeight("title", { title: "Good play", clipCreatorName: "Viewer" }, 720, 32);
	const long = overlayMetadataHeight("title", { title: "A very long title with many words ".repeat(5), clipCreatorName: "Viewer" }, 720, 32);
	expect(short).toBeLessThan(long);
	expect(short).toBeLessThan(128);
	expect(overlayMetadataHeight("channel", { title: "", broadcasterName: "Creator" }, 720, 32)).toBeGreaterThan(80);
	expect(overlayMetadataHeight("clipper", { title: "" }, 720, 32)).toBeLessThan(100);
});

it("validates creator-wide fonts and branding without accepting CSS or remote font URLs", () => {
	const schema = (require("@lib/overlayMetadata") as typeof import("@lib/overlayMetadata") & { creatorBrandSchema: import("zod").ZodType }).creatorBrandSchema;
	expect(schema).toBeDefined();
	expect(schema.safeParse({ fontFamily: "Laila", fontSource: "google", watermark: false }).success).toBe(true);
	for (const input of [{ fontFamily: "Laila; color:red", fontSource: "google" }, { fontFamily: "Arial", fontSource: "builtin" }, { fontSource: "https://evil.invalid/font.ttf" }]) expect(schema.safeParse(input).success).toBe(false);
	expect(schema.parse({})).toMatchObject({ watermark: true, fontFamily: "DejaVu Sans", fontSource: "builtin" });
});

it("maps a saved brand to overlay colors and typography without layout fields", async () => {
	const { creatorBrandSchema, brandOverlayFields, clipifyWatermarkSvg } = await import("@lib/overlayMetadata");
	expect(brandOverlayFields(creatorBrandSchema.parse({}))).toMatchObject({ themeFontFamily: "DejaVu Sans", borderRadius: 10 });
	expect(brandOverlayFields(creatorBrandSchema.parse({ fontFamily: "Laila", fontSource: "google" })).themeFontFamily).toContain("https://fonts.googleapis.com/css2?family=Laila");
	expect(clipifyWatermarkSvg()).toContain("clipify.us");
});

it("shows the channel address and cycles branding through six fixed edge positions", async () => {
	const { clipifyWatermarkPosition, clipifyWatermarkExpression, clipifyWatermarkPositions } = await import("@lib/overlayMetadata");
	expect(overlayMetadataContent("channel", { title: "", broadcasterName: "TheDanniCraft" }, true)).toEqual({ primary: "TheDanniCraft", secondary: "twitch.tv/thedannicraft" });
	expect([0, 8, 16, 24, 32, 40, 48].map((time) => clipifyWatermarkPosition(time, clipifyWatermarkPositions(1280, 720)))).toEqual([
		{ x: 1072, y: 652 },
		{ x: 16, y: 175 },
		{ x: 1072, y: 16 + 636 * 0.6 },
		{ x: 16, y: 652 },
		{ x: 1072, y: 16 },
		{ x: 16, y: 16 + 636 * 0.65 },
		{ x: 1072, y: 652 },
	]);
	expect(clipifyWatermarkExpression(0, clipifyWatermarkPositions(1280, 720))).toContain("mod(t,48)");
});

it("fits both widget dimensions without forcing glyph proportions", async () => {
	const { overlayMetadataSize } = await import("@lib/overlayMetadata");
	const size = overlayMetadataSize("channel", { title: "", broadcasterName: "Streamer" }, 32, 720);
	expect(size.width).toBeLessThan(720);
	expect(size.height).toBeGreaterThan(32);
	expect(overlayMetadataSvg("channel", { title: "", broadcasterName: "Streamer" }, size.width, size.height, 32)).not.toMatch(/textLength|lengthAdjust/);
});

it("keeps branding clear of widgets, including free space away from the default edge positions", async () => {
	const { clipifyWatermarkPositions, clipifyWatermarkPosition, CLIPIFY_WATERMARK } = await import("@lib/overlayMetadata");
	const frames = [
		{ x: 0, y: 0, w: 0.3, h: 1 },
		{ x: 0.7, y: 0, w: 0.3, h: 1 },
	];
	const positions = clipifyWatermarkPositions(720, 1280, frames);
	expect(positions.length).toBeGreaterThan(0);
	for (const position of positions) {
		expect(position.x).toBeGreaterThanOrEqual(216);
		expect(position.x + CLIPIFY_WATERMARK.width).toBeLessThanOrEqual(504);
	}
	expect(clipifyWatermarkPosition(8, positions)).toEqual(positions[1 % positions.length]);
	const blockedCorner = clipifyWatermarkPositions(720, 1280, [{ x: 0.65, y: 0.9, w: 0.35, h: 0.1 }]);
	expect(blockedCorner).not.toContainEqual({ x: 512, y: 1212 });
});

it("keeps logo and text transparent outside their shapes", async () => {
	const { clipifyWatermarkSvg } = await import("@lib/overlayMetadata");
	const { data, info } = await sharp(Buffer.from(clipifyWatermarkSvg())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	expect(info.channels).toBe(4);
	expect(data[(20 * info.width + info.width - 1) * 4 + 3]).toBe(0);
	expect(clipifyWatermarkSvg()).not.toContain("<rect");
	expect(clipifyWatermarkSvg()).not.toMatch(/stroke=|filter=|text-shadow/);
	expect(clipifyWatermarkSvg()).toContain('font-weight="700"');
});

it("keeps branding bounded when widgets occupy the entire canvas", async () => {
	const { clipifyWatermarkPositions, clipifyWatermarkExpression } = await import("@lib/overlayMetadata");
	const positions = clipifyWatermarkPositions(1280, 720, [{ x: 0, y: 0, w: 1, h: 1 }]);
	expect(positions).toEqual([{ x: 1072, y: 652 }]);
	expect(clipifyWatermarkExpression(0, positions)).toBe("1072");
});
