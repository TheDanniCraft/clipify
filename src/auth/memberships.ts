export interface MembershipRecord {
	organizationId: string;
	authUserId: string;
	role: string;
	createdAt: Date;
}

export function addMembership(memberships: MembershipRecord[], membership: MembershipRecord): MembershipRecord {
	const existing = memberships.find((candidate) => candidate.organizationId === membership.organizationId && candidate.authUserId === membership.authUserId);
	if (existing) {
		if (existing.role !== membership.role) throw new Error("MEMBERSHIP_ROLE_CONFLICT");
		return existing;
	}
	memberships.push(membership);
	return membership;
}
