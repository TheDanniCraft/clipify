import type { Pool } from "pg";

/** Commit changed authority after a successful call, then reuse the original token. */
export async function observeConnectedTransition(input: { route: { POST(request: Request): Promise<Response> }; origin: string; headers: Headers; transition: string; actorId: string; pool: Pool }) {
	const baseline = await input.route.POST(new Request(`${input.origin}/mcp`, { method: "POST", headers: input.headers, body: JSON.stringify({ jsonrpc: "2.0", id: 8811, method: "tools/call", params: { name: "list_overlays", arguments: { creatorId: "fixture-creator", limit: 25 } } }) }));
	const text = await baseline.text();
	const data =
		text.startsWith("event:") || text.startsWith("data:")
			? text
					.split("\n")
					.find((line) => line.startsWith("data:"))
					?.slice(5)
					.trim()
			: text;
	const result = data ? JSON.parse(data) : null;
	const before = result?.result?.structuredContent;
	if (baseline.status !== 200 || !Array.isArray(before?.items)) throw new Error("Connected transition requires a successful authorized baseline");
	switch (input.transition) {
		case "upgrade":
			await input.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			break;
		case "downgrade":
			await input.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
			break;
		case "trial-expiry":
		case "grant-expiry":
			await input.pool.query("UPDATE entitlement_grants SET ends_at=now()-interval '1 second' WHERE user_id='fixture-creator'");
			break;
		case "team-removal":
			await input.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org' AND user_id=$1", [input.actorId]);
			break;
		case "agency-unlink":
			await input.pool.query("UPDATE agency_creator_links SET status='revoked',revoked_by=$1,revoked_at=now() WHERE agency_organization_id='policy-agency-org'", [input.actorId]);
			break;
		case "suspension":
			await input.pool.query("UPDATE creator_accounts SET status='suspended',suspension_at=now() WHERE creator_id='fixture-creator'");
			break;
		default:
			throw new Error("Unsupported connected transition fixture");
	}
	return { baselineStatus: baseline.status, baselineOverlayCount: before.items.length, changeCommitted: true, reusedOriginalToken: true };
}
