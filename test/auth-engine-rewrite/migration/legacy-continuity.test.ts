/** @jest-environment node */
import { backfillLegacySnapshot, bindEditorAtSafeAuth, validateEditorBackfill, type BackfillRepository, type BackfillState } from "../../../scripts/auth-cutover/backfill";
import { anonymizedLegacySnapshot } from "../../support/auth-engine-rewrite/legacy-snapshot";
import { STANDARD_ROLES } from "@/auth/permissions";

function emptyState(): BackfillState {
	return { creators: [], resources: [], subscriptions: [], entitlements: [], authUsers: [], providerAccounts: [], organizations: [], memberships: [], identityLinks: [], anomalies: [] };
}

class MemoryBackfillRepository implements BackfillRepository {
	state = emptyState();
	failAt?: "identity" | "membership";
	async transaction<T>(operation: (draft: BackfillState, checkpoint: (name: "identity" | "membership") => Promise<void>) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft, async (name) => {
			if (this.failAt === name) throw new Error(`injected:${name}`);
		});
		this.state = draft;
		return result;
	}
}

describe("TDD-US1-001 legacy continuity backfill", () => {
	it("preserves creator, resource, subscription, entitlement, owner, URL-secret IDs exactly", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		expect(repository.state.creators).toEqual(anonymizedLegacySnapshot.creators);
		expect(repository.state.resources).toEqual(anonymizedLegacySnapshot.resources);
		expect(repository.state.subscriptions).toEqual(anonymizedLegacySnapshot.subscriptions);
		expect(repository.state.entitlements).toEqual(anonymizedLegacySnapshot.entitlements);
		for (const creator of anonymizedLegacySnapshot.creators) {
			expect(repository.state.identityLinks).toContainEqual(expect.objectContaining({ creatorId: creator.id }));
			expect(repository.state.memberships).toContainEqual(expect.objectContaining({ organizationId: `creator:${creator.id}`, role: "owner" }));
		}
	});

	it("creates one unique Twitch binding per creator and rejects a conflicting duplicate", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		expect(new Set(repository.state.providerAccounts.map((account) => account.twitchSubject)).size).toBe(anonymizedLegacySnapshot.creators.length);
		const conflict = structuredClone(anonymizedLegacySnapshot);
		conflict.creators[1]!.twitchSubject = conflict.creators[0]!.twitchSubject;
		await expect(backfillLegacySnapshot(conflict, new MemoryBackfillRepository())).rejects.toMatchObject({ code: "TWITCH_SUBJECT_CONFLICT" });
	});

	it("maps safely bound editors to Operations and excludes team, billing, subscription, and deletion authority", async () => {
		const snapshot = structuredClone(anonymizedLegacySnapshot);
		snapshot.editors[0]!.editorTwitchSubject = snapshot.creators[1]!.twitchSubject;
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(snapshot, repository);
		expect(repository.state.memberships).toContainEqual(expect.objectContaining({ organizationId: `creator:${snapshot.creators[0]!.id}`, role: "operations" }));
		expect(STANDARD_ROLES.operations).toEqual(expect.arrayContaining(["overlay:create", "overlay:update", "overlay:delete", "playlist-items:manage", "runner:control"]));
		expect(STANDARD_ROLES.operations).not.toEqual(expect.arrayContaining(["member:invite", "role:update", "billing:manage", "subscription:cancel"]));
		expect(STANDARD_ROLES.operations).not.toContain("account:delete");
	});

	it("records unresolved editors as redacted anomalies without fabricating a person", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		expect(repository.state.anomalies).toHaveLength(anonymizedLegacySnapshot.editors.length);
		expect(repository.state.authUsers).toHaveLength(anonymizedLegacySnapshot.creators.length);
		expect(JSON.stringify(repository.state.anomalies)).not.toContain("@example.invalid");
	});

	it("blocks cutover validation when any legacy editor lacks Operations membership or a tracked anomaly", async () => {
		const snapshot = structuredClone(anonymizedLegacySnapshot);
		snapshot.editors[0]!.editorTwitchSubject = snapshot.creators[1]!.twitchSubject;
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(snapshot, repository);

		expect(validateEditorBackfill(snapshot, repository.state, { allowPendingSafeAuth: true })).toEqual({
			totalRelationships: snapshot.editors.length,
			operationsMemberships: 1,
			pendingSafeAuth: snapshot.editors.length - 1,
		});
		expect(() => validateEditorBackfill(snapshot, repository.state)).toThrow("EDITOR_BACKFILL_INCOMPLETE");

		repository.state.memberships = repository.state.memberships.filter((membership) => membership.role !== "operations");
		expect(() => validateEditorBackfill(snapshot, repository.state, { allowPendingSafeAuth: true })).toThrow("EDITOR_BACKFILL_INCOMPLETE");
	});

	it("allows legacy removal only after every editor is an Operations member", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		for (const [index, editor] of anonymizedLegacySnapshot.editors.entries()) {
			await bindEditorAtSafeAuth({ twitchSubject: editor.editorTwitchSubject, email: `editor-${index}@example.invalid`, emailVerified: true, name: `Editor ${index}` }, repository);
		}

		expect(validateEditorBackfill(anonymizedLegacySnapshot, repository.state)).toEqual({
			totalRelationships: anonymizedLegacySnapshot.editors.length,
			operationsMemberships: anonymizedLegacySnapshot.editors.length,
			pendingSafeAuth: 0,
		});
	});

	it("binds an unresolved editor only after safe verified Twitch authentication", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		const editorSubject = anonymizedLegacySnapshot.editors[0]!.editorTwitchSubject;
		await bindEditorAtSafeAuth({ twitchSubject: editorSubject, email: "editor@example.invalid", emailVerified: true, name: "Editor" }, repository);
		expect(repository.state.authUsers).toContainEqual(expect.objectContaining({ email: "editor@example.invalid" }));
		expect(repository.state.memberships).toContainEqual(expect.objectContaining({ organizationId: `creator:${anonymizedLegacySnapshot.editors[0]!.creatorId}`, role: "operations" }));
		expect(repository.state.anomalies.find((anomaly) => anomaly.subjectHash && anomaly.status === "resolved")).toBeTruthy();
	});

	it("rejects unverified first-safe-auth binding", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		await expect(bindEditorAtSafeAuth({ twitchSubject: anonymizedLegacySnapshot.editors[0]!.editorTwitchSubject, email: "editor@example.invalid", emailVerified: false, name: "Editor" }, repository)).rejects.toMatchObject({ code: "EDITOR_IDENTITY_UNVERIFIED" });
	});

	it.each(["identity", "membership"] as const)("rolls back the full batch after %s failure", async (failAt) => {
		const repository = new MemoryBackfillRepository();
		repository.failAt = failAt;
		await expect(backfillLegacySnapshot(anonymizedLegacySnapshot, repository)).rejects.toThrow(`injected:${failAt}`);
		expect(repository.state).toEqual(emptyState());
	});

	it("is idempotent when rerun", async () => {
		const repository = new MemoryBackfillRepository();
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		const once = structuredClone(repository.state);
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository);
		expect(repository.state).toEqual(once);
	});

	it("emits deterministic batch cursors and resumes without duplicate records", async () => {
		const repository = new MemoryBackfillRepository();
		const cursors: Array<{ phase: string; offset: number }> = [];
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository, {
			batchSize: 1,
			onBatch: (cursor) => {
				cursors.push(cursor);
			},
		});
		expect(cursors).toContainEqual({ phase: "creator", offset: 1 });
		expect(cursors.at(-1)).toEqual({ phase: "editor", offset: anonymizedLegacySnapshot.editors.length });
		const beforeResume = structuredClone(repository.state);
		await backfillLegacySnapshot(anonymizedLegacySnapshot, repository, { batchSize: 1, resumeFrom: { phase: "editor", offset: 0 } });
		expect(repository.state).toEqual(beforeResume);
	});
});
