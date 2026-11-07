/** @jest-environment node */
export {};
it("serves only the installed built-in font files without accepting paths", async () => {
	const route = await import("@/app/api/brand-font/route").catch(() => null);
	expect(route).not.toBeNull();
	if (!route) return;
	const response = await route.GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans&weight=400"));
	expect(response.status).toBe(200);
	expect(Buffer.from(await response.clone().arrayBuffer()).equals(await (await import("node:fs/promises")).readFile("public/fonts/brand/DejaVuSans.ttf"))).toBe(true);
	expect(response.headers.get("content-type")).toBe("font/ttf");
	expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
	expect((await route.GET(new Request("http://localhost/api/brand-font?family=../../etc/passwd&weight=400"))).status).toBe(404);
	expect((await route.GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans&weight=900"))).status).toBe(404);
});
it("serves bold fonts and reports a missing runtime font without disclosing paths", async () => {
	const { GET } = await import("@/app/api/brand-font/route");
	expect((await GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans&weight=700"))).status).toBe(200);
	expect((await GET(new Request("http://localhost/api/brand-font"))).status).toBe(404);
	const fs = (await import("node:fs/promises")).default;
	const spy = jest.spyOn(fs, "readFile").mockRejectedValueOnce(Error("missing"));
	try {
		expect((await GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans"))).status).toBe(503);
	} finally {
		spy.mockRestore();
	}
});

it("centers channel name and address together beside the avatar", async () => {
	const { renderBrandWidget } = await import("@/server/brand-font-render");
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	const sharp = (await import("sharp")).default;
	const png = await renderBrandWidget("channel", { title: "", broadcasterName: "Streamer" }, 720, 200, 32, creatorBrandSchema.parse({ themeBackgroundColor: "#00000000" }), AbortSignal.timeout(10000));
	const pixels = await sharp(png).ensureAlpha().raw().toBuffer();
	const ys: number[] = [];
	for (let y = 0; y < 200; y++)
		for (let x = 205; x < 720; x++) {
			const i = (y * 720 + x) * 4;
			if (pixels[i] > 220 && pixels[i + 1] > 220 && pixels[i + 2] > 220 && pixels[i + 3] > 150) ys.push(y);
		}
	expect(ys.length).toBeGreaterThan(20);
	expect(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 100)).toBeLessThanOrEqual(2);
});
