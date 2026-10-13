/* eslint-disable @typescript-eslint/no-require-imports */
const { partitionTests } = require("./test-execution.cjs");
module.exports = async (paths) => {
	const lanes = partitionTests(paths);
	const lane = process.env.CLIPIFY_TEST_LANE;
	if (!Object.hasOwn(lanes, lane)) throw new Error(`Unknown test lane: ${lane}`);
	return { filtered: lanes[lane].map((test) => ({ test })) };
};
