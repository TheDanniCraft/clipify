import { expect, test } from "@playwright/test";
import sharp from "sharp";

for (const path of ["/pricing", "/features", "/community", "/changelog", "/roadmap", "/gallery", "/"]) {
	test(`${path} provides a complete social sharing image`, async ({ page, request }) => {
		await page.goto(path, { waitUntil: "domcontentloaded" });
		const image = page.locator('meta[property="og:image"]');
		await expect(image).toHaveCount(1);
		const url = await image.getAttribute("content");
		expect(url).toMatch(/^https?:\/\//);
		await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
		await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
		await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /Clipify/);
		await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
		await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", url!);
		// Metadata can use the production origin; fetch its path against this isolated app.
		const response = await request.get(new URL(url!).pathname + new URL(url!).search);
		expect(response.ok()).toBe(true);
		const body = await response.body();
		expect(body.byteLength).toBeLessThan(1_000_000);
		const metadata = await sharp(body).metadata();
		expect([metadata.width, metadata.height]).toEqual([1200, 630]);
	});
}
