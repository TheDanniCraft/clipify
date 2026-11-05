/** @jest-environment node */
import sharp from "sharp";
import { readClipCompositionLogo } from "@/server/clip-composition-render";
jest.mock("server-only", () => ({}));
it("normalizes trusted profile images and rejects oversized raster dimensions", async () => {
	const original = global.fetch;
	try {
		const png = await sharp({ create: { width: 600, height: 400, channels: 4, background: "white" } })
			.png()
			.toBuffer();
		global.fetch = jest.fn().mockResolvedValue(new Response(png, { headers: { "content-type": "image/png" } }));
		const result = await readClipCompositionLogo("https://static-cdn.jtvnw.net/avatar.png", AbortSignal.timeout(5000));
		expect(await sharp(result).metadata()).toMatchObject({ format: "png", width: 512 });
		const large = await sharp({ create: { width: 1500, height: 1500, channels: 3, background: "white" } })
			.png()
			.toBuffer();
		global.fetch = jest.fn().mockResolvedValue(new Response(large, { headers: { "content-type": "image/png" } }));
		await expect(readClipCompositionLogo("https://static-cdn.jtvnw.net/avatar.png", AbortSignal.timeout(5000))).rejects.toThrow();
	} finally {
		global.fetch = original;
	}
});
