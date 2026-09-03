/** @jest-environment node */

const mockGetActivePartnerAccessGrant = jest.fn();
jest.mock("@lib/entitlements", () => ({ getActivePartnerAccessGrant: (...args: unknown[]) => mockGetActivePartnerAccessGrant(...args) }));

import { awardBadgeInternal, resolveAutomaticBadgeAwards } from "@/server/membership";

const execute = jest.fn();
const values = jest.fn();
const inserts: unknown[] = [];
jest.mock("@/db/client", () => ({
	db: {
		insert: (table: unknown) => {
			inserts.push(table);
			const chain = {
				values: (input: unknown) => {
					values(input);
					return chain;
				},
				onConflictDoNothing: () => chain,
				returning: () => chain,
				execute,
			};
			return chain;
		},
	},
}));

describe("badge registry writes", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		inserts.length = 0;
		execute.mockResolvedValue([{ ok: true }]);
		mockGetActivePartnerAccessGrant.mockResolvedValue(null);
	});
	it("records only the user award without a database catalog write", async () => {
		await awardBadgeInternal({ userId: "274252231", badge: "beta-tester", source: "manual-test" });
		expect(values).toHaveBeenCalledWith({ userId: "274252231", badge: "beta-tester", source: "manual-test", awardedBy: null });
		expect(inserts).toHaveLength(1);
	});
	it("derives the Partner badge from the active partner grant", async () => {
		const startsAt = new Date("2026-02-01T00:00:00.000Z");
		mockGetActivePartnerAccessGrant.mockResolvedValue({ startsAt });
		await expect(resolveAutomaticBadgeAwards("partner-user")).resolves.toEqual([{ slug: "partner", awardedAt: startsAt }]);
		expect(mockGetActivePartnerAccessGrant).toHaveBeenCalledWith("partner-user");
	});
	it("removes the derived Partner badge when the grant is inactive", async () => {
		await expect(resolveAutomaticBadgeAwards("former-partner")).resolves.toEqual([]);
	});
});
