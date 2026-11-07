import { getOwnTwitchPresence } from "@actions/dashboardPresence";
export async function GET() {
	return Response.json({ live: await getOwnTwitchPresence() }, { headers: { "Cache-Control": "private, no-store" } });
}
