import { createHash } from "node:crypto";

export interface LegacyBackfillSnapshot {
	creators: Array<{ id: string; twitchSubject: string; email: string }>;
	editors: Array<{ creatorId: string; editorTwitchSubject: string }>;
	resources: Array<{ id: string; creatorId: string; type: "overlay" | "playlist" | "gallery" | "runner"; secret?: string }>;
	subscriptions: Array<{ creatorId: string; subscriptionId: string; status: "active" | "canceled" }>;
	entitlements: Array<{ creatorId: string; source: "creator" | "agency"; key: string }>;
}

export interface BackfillState {
	creators: LegacyBackfillSnapshot["creators"];
	resources: LegacyBackfillSnapshot["resources"];
	subscriptions: LegacyBackfillSnapshot["subscriptions"];
	entitlements: LegacyBackfillSnapshot["entitlements"];
	authUsers: Array<{ id: string; email: string; name: string; emailVerified: boolean }>;
	providerAccounts: Array<{ authUserId: string; twitchSubject: string }>;
	organizations: Array<{ id: string; creatorId: string }>;
	memberships: Array<{ organizationId: string; authUserId: string; role: "owner" | "operations" }>;
	identityLinks: Array<{ creatorId: string; authUserId: string; source: "migration" }>;
	anomalies: Array<{ id: string; creatorId: string; subjectHash: string; category: "unresolved-editor"; status: "open" | "resolved" }>;
}

export interface BackfillRepository {
	transaction<T>(operation: (state: BackfillState, checkpoint: (name: "identity" | "membership") => Promise<void>) => Promise<T>): Promise<T>;
}

export type BackfillPhase = "creator" | "resource" | "subscription" | "entitlement" | "editor";
export type BackfillCursor = { phase: BackfillPhase; offset: number };
export type BackfillOptions = {
	batchSize?: number;
	resumeFrom?: BackfillCursor;
	onBatch?: (cursor: BackfillCursor) => Promise<void> | void;
};

export class BackfillError extends Error {
	constructor(readonly code: "TWITCH_SUBJECT_CONFLICT" | "EDITOR_IDENTITY_UNVERIFIED" | "EDITOR_ANOMALY_NOT_FOUND" | "EDITOR_BACKFILL_INCOMPLETE") {
		super(code);
	}
}

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const authUserId = (subject: string) => `auth:twitch:${hash(subject).slice(0, 24)}`;

export type EditorBackfillValidation = {
	totalRelationships: number;
	operationsMemberships: number;
	pendingSafeAuth: number;
};

export function validateEditorBackfill(snapshot: LegacyBackfillSnapshot, state: BackfillState, options: { allowPendingSafeAuth?: boolean } = {}): EditorBackfillValidation {
	let operationsMemberships = 0;
	let pendingSafeAuth = 0;

	for (const editor of snapshot.editors) {
		const provider = state.providerAccounts.find((account) => account.twitchSubject === editor.editorTwitchSubject);
		if (provider) {
			const hasOperationsMembership = state.memberships.some((membership) => membership.organizationId === `creator:${editor.creatorId}` && membership.authUserId === provider.authUserId && membership.role === "operations");
			if (!hasOperationsMembership) throw new BackfillError("EDITOR_BACKFILL_INCOMPLETE");
			operationsMemberships += 1;
			continue;
		}

		const subjectHash = hash(editor.editorTwitchSubject);
		const hasPendingAnomaly = state.anomalies.some((anomaly) => anomaly.creatorId === editor.creatorId && anomaly.subjectHash === subjectHash && anomaly.category === "unresolved-editor" && anomaly.status === "open");
		if (!hasPendingAnomaly) throw new BackfillError("EDITOR_BACKFILL_INCOMPLETE");
		pendingSafeAuth += 1;
	}

	if (operationsMemberships + pendingSafeAuth !== snapshot.editors.length) throw new BackfillError("EDITOR_BACKFILL_INCOMPLETE");
	if (pendingSafeAuth > 0 && !options.allowPendingSafeAuth) throw new BackfillError("EDITOR_BACKFILL_INCOMPLETE");
	return { totalRelationships: snapshot.editors.length, operationsMemberships, pendingSafeAuth };
}

function pushUnique<T>(values: T[], value: T, key: (item: T) => string) {
	if (!values.some((candidate) => key(candidate) === key(value))) values.push(structuredClone(value));
}

const phaseOrder: BackfillPhase[] = ["creator", "resource", "subscription", "entitlement", "editor"];

async function processBatches<T>(phase: BackfillPhase, values: T[], options: BackfillOptions, process: (value: T) => void | Promise<void>) {
	const batchSize = Math.max(1, Math.floor(options.batchSize ?? 500));
	const resumePhaseIndex = options.resumeFrom ? phaseOrder.indexOf(options.resumeFrom.phase) : -1;
	const phaseIndex = phaseOrder.indexOf(phase);
	if (resumePhaseIndex > phaseIndex) return;
	let offset = resumePhaseIndex === phaseIndex ? Math.max(0, options.resumeFrom?.offset ?? 0) : 0;
	while (offset < values.length) {
		const batch = values.slice(offset, offset + batchSize);
		for (const value of batch) await process(value);
		offset += batch.length;
		await options.onBatch?.({ phase, offset });
	}
}

export async function backfillLegacySnapshot(snapshot: LegacyBackfillSnapshot, repository: BackfillRepository, options: BackfillOptions = {}) {
	const subjects = snapshot.creators.map((creator) => creator.twitchSubject);
	if (new Set(subjects).size !== subjects.length) throw new BackfillError("TWITCH_SUBJECT_CONFLICT");
	return repository.transaction(async (state, checkpoint) => {
		await processBatches("creator", snapshot.creators, options, (creator) => {
			const personId = authUserId(creator.twitchSubject);
			pushUnique(state.creators, creator, (item) => item.id);
			pushUnique(state.authUsers, { id: personId, email: creator.email.toLowerCase(), name: creator.id, emailVerified: true }, (item) => item.id);
			pushUnique(state.providerAccounts, { authUserId: personId, twitchSubject: creator.twitchSubject }, (item) => item.twitchSubject);
			pushUnique(state.organizations, { id: `creator:${creator.id}`, creatorId: creator.id }, (item) => item.id);
			pushUnique(state.identityLinks, { creatorId: creator.id, authUserId: personId, source: "migration" }, (item) => item.creatorId);
			pushUnique(state.memberships, { organizationId: `creator:${creator.id}`, authUserId: personId, role: "owner" }, (item) => `${item.organizationId}:${item.authUserId}`);
		});
		await processBatches("resource", snapshot.resources, options, (resource) => pushUnique(state.resources, resource, (item) => item.id));
		await processBatches("subscription", snapshot.subscriptions, options, (subscription) => pushUnique(state.subscriptions, subscription, (item) => item.subscriptionId));
		await processBatches("entitlement", snapshot.entitlements, options, (entitlement) => pushUnique(state.entitlements, entitlement, (item) => `${item.creatorId}:${item.source}:${item.key}`));
		await checkpoint("identity");

		await processBatches("editor", snapshot.editors, options, (editor) => {
			const provider = state.providerAccounts.find((account) => account.twitchSubject === editor.editorTwitchSubject);
			if (provider) {
				pushUnique(state.memberships, { organizationId: `creator:${editor.creatorId}`, authUserId: provider.authUserId, role: "operations" }, (item) => `${item.organizationId}:${item.authUserId}`);
			} else {
				const subjectHash = hash(editor.editorTwitchSubject);
				pushUnique(state.anomalies, { id: `editor:${subjectHash.slice(0, 24)}:${hash(editor.creatorId).slice(0, 8)}`, creatorId: editor.creatorId, subjectHash, category: "unresolved-editor", status: "open" }, (item) => item.id);
			}
		});
		// Backfill may pause with redacted anomalies so identities can be bound
		// safely. The deployment/removal gate must call the strict default
		// validator and cannot proceed while any relationship remains pending.
		validateEditorBackfill(snapshot, state, { allowPendingSafeAuth: true });
		await checkpoint("membership");
	});
}

export async function bindEditorAtSafeAuth(input: { twitchSubject: string; email: string; emailVerified: boolean; name: string }, repository: BackfillRepository) {
	if (!input.emailVerified || !input.email.trim()) throw new BackfillError("EDITOR_IDENTITY_UNVERIFIED");
	return repository.transaction(async (state) => {
		const subjectHash = hash(input.twitchSubject);
		const anomalies = state.anomalies.filter((anomaly) => anomaly.subjectHash === subjectHash && anomaly.status === "open");
		if (anomalies.length === 0) throw new BackfillError("EDITOR_ANOMALY_NOT_FOUND");
		const personId = authUserId(input.twitchSubject);
		pushUnique(state.authUsers, { id: personId, email: input.email.trim().toLowerCase(), name: input.name, emailVerified: true }, (item) => item.id);
		pushUnique(state.providerAccounts, { authUserId: personId, twitchSubject: input.twitchSubject }, (item) => item.twitchSubject);
		for (const anomaly of anomalies) {
			pushUnique(state.memberships, { organizationId: `creator:${anomaly.creatorId}`, authUserId: personId, role: "operations" }, (item) => `${item.organizationId}:${item.authUserId}`);
			anomaly.status = "resolved";
		}
	});
}
