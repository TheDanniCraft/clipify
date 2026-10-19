/** @jest-environment node */
const mockAuthorize = jest.fn();
const mockBenefits = jest.fn();
const mockProfile = jest.fn();
const mockAsset = jest.fn();
const mockSet = jest.fn();
const mockWhere = jest.fn();
const mockReturned = jest.fn();
const mockCleanup = jest.fn();
const mockDelete = jest.fn();
const mockAssertAuthority = jest.fn();
jest.mock("@/server/resources/mutation", () => ({ authorizeLockedMutation: (...args: unknown[]) => mockAuthorize(...args) }));
jest.mock("@/server/runner/capabilities", () => ({ ...jest.requireActual("@/server/runner/capabilities"), resolveRunnerBenefits: (...args: unknown[]) => mockBenefits(...args) }));
jest.mock("@/db/client", () => ({
	db: {
		transaction: async (run: (tx: unknown) => Promise<unknown>) => run(mockTransaction),
		delete: (table: unknown) => {
			mockDelete(table);
			return { where: (...args: unknown[]) => mockCleanup(...args) };
		},
	},
}));
import { saveRunnerBrandingProfileForPrincipal } from "@/server/runner/branding-profiles";
import { PgDialect } from "drizzle-orm/pg-core";
const ownerId = "reference-owner";
const runnerId = "11111111-1111-4111-8111-111111111111";
const oldLogo = "22222222-2222-4222-8222-222222222222";
const newAsset = "33333333-3333-4333-8333-333333333333";
const current = Object.freeze({ id: "44444444-4444-4444-8444-444444444444", ownerId, runnerId, watermarkCorner: "top_left", proShowAttribution: false, standbyBackgroundColor: "#16324f", backgroundAssetId: null, logoAssetId: oldLogo, message: "Saved scene", showNextBroadcastTime: false, revision: 3 });
const principal = { kind: "session" as const, authUserId: "reference-actor", sessionId: "reference-session", organizationId: "reference-organization", authenticatedAt: new Date(0) };
const draft = { ownerId, runnerId, expectedRevision: 3, watermarkCorner: "top_left" };
const mockTransaction = {
	query: { runnerBrandingProfilesTable: { findFirst: (...args: unknown[]) => mockProfile(...args) }, runnerBrandingAssetsTable: { findFirst: (...args: unknown[]) => mockAsset(...args) } },
	select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: runnerId }] }) }) }),
	update: () => ({
		set: (values: unknown) => {
			mockSet(values);
			return {
				where: (where: unknown) => {
					mockWhere(where);
					return { returning: () => mockReturned() };
				},
			};
		},
	}),
};
beforeEach(() => {
	jest.clearAllMocks();
	mockAuthorize.mockResolvedValue({ creator: { id: ownerId, plan: "pro" }, assertAuthorityCurrent: mockAssertAuthority });
	mockBenefits.mockResolvedValue({ proAccess: true });
	mockProfile.mockResolvedValue(current);
	mockAsset.mockResolvedValue(null);
	mockReturned.mockResolvedValue([]);
	mockCleanup.mockResolvedValue(undefined);
});

test.each(["backgroundAssetId", "logoAssetId"])("TDD-US4-CON013 U149 strength: an unavailable %s returns a normal refusal before changing profile or assets", async (field) => {
	const result = await saveRunnerBrandingProfileForPrincipal(principal, { ...draft, [field]: newAsset });
	expect(result).toMatchObject({ success: false, code: "RESOURCE_UNAVAILABLE" });
	expect(new PgDialect().sqlToQuery(mockAsset.mock.calls[0][0].where).params).toEqual([newAsset, ownerId, field === "logoAssetId" ? "logo" : "background"]);
	expect(mockSet).not.toHaveBeenCalled();
	expect(mockDelete).not.toHaveBeenCalled();
	expect(current.logoAssetId).toBe(oldLogo);
});

test("TDD-US4-CON013 U272 strength: clearing a saved logo detaches only its owned unreferenced bytes after a successful update", async () => {
	mockReturned.mockResolvedValue([{ ...current, logoAssetId: null, revision: 4 }]);
	const result = await saveRunnerBrandingProfileForPrincipal(principal, { ...draft, logoAssetId: null });
	expect(result).toMatchObject({ success: true, profile: { logoAssetId: null, message: current.message, revision: 4 } });
	expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ logoAssetId: null, revision: 4 }));
	const query = new PgDialect().sqlToQuery(mockCleanup.mock.calls[0][0]);
	expect(query.params).toEqual([oldLogo, ownerId, ownerId, ownerId]);
	expect(query.sql).toContain("NOT EXISTS");
	expect(query.sql).toContain("p.background_asset_id");
	expect(query.sql).toContain("p.logo_asset_id");
	expect(query.sql).toContain("runner_schedule_events");
	expect(query.sql).toContain("runner_broadcast_admissions");
});

test("TDD-US4-CON013 U271 strength: a lost guarded update returns conflict without deleting its pending detached logo", async () => {
	const result = await saveRunnerBrandingProfileForPrincipal(principal, { ...draft, logoAssetId: null });
	expect(result).toMatchObject({ success: false, code: "CONFLICT" });
	expect(new PgDialect().sqlToQuery(mockWhere.mock.calls[0][0]).params).toEqual([current.id, current.revision]);
	expect(mockDelete).not.toHaveBeenCalled();
	expect(mockAssertAuthority).not.toHaveBeenCalled();
	expect(current.logoAssetId).toBe(oldLogo);
});

test("TDD-US4-FR019 strength: a text-only update retains the saved logo and does not clean up its bytes", async () => {
	mockReturned.mockResolvedValue([{ ...current, message: "New text", revision: 4 }]);
	const result = await saveRunnerBrandingProfileForPrincipal(principal, { ...draft, message: "New text" });
	expect(result).toMatchObject({ success: true, profile: { logoAssetId: oldLogo, message: "New text", revision: 4 } });
	expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ message: "New text" }));
	expect(mockSet.mock.calls[0][0]).not.toHaveProperty("logoAssetId");
	expect(mockAsset).not.toHaveBeenCalled();
	expect(mockDelete).not.toHaveBeenCalled();
});
