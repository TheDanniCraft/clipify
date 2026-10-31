import { renderToStaticMarkup } from "react-dom/server";
import type { TwitchClip } from "@types";
import GalleryLandingPage from "@/app/gallery/page";

const load = jest.fn();
const connected = jest.fn();
jest.mock("next/server", () => ({ connection: () => connected() }));
jest.mock("@actions/gallery", () => ({ getDemoGalleryClips: () => load() }));
jest.mock("@components/LandingPage/basicNavbar", () => () => null);
jest.mock("@components/footer", () => () => null);
jest.mock("@components/gallery/PublicGalleryDemo", () => ({ __esModule: true, default: ({ initialBundle }: { initialBundle: { clips: TwitchClip[] } | null }) => <div>{initialBundle ? initialBundle.clips.map((clip) => <span key={clip.id}>{clip.title}</span>) : "Gallery retry"}</div> }));

beforeEach(() => jest.clearAllMocks());
it("includes the public collection in the server-rendered page without a load click", async () => {
	load.mockResolvedValue({ overlayId: "demo", clips: [{ id: "one", title: "A public highlight" }] });
	const html = renderToStaticMarkup(await GalleryLandingPage());
	expect(connected).toHaveBeenCalledTimes(1);
	expect(load).toHaveBeenCalledTimes(1);
	expect(html).toContain("A public highlight");
});
it("keeps signup and gallery recovery available when the public source is unavailable", async () => {
	load.mockRejectedValue(new Error("source unavailable"));
	const html = renderToStaticMarkup(await GalleryLandingPage());
	expect(html).toContain("Gallery retry");
	expect(html).toContain("Create your gallery");
});
