/** @jest-environment node */
import { RequestAwarePool } from "@/db/request-scope";
describe("TDD-CANCELLATION-003 public pool shutdown compatibility", () => {
	test("promise shutdown closes an unused pool without connecting", async () => {
		const pool = new RequestAwarePool({ connectionString: "postgresql://fixture@127.0.0.1:9/fixture" });
		await pool.end();
		expect(pool.ended).toBe(true);
	});
	test("callback shutdown completes once without a database connection", async () => {
		const pool = new RequestAwarePool({ connectionString: "postgresql://fixture@127.0.0.1:9/fixture" });
		const callback = jest.fn();
		await new Promise<void>((resolve) =>
			pool.end(() => {
				callback();
				resolve();
			}),
		);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(pool.ended).toBe(true);
	});
	test("callback receives the native repeated-shutdown error", async () => {
		const pool = new RequestAwarePool({ connectionString: "postgresql://fixture@127.0.0.1:9/fixture" });
		await pool.end();
		const callback = jest.fn();
		pool.end(callback);
		await new Promise((resolve) => setImmediate(resolve));
		expect(callback).toHaveBeenCalledWith(expect.objectContaining({ message: "Called end on pool more than once" }));
	});
});
