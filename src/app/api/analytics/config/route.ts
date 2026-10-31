export const dynamic = "force-dynamic";

export function GET() {
	return Response.json({ websiteId: process.env.UMAMI_WEBSITE_ID || "" }, { headers: { "Cache-Control": "no-store" } });
}
