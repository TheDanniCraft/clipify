export type AllocationStatus = "active" | "removal_scheduled" | "ended" | "released_by_deletion";

export interface AgencyAllocationRecord {
	id: string;
	linkId: string;
	creatorId: string;
	status: AllocationStatus;
	effectiveAt: Date;
	removalRequestedAt: Date | null;
	endsAt: Date | null;
	sourceReference: string;
	createdAt: Date;
	updatedAt: Date;
}

interface AllocationNotification {
	type: "granted" | "removal-scheduled" | "removal-3d" | "removal-1d" | "ended";
	creatorId: string;
	allocationId: string;
	scheduledAt: Date;
	dedupeKey: string;
}

interface AllocationAudit {
	action: "allocate" | "schedule-removal" | "end" | "release-by-deletion";
	allocationId: string;
	creatorId: string;
	occurredAt: Date;
}

export interface AllocationState {
	seatLimit: number;
	memberCount: number;
	acceptedLinkIds: string[];
	allocations: AgencyAllocationRecord[];
	creatorOwnedBenefits: Record<string, string[]>;
	notifications: AllocationNotification[];
	audits: AllocationAudit[];
	deletedCreatorIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createAllocationState(seed: Partial<AllocationState> = {}): AllocationState {
	return {
		seatLimit: seed.seatLimit ?? 0,
		memberCount: seed.memberCount ?? 0,
		acceptedLinkIds: [...(seed.acceptedLinkIds ?? [])],
		allocations: (seed.allocations ?? []).map((allocation) => ({ ...allocation })),
		creatorOwnedBenefits: Object.fromEntries(Object.entries(seed.creatorOwnedBenefits ?? {}).map(([creatorId, benefits]) => [creatorId, [...benefits]])),
		notifications: (seed.notifications ?? []).map((notification) => ({ ...notification })),
		audits: (seed.audits ?? []).map((audit) => ({ ...audit })),
		deletedCreatorIds: [...(seed.deletedCreatorIds ?? [])],
	};
}

export class AgencyAllocationService {
	constructor(
		private readonly state: AllocationState,
		private readonly now: () => Date = () => new Date(),
		private readonly generateId: () => string = () => crypto.randomUUID(),
	) {}

	occupiedSeats() {
		return this.state.allocations.filter((allocation) => allocation.status === "active" || allocation.status === "removal_scheduled").length;
	}

	hasAgencyBenefit(creatorId: string) {
		const now = this.now().getTime();
		return this.state.allocations.some((allocation) => allocation.creatorId === creatorId && (allocation.status === "active" || (allocation.status === "removal_scheduled" && allocation.endsAt !== null && now < allocation.endsAt.getTime())));
	}

	effectiveBenefits(creatorId: string) {
		const benefits = new Set(this.state.creatorOwnedBenefits[creatorId] ?? []);
		if (this.hasAgencyBenefit(creatorId)) benefits.add("pro");
		return benefits;
	}

	async allocate(input: { linkId: string; creatorId: string; sourceReference: string }) {
		if (!this.state.acceptedLinkIds.includes(input.linkId)) throw new Error("ACCEPTED_AGENCY_LINK_REQUIRED");
		if (this.state.allocations.some((allocation) => allocation.creatorId === input.creatorId && (allocation.status === "active" || allocation.status === "removal_scheduled"))) throw new Error("CREATOR_ALLOCATION_EXISTS");
		if (this.occupiedSeats() >= this.state.seatLimit) throw new Error("NO_AGENCY_SEAT_AVAILABLE");
		const now = this.now();
		const allocation: AgencyAllocationRecord = { id: this.generateId(), linkId: input.linkId, creatorId: input.creatorId, status: "active", effectiveAt: now, removalRequestedAt: null, endsAt: null, sourceReference: input.sourceReference, createdAt: now, updatedAt: now };
		this.state.allocations.push(allocation);
		this.notify("granted", allocation, now);
		this.audit("allocate", allocation, now);
		return allocation;
	}

	async scheduleRemoval(allocationId: string) {
		const allocation = this.requireAllocation(allocationId);
		if (allocation.status === "removal_scheduled") return allocation;
		if (allocation.status !== "active") throw new Error("ALLOCATION_INVALID_STATE");
		const now = this.now();
		const endsAt = new Date(now.getTime() + 7 * DAY_MS);
		allocation.status = "removal_scheduled";
		allocation.removalRequestedAt = now;
		allocation.endsAt = endsAt;
		allocation.updatedAt = now;
		this.notify("removal-scheduled", allocation, now);
		this.notify("removal-3d", allocation, new Date(endsAt.getTime() - 3 * DAY_MS));
		this.notify("removal-1d", allocation, new Date(endsAt.getTime() - DAY_MS));
		this.notify("ended", allocation, endsAt);
		this.audit("schedule-removal", allocation, now);
		return allocation;
	}

	async endDueAllocations() {
		const now = this.now();
		for (const allocation of this.state.allocations) {
			if (allocation.status !== "removal_scheduled" || !allocation.endsAt || now.getTime() < allocation.endsAt.getTime()) continue;
			allocation.status = "ended";
			allocation.updatedAt = now;
			this.audit("end", allocation, now);
		}
	}

	async releaseForDeletion(creatorId: string) {
		const now = this.now();
		for (const allocation of this.state.allocations) {
			if (allocation.creatorId !== creatorId || (allocation.status !== "active" && allocation.status !== "removal_scheduled")) continue;
			allocation.status = "released_by_deletion";
			allocation.endsAt = now;
			allocation.updatedAt = now;
			this.audit("release-by-deletion", allocation, now);
		}
	}

	private requireAllocation(id: string) {
		const allocation = this.state.allocations.find((candidate) => candidate.id === id);
		if (!allocation) throw new Error("ALLOCATION_NOT_FOUND");
		return allocation;
	}

	private notify(type: AllocationNotification["type"], allocation: AgencyAllocationRecord, scheduledAt: Date) {
		this.state.notifications.push({ type, creatorId: allocation.creatorId, allocationId: allocation.id, scheduledAt, dedupeKey: `agency-allocation:${allocation.id}:${type}` });
	}

	private audit(action: AllocationAudit["action"], allocation: AgencyAllocationRecord, occurredAt: Date) {
		this.state.audits.push(Object.freeze({ action, allocationId: allocation.id, creatorId: allocation.creatorId, occurredAt }));
	}
}
