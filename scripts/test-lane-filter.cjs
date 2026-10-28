/* eslint-disable @typescript-eslint/no-require-imports */
const { coveragePartitions } = require("./test-execution.cjs");
module.exports = async (paths) => {
	const lanes = coveragePartitions(paths);
	const lane = process.env.CLIPIFY_TEST_LANE;
	if (!Object.hasOwn(lanes, lane)) throw new Error(`Unknown test lane: ${lane}`);
	return { filtered: lanes[lane] };
};
