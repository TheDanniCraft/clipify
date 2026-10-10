import { AgencyAllocationService, createAllocationState } from "@/server/agencies/allocations";
import { buildAgencyAllocationGrantIntent, buildAgencyAllocationRemovalIntents, renderAgencyAllocationNotification } from "@/server/notifications/templates/agency-allocation";

const NOW = new Date("2026-09-28T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("TDD-US4-003 agency creator-seat allocation", () => {
	it("allocates only an available creator seat through an accepted link", async () => {
		const state = createAllocationState({ seatLimit: 1, acceptedLinkIds: ["link_1"] });
		const service = new AgencyAllocationService(
			state,
			() => NOW,
			() => "allocation_1",
		);
		await service.allocate({ linkId: "link_1", creatorId: "creator_1", sourceReference: "agency-contract" });
		expect(service.occupiedSeats()).toBe(1);
		expect(state.notifications).toHaveLength(1);
		await expect(service.allocate({ linkId: "link_1", creatorId: "creator_2", sourceReference: "agency-contract" })).rejects.toThrow("NO_AGENCY_SEAT_AVAILABLE");
	});

	it("keeps the seat and agency benefits for exactly seven days without deleting data", async () => {
		const state = createAllocationState({
			seatLimit: 1,
			acceptedLinkIds: ["link_1"],
			allocations: [{ id: "allocation_1", linkId: "link_1", creatorId: "creator_1", status: "active", effectiveAt: NOW, removalRequestedAt: null, endsAt: null, sourceReference: "agency-contract", createdAt: NOW, updatedAt: NOW }],
		});
		let now = NOW;
		const service = new AgencyAllocationService(
			state,
			() => now,
			() => "unused",
		);
		await service.scheduleRemoval("allocation_1");
		expect(service.occupiedSeats()).toBe(1);
		expect(service.hasAgencyBenefit("creator_1")).toBe(true);
		now = new Date(NOW.getTime() + 7 * DAY - 1);
		await service.endDueAllocations();
		expect(service.hasAgencyBenefit("creator_1")).toBe(true);
		now = new Date(NOW.getTime() + 7 * DAY);
		await service.endDueAllocations();
		expect(service.hasAgencyBenefit("creator_1")).toBe(false);
		expect(state.deletedCreatorIds).toEqual([]);
	});

	it("unions creator-owned and agency-funded benefits and never charges human members", async () => {
		const state = createAllocationState({ seatLimit: 2, acceptedLinkIds: ["link_1"], memberCount: 50, creatorOwnedBenefits: { creator_1: ["analytics"] } });
		const service = new AgencyAllocationService(
			state,
			() => NOW,
			() => "allocation_1",
		);
		await service.allocate({ linkId: "link_1", creatorId: "creator_1", sourceReference: "agency-contract" });
		expect(service.occupiedSeats()).toBe(1);
		expect(service.effectiveBenefits("creator_1")).toEqual(new Set(["analytics", "pro"]));
	});

	it("releases a deletion allocation immediately and recovery does not reclaim it", async () => {
		const state = createAllocationState({ seatLimit: 1, acceptedLinkIds: ["link_1"], allocations: [{ id: "allocation_1", linkId: "link_1", creatorId: "creator_1", status: "active", effectiveAt: NOW, removalRequestedAt: null, endsAt: null, sourceReference: "agency-contract", createdAt: NOW, updatedAt: NOW }] });
		const service = new AgencyAllocationService(
			state,
			() => NOW,
			() => "unused",
		);
		await service.releaseForDeletion("creator_1");
		expect(service.occupiedSeats()).toBe(0);
		expect(state.allocations[0]?.status).toBe("released_by_deletion");
		expect(service.hasAgencyBenefit("creator_1")).toBe(false);
	});

	it("deduplicates the promised grant, 7-day, 3-day, 1-day, and end notices", () => {
		const endsAt = new Date(NOW.getTime() + 7 * DAY);
		const intents = [buildAgencyAllocationGrantIntent({ allocationId: "allocation_1", recipient: "creator@example.com", agencyName: "Clip Agency", effectiveAt: NOW }), ...buildAgencyAllocationRemovalIntents({ allocationId: "allocation_1", recipient: "creator@example.com", agencyName: "Clip Agency", requestedAt: NOW, endsAt })];
		expect(intents.map((intent) => intent.boundary)).toEqual(["granted", "removal-scheduled", "removal-3d", "removal-1d", "ended"]);
		expect(new Set(intents.map((intent) => intent.dedupeKey)).size).toBe(5);
		expect(renderAgencyAllocationNotification("ended", { agencyName: "Clip Agency", effectiveAt: endsAt }).body).toContain("data remain unchanged");
	});
});

test("long agency Pro and Runner removal schedules expose every countdown without replaying past points", () => {
	const start = new Date("2030-01-01T12:00:00Z"),
		end = new Date("2030-03-01T12:00:00Z");
	for (const product of ["creator_pro", "runner"] as const) {
		const intents = buildAgencyAllocationRemovalIntents({ allocationId: "long", recipient: "alex@example.test", agencyName: "Agency", product, requestedAt: start, endsAt: end });
		expect(intents.map((i) => i.boundary)).toEqual(["removal-scheduled", "removal-30d", "removal-7d", "removal-3d", "removal-1d", "ended"]);
	}
	const short = buildAgencyAllocationRemovalIntents({ allocationId: "short", recipient: "alex@example.test", agencyName: "Agency", requestedAt: new Date(end.getTime() - 2 * 86400000), endsAt: end });
	expect(short.map((i) => i.boundary)).toEqual(["removal-scheduled", "removal-1d", "ended"]);
});
