/** @jest-environment node */
import type { QueryClient } from "@/db/client";

it("shares concurrent cache scans, expires the sample and never caches failures", async () => {
	const { getCacheHealthCounts } = await import("@lib/cacheHealth");
	let time = 1000;
	const clock = jest.spyOn(Date, "now").mockImplementation(() => time);
	const rows = [{ type: "clip", count: 2, unavailable: 1, staleValidated: 0 }];
	let finish!: (value: typeof rows) => void;
	const execute = jest
		.fn()
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		)
		.mockResolvedValue(rows);
	const chain = { from: jest.fn().mockReturnThis(), groupBy: jest.fn().mockReturnThis(), execute };
	const db = { select: jest.fn(() => chain) } as unknown as QueryClient;
	try {
		const first = getCacheHealthCounts(db, new Date());
		const second = getCacheHealthCounts(db, new Date());
		finish(rows);
		expect(await first).toEqual(rows);
		expect(await second).toEqual(rows);
		expect(execute).toHaveBeenCalledTimes(1);
		await getCacheHealthCounts(db, new Date());
		expect(execute).toHaveBeenCalledTimes(1);
		time += 30001;
		execute.mockRejectedValueOnce(new Error("timeout"));
		await expect(getCacheHealthCounts(db, new Date())).rejects.toThrow("timeout");
		expect(await getCacheHealthCounts(db, new Date())).toEqual(rows);
		expect(execute).toHaveBeenCalledTimes(3);
	} finally {
		clock.mockRestore();
	}
});
