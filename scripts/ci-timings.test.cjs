/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
	assert = require("node:assert/strict");
const { jobTimingRows } = require("./report-ci-timings.cjs");
test("CI reports waiting, test execution and other work separately", () => {
	const rows = jobTimingRows([{ name: "Browser", status: "completed", created_at: "2026-10-28T00:00:00Z", started_at: "2026-10-28T00:01:00Z", completed_at: "2026-10-28T00:04:00Z", steps: [{ name: "Run complete browser project shard", started_at: "2026-10-28T00:02:00Z", completed_at: "2026-10-28T00:04:00Z" }] }]);
	assert.deepEqual(rows, [{ name: "Browser", waitSeconds: 60, testSeconds: 120, otherSeconds: 60, totalSeconds: 180 }]);
	assert.deepEqual(jobTimingRows([{ name: "pending", status: "queued" }]), []);
});
