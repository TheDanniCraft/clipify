import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("isEmbeddedRoute", () => {
	it.each(["/embed/player-id", "/overlay/overlay-id", "/demoPlayer", "/gallery/gallery-id", "/gallery/gallery-id/clip/clip-id", "/dashboard/galleries/gallery-id/preview", "/dashboard/galleries/gallery-id/preview/clip/clip-id"])("excludes third-party page scripts from %s", (pathname) => {
		expect(isEmbeddedRoute(pathname)).toBe(true);
	});

	it.each(["/", "/gallery", "/galleryish", "/creators/the_danni_craft", "/dashboard/galleries/gallery-id", "/dashboard/galleries/gallery-id/previewish"])("keeps public-page scripts available on %s", (pathname) => {
		expect(isEmbeddedRoute(pathname)).toBe(false);
	});

	it("does not preconnect globally to optional third-party script hosts", () => {
		const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
		expect(layout).not.toContain("rel='preconnect' href='https://tag.goadopt.io'");
		expect(layout).not.toContain("rel='preconnect' href='https://affiliate.clipify.us'");
	});
});
