/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { usersTable, awardEventsTable, entitlementGrantsTable } from "@/db/schema";
import { Role, Plan, Entitlement, EntitlementGrantSource } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
const now = new Date("2026-02-04");
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("lists only published public awards from enabled creators with a current partner grant", async () => {
	fixture = await createMcpPostgresFixture();
	for (const id of ["partner", "expired", "ordinary", "disabled"]) {
		await fixture.db.insert(usersTable).values({ id, username: id, email: `${id}@example.invalid`, avatar: "", role: Role.User, plan: Plan.Free, disabled: id === "disabled" });
		const configuration = createAwardConfiguration(`${id} public`, "UTC");
		configuration.visibility = "public";
		await fixture.db.insert(awardEventsTable).values({ ownerId: id, configuration, presenterDigest: "a".repeat(64), publishedAt: now });
	}
	for (const id of ["partner", "expired", "disabled"]) await fixture.db.insert(entitlementGrantsTable).values({ id: crypto.randomUUID(), userId: id, entitlement: Entitlement.ProAccess, source: EntitlementGrantSource.Partner, reason: "partner", startsAt: new Date("2026-01-01"), endsAt: id === "expired" ? new Date("2026-02-01") : null });
	const unlisted = createAwardConfiguration("Secret show", "UTC");
	await fixture.db.insert(awardEventsTable).values({ ownerId: "partner", configuration: unlisted, presenterDigest: "b".repeat(64), publishedAt: now });
	const draft = createAwardConfiguration("Draft", "UTC");
	draft.visibility = "public";
	await fixture.db.insert(awardEventsTable).values({ ownerId: "partner", configuration: draft, presenterDigest: "c".repeat(64) });
	const { listPublicAwardEvents } = await import("@/server/events/discovery");
	const result = await listPublicAwardEvents(now);
	expect(result).toMatchObject({ ok: true, events: [{ title: "partner public", creatorName: "partner" }] });
	if (result.ok) expect(result.events).toHaveLength(1);
	expect(JSON.stringify(result)).not.toMatch(/presenterDigest|frozenResults|Secret show|Draft/);
}, 30000);
