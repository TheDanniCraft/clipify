/** @jest-environment node */
jest.mock("@/db/client", () => ({ db: { execute: jest.fn() } }));
import { db } from "@/db/client";
import { getMcpClientHealthStats, getMcpClientStats } from "@/server/mcp/client-stats";
const stats = { summary: { registeredClients: 0, authorizedClients: 0, activeClients30d: 0, calls30d: 0, applicationNames: 0 }, items: [] };
test("bounded health cache coalesces reads, isolates snapshots and refreshes after a minute", async () => {
	jest.spyOn(Date, "now").mockReturnValue(0);
	(db.execute as jest.Mock).mockResolvedValue({ rows: [{ data: stats }] });
	const [first, second] = await Promise.all([getMcpClientHealthStats(), getMcpClientHealthStats()]);
	expect(db.execute).toHaveBeenCalledTimes(1);
	first.summary.calls30d = 100;
	expect(second.summary.calls30d).toBe(0);
	expect((await getMcpClientHealthStats()).summary.calls30d).toBe(0);
	(Date.now as jest.Mock).mockReturnValue(60001);
	await getMcpClientHealthStats();
	expect(db.execute).toHaveBeenCalledTimes(2);
	jest.restoreAllMocks();
});
test.each([
	[0, 20],
	[1, 0],
	[1, 101],
	[1000001, 20],
	[1.5, 20],
])("invalid pagination %s/%s cannot reach SQL", async (page, size) => {
	const before = (db.execute as jest.Mock).mock.calls.length;
	await expect(getMcpClientStats(page, size)).rejects.toThrow("INVALID_INPUT");
	expect((db.execute as jest.Mock).mock.calls.length).toBe(before);
});
test("missing data and database errors remain unavailable, without fabricated zero counts", async () => {
	(db.execute as jest.Mock).mockResolvedValue({ rows: [] });
	await expect(getMcpClientStats()).rejects.toThrow("SERVICE_UNAVAILABLE");
	(db.execute as jest.Mock).mockRejectedValue(Error("database offline"));
	await expect(getMcpClientStats()).rejects.toThrow("database offline");
});
