/** @jest-environment node */
import { awardBadgeInternal, syncBadgeDefinitionInternal } from "@/server/membership";
import { badgeCatalog } from "@lib/badgeCatalog";

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
				onConflictDoUpdate: () => chain,
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
	});
	it("synchronizes the exact registered definition", async () => {
		await syncBadgeDefinitionInternal("founder");
		expect(values).toHaveBeenCalledWith({ slug: "founder", ...badgeCatalog.founder });
	});
	it("synchronizes the catalog before recording an award", async () => {
		await awardBadgeInternal({ userId: "274252231", badgeSlug: "beta-member", source: "manual-test" });
		expect(values.mock.calls).toEqual([[{ slug: "beta-member", ...badgeCatalog["beta-member"] }], [{ userId: "274252231", badgeSlug: "beta-member", source: "manual-test", awardedBy: null }]]);
		expect(inserts).toHaveLength(2);
	});
});
