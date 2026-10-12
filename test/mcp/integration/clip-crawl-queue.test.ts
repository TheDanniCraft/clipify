/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
const probe = (mode: string) => runMcpProbe("clip-crawl-queue-probe", [mode]);
test("concurrent containers cannot claim the same job", () => {
	const result = probe("concurrent");
	expect(result.count).toBe(4);
	expect(new Set(result.identities).size).toBe(4);
});
test("crashed workers recover with a new lease and fence every old write", () => {
	expect(probe("recovery")).toEqual({ sameJob: true, differentLease: true, staleComplete: false, staleRetry: false, staleRenew: false, completed: true });
});
test("a refresh arriving during crawling remains queued after completion", () => {
	expect(probe("request-during-run")).toEqual({ creatorId: "creator-b", requested: true, due: true });
});
test("manual priority reserves ordinary oldest-due work", () => {
	expect(probe("priority-fairness")).toEqual({ priority: "creator-b", priorityKind: "recent", ordinary: "creator-a" });
});
test("repeated refresh requests coalesce", () => expect(probe("coalesce").count).toBe(2));
test("queue seeding rotates beyond the first batch of creators", () => expect(probe("seed-rotation").count).toBe(82));
test("disabled creators are never claimed", () => expect(probe("disabled").job).toBeNull());
test("a rolled-back refresh cannot leave a queued request", () => expect(probe("rollback").requested).toBeNull());

test("a completed refresh clears its request with PostgreSQL timestamp precision", () => expect(probe("request-completed")).toEqual({ cleared: true, rescheduled: true }));

test("bounded refresh continuations retain priority until the recent scan finishes", () => expect(probe("request-continuation")).toEqual({ requested: true, rescheduled: true }));

test("claims use due and priority indexes with 200000 queued jobs", () => {
	const result = probe("indexed-claims");
	expect(result.indexedDue).toBe(true);
	expect(result.indexedPriority).toBe(true);
});
