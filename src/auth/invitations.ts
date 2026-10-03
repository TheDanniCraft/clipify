import { createHash } from "node:crypto";
import { addMembership, type MembershipRecord } from "./memberships";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { headers as requestHeaders } from "next/headers";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface InvitationRecord {
	id: string;
	organizationId: string;
	email: string;
	role: string;
	inviterId: string;
	tokenHash: string;
	status: InvitationStatus;
	createdAt: Date;
	expiresAt: Date;
}

export interface InvitationState {
	invitations: InvitationRecord[];
	memberships: MembershipRecord[];
}

export interface InvitationRepository {
	transaction<T>(operation: (state: InvitationState) => Promise<T>): Promise<T>;
}

export interface InvitationDependencies {
	repository: InvitationRepository;
	now: () => Date;
	generateToken: () => string;
	roleExists: (organizationId: string, role: string) => Promise<boolean>;
	deliver: (input: { email: string; token: string; invitationId: string }) => Promise<unknown>;
}

export class InvitationError extends Error {
	constructor(readonly code: "INVITATION_NOT_FOUND" | "INVITATION_EXPIRED" | "INVITATION_EMAIL_MISMATCH" | "INVITATION_ALREADY_USED" | "INVITATION_REVOKED" | "INVITATION_ROLE_INVALID") {
		super(code);
	}
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function hashToken(token: string) {
	return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createInvitation(input: { organizationId: string; email: string; role: string; inviterId: string; delivery: "copy" | "copy-and-email" }, dependencies: InvitationDependencies) {
	const email = normalizeEmail(input.email);
	if (!(await dependencies.roleExists(input.organizationId, input.role))) throw new InvitationError("INVITATION_ROLE_INVALID");
	const token = dependencies.generateToken();
	const now = dependencies.now();
	const record: InvitationRecord = {
		id: `invitation:${hashToken(token).slice(0, 24)}`,
		organizationId: input.organizationId,
		email,
		role: input.role,
		inviterId: input.inviterId,
		tokenHash: hashToken(token),
		status: "pending",
		createdAt: now,
		expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
	};

	await dependencies.repository.transaction(async (state) => {
		state.invitations.push(record);
	});
	if (input.delivery === "copy-and-email") await dependencies.deliver({ email, token, invitationId: record.id });
	return { id: record.id, email, token, expiresAt: record.expiresAt, delivery: input.delivery };
}

export async function acceptInvitation(input: { token: string; authenticatedEmail: string; authUserId: string }, dependencies: InvitationDependencies): Promise<MembershipRecord> {
	return dependencies.repository.transaction(async (state) => {
		const invitation = state.invitations.find((candidate) => candidate.tokenHash === hashToken(input.token));
		if (!invitation) throw new InvitationError("INVITATION_NOT_FOUND");
		if (invitation.status === "revoked") throw new InvitationError("INVITATION_REVOKED");
		if (invitation.status === "accepted") throw new InvitationError("INVITATION_ALREADY_USED");
		if (dependencies.now().getTime() > invitation.expiresAt.getTime()) throw new InvitationError("INVITATION_EXPIRED");
		if (normalizeEmail(input.authenticatedEmail) !== invitation.email) throw new InvitationError("INVITATION_EMAIL_MISMATCH");
		if (!(await dependencies.roleExists(invitation.organizationId, invitation.role))) throw new InvitationError("INVITATION_ROLE_INVALID");

		const membership = addMembership(state.memberships, {
			organizationId: invitation.organizationId,
			authUserId: input.authUserId,
			role: invitation.role,
			createdAt: dependencies.now(),
		});
		invitation.status = "accepted";
		return membership;
	});
}

export async function revokeInvitation(invitationId: string, dependencies: InvitationDependencies): Promise<void> {
	await dependencies.repository.transaction(async (state) => {
		const invitation = state.invitations.find((candidate) => candidate.id === invitationId);
		if (!invitation) throw new InvitationError("INVITATION_NOT_FOUND");
		if (invitation.status === "accepted") throw new InvitationError("INVITATION_ALREADY_USED");
		invitation.status = "revoked";
	});
}

export async function createPersistedInvitation(input: { headers: Headers; organizationId: string; organizationName: string; email: string; role: string; delivery: "copy" | "copy-and-email" }) {
	const { auth } = await import("./config");
	const invitation = await auth.api.createInvitation({
		headers: input.headers,
		body: {
			email: normalizeEmail(input.email),
			role: input.role,
			organizationId: input.organizationId,
			resend: true,
		},
	});
	const invitationUrl = new URL("/accept-invitation", resolveBaseUrl());
	invitationUrl.searchParams.set("invitationId", invitation.id);
	if (input.delivery === "copy-and-email") {
		await sendPersistedInvitationEmail({ headers: input.headers, invitationId: invitation.id, email: invitation.email });
	}
	return { invitation, invitationUrl: invitationUrl.toString(), delivery: input.delivery };
}

export async function sendPersistedInvitationEmail(input: { invitationId: string; email: string; headers?: Headers }) {
	const { auth } = await import("./config");
	const callbackUrl = new URL("/accept-invitation", resolveBaseUrl());
	callbackUrl.searchParams.set("invitationId", input.invitationId);
	await auth.api.signInMagicLink({
		headers: input.headers ?? (await requestHeaders()),
		body: {
			email: normalizeEmail(input.email),
			name: normalizeEmail(input.email).split("@")[0],
			callbackURL: callbackUrl.toString(),
			newUserCallbackURL: callbackUrl.toString(),
			errorCallbackURL: callbackUrl.toString(),
			metadata: { invitationId: input.invitationId },
		},
	});
}

export async function acceptPersistedInvitation(input: { headers: Headers; invitationId: string }) {
	const { auth } = await import("./config");
	return auth.api.acceptInvitation({ headers: input.headers, body: { invitationId: input.invitationId } });
}

export async function revokePersistedInvitation(input: { headers: Headers; invitationId: string }) {
	const { auth } = await import("./config");
	return auth.api.cancelInvitation({ headers: input.headers, body: { invitationId: input.invitationId } });
}
