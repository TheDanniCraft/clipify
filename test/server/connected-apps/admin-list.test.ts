/** @jest-environment node */
const requireAdmin = jest.fn();
let rows: unknown[] = [];
const select = jest.fn();
const offset = jest.fn(async () => rows);
const query = { from: () => query, innerJoin: () => query, orderBy: () => query, limit: () => query, offset };
jest.mock("@/db/client", () => ({
	db: {
		select: (fields: unknown) => {
			select(fields);
			return query;
		},
	},
}));
jest.mock("@/server/connected-apps/oauth-policy", () => ({ requireConnectedAppAdmin: (headers: Headers) => requireAdmin(headers) }));
import { listApplicationConnections } from "@/server/connected-apps/admin-list";
beforeEach(() => {
	requireAdmin.mockReset().mockResolvedValue({});
	select.mockClear();
	offset.mockClear();
	rows = [];
});
it("requires administrator authorization before listing", async () => {
	requireAdmin.mockRejectedValue(Error());
	expect((await listApplicationConnections(new Request("https://clipify.test/api/connected-apps/admin"))).status).toBe(403);
	expect(select).not.toHaveBeenCalled();
});
it("selects safe public fields and paginates with a lookahead", async () => {
	rows = Array.from({ length: 26 }, (_, index) => ({ id: String(index) }));
	const response = await listApplicationConnections(new Request("https://clipify.test/api/connected-apps/admin?page=2"));
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(await response.json()).toMatchObject({ ok: true, data: { page: 2, hasNext: true, items: rows.slice(0, 25) } });
	expect(offset).toHaveBeenCalledWith(25);
	expect(Object.keys(select.mock.calls[0][0])).not.toEqual(expect.arrayContaining(["clientSecret"]));
	expect(Object.keys(select.mock.calls[0][0])).not.toContain("metadata");
});
it.each(["0", "-1", "1.5", "1000000", "NaN"])("rejects invalid page %s", async (value) => {
	expect((await listApplicationConnections(new Request(`https://clipify.test/api/connected-apps/admin?page=${value}`))).status).toBe(400);
	expect(select).not.toHaveBeenCalled();
});
it("redacts database failures", async () => {
	offset.mockRejectedValueOnce(Error("private-database"));
	const response = await listApplicationConnections(new Request("https://clipify.test/api/connected-apps/admin"));
	expect(response.status).toBe(503);
	expect(await response.text()).not.toContain("private");
});
