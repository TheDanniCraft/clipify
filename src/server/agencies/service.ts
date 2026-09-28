import type { Permission } from "@/auth/permissions";
import { PERMISSIONS } from "@/auth/permissions";

export type AgencyAccountStatus = "provisioned" | "owner_invited" | "active" | "suspended" | "closed";
export type AgencyLinkStatus = "proposed" | "accepted" | "revoked";

export interface AgencyActor {
	authUserId: string;
	organizationId: string | null;
	role: "platform-admin" | "owner" | "member";
}

export interface AgencyAccountRecord {
	organizationId: string;
	name: string;
	status: AgencyAccountStatus;
	commercialReference: string | null;
	provisionedBy: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface AgencyLinkRecord {
	id: string;
	agencyOrganizationId: string;
	creatorOrganizationId: string;
	status: AgencyLinkStatus;
	permissionCeiling: Permission[];
	proposedBy: string;
	proposedAt: Date;
	acceptedBy: string | null;
	acceptedAt: Date | null;
	revokedBy: string | null;
	revokedAt: Date | null;
	updatedAt: Date;
}

interface AgencyInvitation {
	id: string;
	agencyOrganizationId: string;
	email: string;
	status: "pending" | "accepted";
	createdAt: Date;
}

interface AgencyMembership {
	organizationId: string;
	authUserId: string;
	role: "owner" | "member";
	createdAt: Date;
}

interface AgencyAudit {
	action: string;
	outcome: "success" | "denied";
	actorUserId: string;
	targetId: string;
	occurredAt: Date;
}

interface AgencyNotification {
	type: "agency-owner-invitation" | "agency-link-proposed" | "agency-link-accepted" | "agency-link-revoked";
	authorityOrganizationId: string;
	recipientReference: string;
	dedupeKey: string;
	scheduledAt: Date;
}

export interface AgencyState {
	accounts: AgencyAccountRecord[];
	links: AgencyLinkRecord[];
	invitations: AgencyInvitation[];
	memberships: AgencyMembership[];
	audits: AgencyAudit[];
	notifications: AgencyNotification[];
}

export function createAgencyState(seed: Partial<AgencyState> = {}): AgencyState {
	return {
		accounts: (seed.accounts ?? []).map((account) => ({ ...account })),
		links: (seed.links ?? []).map((link) => ({ ...link, permissionCeiling: [...link.permissionCeiling] })),
		invitations: (seed.invitations ?? []).map((invitation) => ({ ...invitation })),
		memberships: (seed.memberships ?? []).map((membership) => ({ ...membership })),
		audits: (seed.audits ?? []).map((audit) => ({ ...audit })),
		notifications: (seed.notifications ?? []).map((notification) => ({ ...notification })),
	};
}

function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
}

function validateCeiling(permissions: readonly string[]): asserts permissions is Permission[] {
	const unique = new Set(permissions);
	if (unique.size !== permissions.length || permissions.some((permission) => !PERMISSIONS.includes(permission as Permission))) throw new Error("INVALID_PERMISSION_CEILING");
}

export class AgencyService {
	constructor(
		private readonly state: AgencyState,
		private readonly now: () => Date = () => new Date(),
		private readonly generateId: () => string = () => crypto.randomUUID(),
	) {}

	async provision(input: { actor: AgencyActor; name: string; ownerEmail: string; commercialReference?: string }) {
		if (input.actor.role !== "platform-admin") throw new Error("ADMIN_REQUIRED");
		const now = this.now();
		const organizationId = this.generateId();
		const email = normalizeEmail(input.ownerEmail);
		if (!input.name.trim() || !email.includes("@")) throw new Error("INVALID_AGENCY_PROVISIONING_INPUT");
		const account: AgencyAccountRecord = { organizationId, name: input.name.trim(), status: "owner_invited", commercialReference: input.commercialReference?.trim() || null, provisionedBy: input.actor.authUserId, createdAt: now, updatedAt: now };
		const invitation: AgencyInvitation = { id: `agency-owner:${organizationId}`, agencyOrganizationId: organizationId, email, status: "pending", createdAt: now };
		this.state.accounts.push(account);
		this.state.invitations.push(invitation);
		this.state.notifications.push({ type: "agency-owner-invitation", authorityOrganizationId: organizationId, recipientReference: email, dedupeKey: invitation.id, scheduledAt: now });
		this.audit("agency.provision", input.actor, organizationId, "success");
		return { account, invitation };
	}

	async activateFirstOwner(input: { agencyOrganizationId: string; authUserId: string; verifiedEmail: string }) {
		const account = this.requireAccount(input.agencyOrganizationId);
		const invitation = this.state.invitations.find((candidate) => candidate.agencyOrganizationId === input.agencyOrganizationId && candidate.status === "pending");
		if (!invitation || invitation.email !== normalizeEmail(input.verifiedEmail)) throw new Error("AGENCY_OWNER_INVITATION_REQUIRED");
		if (account.status !== "owner_invited") throw new Error("AGENCY_ACTIVATION_INVALID_STATE");
		const now = this.now();
		invitation.status = "accepted";
		account.status = "active";
		account.updatedAt = now;
		this.state.memberships.push({ organizationId: account.organizationId, authUserId: input.authUserId, role: "owner", createdAt: now });
		this.audit("agency.activate", { authUserId: input.authUserId, organizationId: account.organizationId, role: "owner" }, account.organizationId, "success");
		return account;
	}

	async proposeLink(input: { actor: AgencyActor; creatorOrganizationId: string; permissionCeiling: string[] }) {
		const account = this.requireAgencyOwner(input.actor);
		if (account.status !== "active") throw new Error("AGENCY_NOT_ACTIVE");
		validateCeiling(input.permissionCeiling);
		if (input.creatorOrganizationId === account.organizationId) throw new Error("AGENCY_CREATOR_ACCOUNT_CONFLICT");
		if (this.state.links.some((link) => link.agencyOrganizationId === account.organizationId && link.creatorOrganizationId === input.creatorOrganizationId && link.status !== "revoked")) throw new Error("AGENCY_LINK_EXISTS");
		const now = this.now();
		const link: AgencyLinkRecord = { id: this.generateId(), agencyOrganizationId: account.organizationId, creatorOrganizationId: input.creatorOrganizationId, status: "proposed", permissionCeiling: [...input.permissionCeiling], proposedBy: input.actor.authUserId, proposedAt: now, acceptedBy: null, acceptedAt: null, revokedBy: null, revokedAt: null, updatedAt: now };
		this.state.links.push(link);
		this.state.notifications.push({ type: "agency-link-proposed", authorityOrganizationId: account.organizationId, recipientReference: input.creatorOrganizationId, dedupeKey: `agency-link-proposed:${link.id}`, scheduledAt: now });
		this.audit("agency-link.propose", input.actor, link.id, "success");
		return link;
	}

	async acceptLink(input: { actor: AgencyActor; linkId: string; permissionCeiling: string[] }) {
		const link = this.requireLink(input.linkId);
		this.requireCreatorOwner(input.actor, link.creatorOrganizationId);
		if (link.status !== "proposed") throw new Error("AGENCY_LINK_INVALID_STATE");
		validateCeiling(input.permissionCeiling);
		if (input.permissionCeiling.some((permission) => !link.permissionCeiling.includes(permission))) throw new Error("PERMISSION_CEILING_EXPANSION_DENIED");
		const now = this.now();
		link.permissionCeiling = [...input.permissionCeiling];
		link.status = "accepted";
		link.acceptedBy = input.actor.authUserId;
		link.acceptedAt = now;
		link.updatedAt = now;
		this.state.notifications.push({ type: "agency-link-accepted", authorityOrganizationId: link.agencyOrganizationId, recipientReference: link.creatorOrganizationId, dedupeKey: `agency-link-accepted:${link.id}`, scheduledAt: now });
		this.audit("agency-link.accept", input.actor, link.id, "success");
		return link;
	}

	async reduceLinkCeiling(input: { actor: AgencyActor; linkId: string; permissionCeiling: string[] }) {
		const link = this.requireLink(input.linkId);
		this.requireCreatorOwner(input.actor, link.creatorOrganizationId);
		if (link.status !== "accepted") throw new Error("AGENCY_LINK_INVALID_STATE");
		validateCeiling(input.permissionCeiling);
		if (input.permissionCeiling.some((permission) => !link.permissionCeiling.includes(permission))) throw new Error("PERMISSION_CEILING_EXPANSION_DENIED");
		link.permissionCeiling = [...input.permissionCeiling];
		link.updatedAt = this.now();
		this.audit("agency-link.reduce", input.actor, link.id, "success");
		return link;
	}

	async revokeLink(input: { actor: AgencyActor; linkId: string }) {
		const link = this.requireLink(input.linkId);
		this.requireCreatorOwner(input.actor, link.creatorOrganizationId);
		if (link.status === "revoked") return link;
		const now = this.now();
		link.status = "revoked";
		link.revokedBy = input.actor.authUserId;
		link.revokedAt = now;
		link.updatedAt = now;
		this.state.notifications.push({ type: "agency-link-revoked", authorityOrganizationId: link.agencyOrganizationId, recipientReference: link.creatorOrganizationId, dedupeKey: `agency-link-revoked:${link.id}`, scheduledAt: now });
		this.audit("agency-link.revoke", input.actor, link.id, "success");
		return link;
	}

	resolveAcceptedLink(agencyOrganizationId: string, creatorOrganizationId: string) {
		return this.state.links.find((link) => link.agencyOrganizationId === agencyOrganizationId && link.creatorOrganizationId === creatorOrganizationId && link.status === "accepted") ?? null;
	}

	private requireAccount(organizationId: string) {
		const account = this.state.accounts.find((candidate) => candidate.organizationId === organizationId);
		if (!account) throw new Error("AGENCY_NOT_FOUND");
		return account;
	}

	private requireAgencyOwner(actor: AgencyActor) {
		if (actor.role !== "owner" || !actor.organizationId) throw new Error("AGENCY_OWNER_REQUIRED");
		return this.requireAccount(actor.organizationId);
	}

	private requireCreatorOwner(actor: AgencyActor, creatorOrganizationId: string) {
		if (actor.role !== "owner" || actor.organizationId !== creatorOrganizationId) throw new Error("CREATOR_OWNER_REQUIRED");
	}

	private requireLink(linkId: string) {
		const link = this.state.links.find((candidate) => candidate.id === linkId);
		if (!link) throw new Error("AGENCY_LINK_NOT_FOUND");
		return link;
	}

	private audit(action: string, actor: AgencyActor, targetId: string, outcome: "success" | "denied") {
		this.state.audits.push(Object.freeze({ action, outcome, actorUserId: actor.authUserId, targetId, occurredAt: this.now() }));
	}
}
