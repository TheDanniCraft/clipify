/** @jest-environment node */
const redirect = jest.fn((url: string) => {
	throw new Error(`REDIRECT:${url}`);
});
const missing = jest.fn(() => {
	throw new Error("NOT_FOUND");
});
jest.mock("next/navigation", () => ({ permanentRedirect: (url: string) => redirect(url), notFound: () => missing() }));
import GuidePage, { generateStaticParams } from "@/app/guides/[slug]/page";
import { publicGuides } from "@lib/publicGuides";

it.each(publicGuides)("keeps $slug pointed at its one maintained Help Center article", async ({ slug, helpHref }) => {
	await expect(GuidePage({ params: Promise.resolve({ slug }) })).rejects.toThrow(`REDIRECT:${helpHref}`);
	expect(new URL(helpHref).pathname).toMatch(/^\/hc\/clipify\/articles\/[^/]+$/);
});
it("keeps unknown guide URLs as not found", async () => {
	await expect(GuidePage({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NOT_FOUND");
	expect(generateStaticParams()).toHaveLength(3);
});
