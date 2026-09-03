/** @jest-environment node */
import { awardBadgeInternal } from "@/server/membership";

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
	});
	it("records only the user award without a database catalog write", async () => {
		await awardBadgeInternal({ userId: "274252231", badge: "beta-member", source: "manual-test" });
		expect(values).toHaveBeenCalledWith({ userId: "274252231", badge: "beta-member", source: "manual-test", awardedBy: null });
		expect(inserts).toHaveLength(1);
	});
});
