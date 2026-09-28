import { randomUUID } from "node:crypto";

export const RECENT_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
export const DELETION_RECOVERY_MS = 30 * 24 * 60 * 60 * 1000;

export type AccountOperation = "read" | "update" | "export" | "subscription:read" | "subscription:manage" | "subscription:cancel" | "delete";
export type DeletionChoice = "paid_through" | "immediate";
export type DeletionStatus = "scheduled" | "suspended" | "recovered" | "purge_eligible" | "purged" | "cancelled";

export interface LifecycleActor {
	authUserId: string;
	sessionId: string;
	organizationId: string;
	accountRole: "owner" | "member";
	authenticatedAt: Date;
}

export interface LifecycleAccount {
	organizationId: string;
	creatorId: string;
	status: "active" | "suspension_scheduled" | "suspended" | "purge_eligible";
	suspensionAt?: Date;
	purgeEligibleAt?: Date;
}

export interface AccountDeletionRequest {
	id: string;
	organizationId: string;
	choice: DeletionChoice;
	status: DeletionStatus;
	requestedBy: string;
	requestedAt: Date;
	suspensionAt: Date;
	suspendedAt?: Date;
	purgeEligibleAt?: Date;
	recoveredBy?: string;
	recoveredAt?: Date;
	purgedAt?: Date;
	stripeSnapshot: Record<string, unknown>;
	version: number;
}

export interface LifecycleSubscription {
	id: string;
	organizationId: string;
	status: string;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	latestStripeEventCreated: number;
}

export interface LifecycleAuditEvent {
	id: string;
	organizationId: string;
	actorUserId: string;
	actorSessionId: string;
	action: string;
	outcome: "success" | "denied" | "error";
	reason?: string;
	occurredAt: Date;
}

export interface AccountLifecycleState {
	accounts: LifecycleAccount[];
	deletionRequests: AccountDeletionRequest[];
	subscriptions: LifecycleSubscription[];
	auditEvents: LifecycleAuditEvent[];
	resources: Array<{ id: string; organizationId: string }>;
}

export interface AccountLifecycleRepository {
	transaction<T>(operation: (state: AccountLifecycleState) => Promise<T>): Promise<T>;
}

export interface LifecycleEffects {
	now?: () => Date;
	generateId?: () => string;
	revokeSessions?: (authUserId: string) => Promise<void>;
	pauseRuntime?: (organizationId: string) => Promise<void>;
	releaseAgencyAllocation?: (organizationId: string) => Promise<void>;
}

export interface StripeLifecycleEvent {
	verified: boolean;
	organizationId: string;
	subscriptionId: string;
	created: number;
	status: string;
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date | null;
}

const TERMINAL_DELETION_STATUSES = new Set<DeletionStatus>(["recovered", "purged", "cancelled"]);

export class AccountLifecycleService {
	private readonly now: () => Date;
	private readonly generateId: () => string;

	constructor(
		private readonly repository: AccountLifecycleRepository,
		private readonly effects: LifecycleEffects = {},
	) {
		this.now = effects.now ?? (() => new Date());
		this.generateId = effects.generateId ?? randomUUID;
	}

	async authorizeOwnerOperation(actor: LifecycleActor, operation: AccountOperation) {
		this.assertOwnerAndRecent(actor);
		return { organizationId: actor.organizationId, operation };
	}

	async requestDeletion(actor: LifecycleActor, input: { choice?: DeletionChoice }): Promise<AccountDeletionRequest> {
		this.assertOwnerAndRecent(actor);
		const now = this.now();
		let denial: Error | undefined;
		const request = await this.repository.transaction(async (state) => {
			const account = state.accounts.find((candidate) => candidate.organizationId === actor.organizationId);
			if (!account) throw new Error("ACCOUNT_NOT_FOUND");
			const existing = state.deletionRequests.find((candidate) => candidate.organizationId === actor.organizationId && !TERMINAL_DELETION_STATUSES.has(candidate.status));
			if (existing) {
				denial = new Error("DELETION_ALREADY_REQUESTED");
				state.auditEvents.push(this.audit(actor, now, "account.deletion.request", "denied", denial.message));
				return existing;
			}

			const choice = input.choice ?? "paid_through";
			const subscription = state.subscriptions.find((candidate) => candidate.organizationId === actor.organizationId);
			const suspensionAt = choice === "paid_through" && subscription?.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
			const suspended = suspensionAt.getTime() <= now.getTime();
			const created: AccountDeletionRequest = {
				id: this.generateId(),
				organizationId: actor.organizationId,
				choice,
				status: suspended ? "suspended" : "scheduled",
				requestedBy: actor.authUserId,
				requestedAt: now,
				suspensionAt,
				suspendedAt: suspended ? now : undefined,
				purgeEligibleAt: suspended ? new Date(now.getTime() + DELETION_RECOVERY_MS) : undefined,
				stripeSnapshot: subscription ? { subscriptionId: subscription.id, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd } : {},
				version: 1,
			};
			state.deletionRequests.push(created);
			account.status = suspended ? "suspended" : "suspension_scheduled";
			account.suspensionAt = suspensionAt;
			account.purgeEligibleAt = created.purgeEligibleAt;
			if (subscription) subscription.cancelAtPeriodEnd = true;
			state.auditEvents.push(this.audit(actor, now, "account.deletion.request", "success"));
			return created;
		});
		if (denial) throw denial;
		if (request.status === "suspended") {
			await this.effects.revokeSessions?.(actor.authUserId);
			await this.effects.pauseRuntime?.(actor.organizationId);
			await this.effects.releaseAgencyAllocation?.(actor.organizationId);
		}
		return request;
	}

	async applyStripeSubscriptionEvent(event: StripeLifecycleEvent): Promise<{ applied: boolean }> {
		if (!event.verified) throw new Error("STRIPE_SIGNATURE_REQUIRED");
		return this.repository.transaction(async (state) => {
			const subscription = state.subscriptions.find((candidate) => candidate.id === event.subscriptionId && candidate.organizationId === event.organizationId);
			if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
			if (event.created <= subscription.latestStripeEventCreated) return { applied: false };
			subscription.status = event.status;
			subscription.cancelAtPeriodEnd = event.cancelAtPeriodEnd;
			subscription.currentPeriodEnd = event.currentPeriodEnd;
			subscription.latestStripeEventCreated = event.created;
			return { applied: true };
		});
	}

	assertOwnerAndRecent(actor: LifecycleActor) {
		if (actor.accountRole !== "owner") throw new Error("OWNER_REQUIRED");
		const age = this.now().getTime() - actor.authenticatedAt.getTime();
		if (!Number.isFinite(age) || age < 0 || age > RECENT_AUTH_MAX_AGE_MS) throw new Error("RECENT_AUTH_REQUIRED");
	}

	audit(actor: LifecycleActor, occurredAt: Date, action: string, outcome: LifecycleAuditEvent["outcome"], reason?: string): LifecycleAuditEvent {
		return { id: this.generateId(), organizationId: actor.organizationId, actorUserId: actor.authUserId, actorSessionId: actor.sessionId, action, outcome, reason, occurredAt };
	}
}
