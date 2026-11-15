/** @jest-environment node */
import { createMcpPostgresFixture } from "../support/mcp/postgres";
import { recordProductOutcome } from "@/server/product-outcomes";
import { getConversionHealth } from "@/server/conversion-health";

jest.setTimeout(60000);
test("reports distinct recent creators and only mature first-week activation, excluding preview and pre-signup activity", async () => {
	const fixture = await createMcpPostgresFixture();
	const previous = process.env.NEXT_PUBLIC_BASE_URL;
	const now = new Date("2026-11-14T12:00:00Z"),
		day = 86400000;
	const at = (age: number) => new Date(now.getTime() - age * day);
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	try {
		for (const [id, age] of [
			["early", 10],
			["late", 10],
			["young", 2],
			["old", 40],
			["pre", 10],
		] as const) {
			await recordProductOutcome({ outcome: "creator_created", creatorId: id, key: "signup", occurredAt: at(age) }, fixture.db);
		}
		for (const [id, age] of [
			["early", 9],
			["late", 1],
			["young", 1],
			["old", 1],
			["pre", 11],
		] as const) {
			await recordProductOutcome({ outcome: "first_playback", creatorId: id, key: "first", occurredAt: at(age) }, fixture.db);
		}
		await recordProductOutcome({ outcome: "checkout_created", creatorId: "early", key: "one", occurredAt: at(8) }, fixture.db);
		await recordProductOutcome({ outcome: "checkout_created", creatorId: "early", key: "two", occurredAt: at(7) }, fixture.db);
		await recordProductOutcome({ outcome: "payment_verified", creatorId: "early", key: "invoice", occurredAt: at(7) }, fixture.db);
		process.env.NEXT_PUBLIC_BASE_URL = "https://preview.invalid";
		await recordProductOutcome({ outcome: "creator_created", creatorId: "preview", key: "signup", occurredAt: at(9) }, fixture.db);
		process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
		await fixture.pool.query("INSERT INTO billing_webhook_events(id,event_type,status,processing_started_at,received_at) VALUES ('failed','invoice.paid','failed',NULL,$1), ('stale','invoice.paid','processing',$2,$2), ('fresh','invoice.paid','processing',$3,$3)", [now, new Date(now.getTime() - 600000), new Date(now.getTime() - 60000)]);
		const result = await getConversionHealth(fixture.db, now);
		expect(result.webhooks).toEqual({ failed: 1, staleProcessing: 1, oldestProcessingAgeSeconds: 600 });
		expect(result).toMatchObject({ signups30d: 4, activated30d: 3, checkoutCreators30d: 1, paidCreators30d: 1, mature7dCreators: 3, activatedWithin7d: 1 });
		expect(JSON.stringify(result)).not.toMatch(/early|young|preview|invoice/);
	} finally {
		if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
		else process.env.NEXT_PUBLIC_BASE_URL = previous;
		await fixture.close();
	}
});
